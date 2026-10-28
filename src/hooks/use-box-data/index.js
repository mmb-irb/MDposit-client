import { useContext, useState, useMemo, useLayoutEffect } from 'react';

import { ProjectCtx } from '../../contexts';

// To make API requests
import { BASE_PATH_PROJECTS } from '../../utils/constants';
import useBatchAPI from '../use-batch-api';

// Box vectors per frame: 3 vectors of 3 float32 coordinates
const BOX_COORDINATES = 9;

// Box of the first frame, which is the structure frame
// It is used to find how much boxes were rotated by the trajectory fit
const REFERENCE_BOX_URLPATH = '/trajectory/box?frames=1';

// This is a custom hook
// Download the simulation box of every frame loaded by the main component
// The box frames are requested with the same frames range than the main trajectory
// Only the main trajectory (i.e. '/trajectory') has boxes
// Return null while the box is not enabled or it is still loading
// Otherwise return the reference box (first frame) and the boxes of loaded frames as Float32Arrays
const useBoxData = (components, requestedFramesNumber, enabled) => {
    const { accessionAndMdNumber, fileDescriptors } = useContext(ProjectCtx);

    // Set the box urlpath from the main component framed trajectory urlpath
    // WARNING: This must be a layout effect run after the useViewerData layout effect, which sets the framed URLs
    // WARNING: Thus it has the same dependencies and this hook must be called after useViewerData
    const [boxUrlpath, setBoxUrlpath] = useState(null);
    useLayoutEffect(() => {
        if (!enabled || !components) return setBoxUrlpath(null);
        const mainComponent = components[0];
        // The structure is the first frame
        if (mainComponent.onlyTopology) return setBoxUrlpath(REFERENCE_BOX_URLPATH);
        // Wait for useViewerData to set the framed URLs
        const framedURLs = mainComponent.framedURLs;
        if (!framedURLs) return setBoxUrlpath(null);
        if (framedURLs.length !== 1)
            throw new Error('Boxes are only available for components with a single trajectory');
        const [path, frames] = framedURLs[0].split('?');
        if (path !== '/trajectory')
            throw new Error(`Boxes are only available for the main trajectory, not for "${path}"`);
        setBoxUrlpath(`/trajectory/box?${frames}`);
    }, [components, fileDescriptors, requestedFramesNumber, enabled]);

    // Request both the reference box and the loaded frames boxes
    // WARNING: The URLs array must be memoized, since useBatchAPI requests again every time it changes
    const urls = useMemo(() => {
        if (!boxUrlpath) return [];
        const baseUrl = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}`;
        return [baseUrl + REFERENCE_BOX_URLPATH, baseUrl + boxUrlpath];
    }, [boxUrlpath, accessionAndMdNumber]);
    const responses = useBatchAPI(urls);

    return useMemo(() => {
        if (urls.length === 0) return null;
        // Responses may still belong to previous URLs right after they change
        const ready = urls.every((url, i) => responses[i] && responses[i].url === url && !responses[i].loading);
        if (!ready) return null;
        const failed = responses.find(response => response.error);
        if (failed) throw failed.error;
        const [reference, boxes] = responses.map(response => new Float32Array(response.payload));
        if (reference.length !== BOX_COORDINATES)
            throw new Error(`Unexpected reference box length: ${reference.length}`);
        if (boxes.length % BOX_COORDINATES !== 0)
            throw new Error(`Unexpected boxes length: ${boxes.length}`);
        return { reference, boxes };
    }, [urls, responses]);
};

export default useBoxData;
