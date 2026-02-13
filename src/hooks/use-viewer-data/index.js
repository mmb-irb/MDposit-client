import React, {
    useContext,
    useState,
    useRef,
    useEffect,
} from 'react';

import { ProjectCtx } from '../../contexts';

// To make API requests
import { BASE_PATH_PROJECTS } from '../../utils/constants';

// Auxiliar functions
import { appendBuffer } from '../../utils/auxiliar-functions';

// HTTP utils
import https from 'https-browserify';
import http from 'stream-http';
import { parse as urlParse } from 'url';

const frameRangeFormat = /\?frames=(?<start>\d+):(?<end>\d+)(:(?<step>\d+))?/;
const parseFrameRange = frameRange => {
  // Search in the function's parameter value "string" by using a specified regexp format: STEP_FORMAT
  const parsed = frameRangeFormat.exec(frameRange);
  if (!parsed) return null;
  // The 'frameRangeFormat' has 3 defined groups: start, end and step
  // Use the value from the 3 groups to define and save the desired frames
  const start = +parsed.groups.start;
  const end = Math.max(+parsed.groups.end, start); // If the end is less than the start then just use the start
  const step = +(parsed.groups.step || 1);
  const frames = Math.floor((end - start) / step) + 1;
  return { start, end, step, frames };
};

// This function expects to receive a specific frame or the number of frames to load
// This function returns a string which specifies the frames to be loaded
// This string is standarized in a API friendly format
const getFrames = (trajectoryFrames, requestedFrames, requestedFrame) => {
    // only one specific frame loaded, as a projection
    if (requestedFrame) return { range: (requestedFrame + 1).toString(), frames: 1 };
    // multiple frames loaded, as a trajectory
    if (!trajectoryFrames) throw new Error('Missing number of frames in the trajectory');
    if (!requestedFrames) throw new Error('Missing number of requested frames');
    const frameStep = Math.floor(trajectoryFrames / requestedFrames);
    // Predict how many frames will be returned, which may be different from the requested frames number
    const returnedFrames = Math.ceil(trajectoryFrames / frameStep);
    return {
        range: `${1}:${trajectoryFrames}:${frameStep}`,
        frames: returnedFrames,
    };
};

// This is a custom hook
// Download all data required for the molecular viewer: topologies and trajectories
// The exact topologies and trajectories to be downloaded are configured in the components
// The maximum number of frames to load is passed through the "requestedFramesNumber"
// The "onLoad" hook is helpful to return feedback of the current load progress
const useViewerData = (components, requestedFramesNumber, onLoad) => {

    // If no URL is provided then use the main trajectory // URL to find the trajectory data in the API
    // True when we just want to display a static structure // Requeste number of frames to display
    // data from context
    const { accessionAndMdNumber, fileDescriptors, structureData } = useContext(ProjectCtx);

    // Download topologies ----------------------------------------------------------------------

    // Download all requested topologies: Each component may have a different structure URL

    // Set a state to store the topology requests
    const [requestedTopologies, setRequestedTopologies] = useState([]);
    // Set also a state to track whenever there is still a downloading topology
    // LORE: This was useful when we had to wait for all stages to be mounted at the same time
    // LORE: It does nothing now but its value is still valid and it may be useful for logs
    const [anyLoadingTopology, setAnyLoadingTopology] = useState(false);

    // Find if there are new topology to be requested in the components:
    // Collect the topology on each component
    // If the component has no topology specified use the main topology
    useEffect(() => {
        // Make sure we already have components
        if (!components) return;
        setRequestedTopologies(previousRequestedTopologies => {
            const newRequestedTopologies = [];
            components.forEach(comp => {
                const urlpath = comp.topologyURL || null;
                const selection = comp.atomSelection || null;
                const atomIndices = comp.atomIndices || null;
                // Check if the url is new
                // Else, skip this url since it has been requested already
                const allRequestedTopologies = [
                    ...previousRequestedTopologies,
                    ...newRequestedTopologies,
                ];
                const current = allRequestedTopologies.find(topology => topology.urlpath === urlpath);
                if (current) return;
                // Some urls may be missing
                // This happens when the component wants the default structure
                if (urlpath === null) {
                    // Add a request with null url in order to get the main structure as topology
                    // Do it only once for all components
                    newRequestedTopologies.push({
                        urlpath: null,
                        loading: false,
                        error: null,
                    });
                } else {
                    // WARNING: Atom indices must be sorted
                    // The API should be able to handle disordedred indices
                    // However for some reason we are getting a CORS error if indices are no sorted
                    const sortedAtomIndices = atomIndices.sort((a, b) => a - b);
                    // Add the topology to the list, so it will be requested to the API
                    newRequestedTopologies.push({
                        urlpath: urlpath,
                        selection: selection,
                        atomindices: sortedAtomIndices,
                        loading: true,
                        requested: false,
                        error: null,
                    });
                    setAnyLoadingTopology(true);
                }
            });
            return [...previousRequestedTopologies, ...newRequestedTopologies];
        });
    }, [components, setRequestedTopologies]);

    // Set a state to store the downloaded topologies
    const [topologies, setTopologies] = useState([]);
    // Keep track of all requests in case we have to abort them further
    const currentRequests = useRef([]);

    // Download all requested topologies/structures from the API
    useEffect(() => {
        requestedTopologies.forEach(topology => {
            // Check if the requested url has the data already downloaded
            // If so, skip this request
            if (topology.file) return;
            // If the topology failed to load do not try it again
            if (topology.error) return;
            // If the topology has been already requested do not request it again
            if (topology.requested && topology.source === accessionAndMdNumber) return;
            // If there is no URL then load the main structure
            // WARNING: The '[...previous]' is essential to make the array object change
            // This is important, since the 'topologies' object is used as a dependency further
            // And if we do not change the array then the change is not detected
            if (topology.urlpath === null) setTopologies(previousTopologies => {
                // The topology with the main structure data has not url
                const newTopology = {
                    url: null,
                    source: accessionAndMdNumber,
                    urlpath: null,
                    file: structureData,
                };
                return [...previousTopologies, newTopology];
            });
            // If there is an URL
            else {
                topology.requested = true;
                topology.source = accessionAndMdNumber;
                // Create the POST body
                const postData = JSON.stringify({
                    selection : topology.selection || undefined,
                    atomindices: topology.atomindices || undefined,
                });
                // Request the API
                // http exception is added for local testing in http://localhost
                const protocol = BASE_PATH_PROJECTS.substring(0, 5) === 'https' ? https : http;
                const actualUrl = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}${topology.urlpath}`;
                const requestOptions = urlParse(actualUrl);
                // We use the POST method instead of the regular GET method to allow long atom selections when requesting structure
                // However, if we are requesting a file the POST method is not supported
                const isStructureEndpoint = requestOptions.path.endsWith('/structure')
                requestOptions.method = isStructureEndpoint ? 'POST' : 'GET';
                requestOptions.headers = {
                    'Content-Type': 'application/json',
                    'Content-Length': postData.length
                }
                const request = protocol.request(requestOptions, response => {
                    // Track the amout of bytes already downloaded
                    let responseContent = '';
                    response .on('data', chunk => {
                        responseContent += chunk;
                    }).on('end', () => {
                        // Update the topologies state by adding the new topology with its content
                        setTopologies(previousTopologies => {
                            const newTopology = {
                                url: actualUrl,
                                source: accessionAndMdNumber,
                                urlpath: topology.urlpath,
                                file: responseContent
                            };
                            return [...previousTopologies, newTopology];
                        });
                        // Update the requested topology loading state
                        topology.loading = false;
                        // Check the loading state of all requested topologies
                        // Then update the overall loading state
                        const anyLoading = requestedTopologies.some(t => t.loading);
                        setAnyLoadingTopology(anyLoading);
                    });
                });
                // Send the request data (POST method feature)
                if (requestOptions.method === 'POST'){
                    request.write(postData);
                }
                // Close the request for it to actually start
                // Note that this is required for the https.request altought it was not by https.get
                request.end();
                currentRequests.current.push(request);
            }
        });
    }, [requestedTopologies, structureData, accessionAndMdNumber]);

    // Download trajectories ------------------------------------------------------------------------------------------------

    // First we find all trajectory URLs (i.e. all requests to API)
    // Then we ask the API skipping repeated URLs

    // Set a function to modify an url by adding the frames range according to requestedFramesNumber
    // The only exception are those trajectories whose frame number is lower than requestedFramesNumber

    // Set a state to store requested trajectories and their loading status
    const [requestedTrajectories, setRequestedTrajectories] = useState([]);
    // Set also a state to track whenever there is still a downloading trajectory
    const [anyLoadingTrajectory, setAnyLoadingTrajectory] = useState(false);

    // Find if there are new trajectories to be requested in the components:
    // Collect trajectories on each component
    // If the component has no trajectory specified use the main trajectory
    // If the component is not the main component and has no frame specified, use the first frame
    // Only the main component (the first) is allowed to load multiple frames by the moment
    useEffect(() => {
        // Make sure we already have components
        if (!components) return;
        // Send a request to the API with the file descriptor
        const { loading, payload, error } = fileDescriptors;
        // If we do not have file descritors yet then stop here
        if (loading) return;
        // Throw it in case something went wrong with the donwload
        else if (error) throw error;
        else if (!payload) throw new Error('Something bad happened with file descriptors');
        // Finally update the trajectories state
        setRequestedTrajectories(currentTrajectories => {
            // Save the new requetsed trajectories
            const newTrajectories = [];
            // Set the urlpath to ask the API
            // Here, if you ask for the trajectory.bin instead of just trajectory, you get the whole file
            // This is because the only route of the API accepting frames selection is the "trajectory" endpoint
            // Other paths such as "trajectory.bin" will be processed as "/:files"
            const defaultUrlpath = `/trajectory`;
            components.forEach((comp, c) => {
                if (comp.onlyTopology) return;
                // Set the first component as the 'principal' component
                const isPrincipal = c === 0;
                const requestedFrame = comp.frame;
                // Get the trajectory urls
                // If the component has no trajectory urlpath specified then use the default trajectory
                const urlpaths = comp.trajectoryURLs || [ defaultUrlpath ];
                // Add the frames number of all the component requested trajectories
                comp.frameCount = 0;
                urlpaths.forEach((urlpath, u) => {
                    // Check if the urlpath is already framed
                    const framed = parseFrameRange(urlpath);
                    // Get the name of the trajectory file inside the database
                    // i.e. the end of the requested URL
                    // The exception is the API endpoint 'trajectory', which uses the 'trajectory.bin' file
                    let trajectoryFilename = urlpath.split('/').slice(-1)[0];
                    if (framed) trajectoryFilename = trajectoryFilename.split('?frames=')[0];
                    if (trajectoryFilename === 'trajectory') trajectoryFilename = 'trajectory.bin';
                    // Get the file descriptor of the required trajectory
                    const trajectoryFileDescriptor = payload.find(file => 
                        file.filename === trajectoryFilename);
                    if (!trajectoryFileDescriptor)
                        throw new Error( `Trajectory "${trajectoryFilename}" is missing`);
                    const trajectoryMetadata = trajectoryFileDescriptor.metadata;
                    // Get the number of frames in the whole trajectory
                    const trajectoryFrames = trajectoryMetadata.frames;                
                    // Set the number of frames to be requested from the whole trajectory
                    let requestedFrames = requestedFramesNumber;
                    if (requestedFramesNumber > trajectoryFrames) requestedFrames = trajectoryFrames;
                    if (Number.isFinite(requestedFrame)) requestedFrames = 1;
                    else if (framed) requestedFrames = framed.frames;
                    // Components which are not the principal must include a 'frame' value
                    if (!isPrincipal && requestedFrames > 1) 
                        throw new Error(`Only the main component is allowed to load multiple frames`);
                    // Frames are added to any urlpath which is missing the frames range according to requestedFramesNumber
                    // The only exception are those trajectories whose frame number is lower than requestedFramesNumber
                    let finalUrlpath = urlpath;
                    // Get the expected number of frames returned, which may not be exactly the requested number
                    let returnedFrames;
                    // In case the urlpath is already framed
                    if (framed) {
                        // Find maximum number of frames to be returned (trajectory frames or requetsed frames)
                        const maximumFrames = Math.min(trajectoryFrames, framed.end);
                        returnedFrames = Math.ceil(maximumFrames / framed.step);
                    }
                    // Modify the urlpath if it is not framed yet
                    else {
                        // Get the string frames range according to requestedFramesNumber
                        const { range: framesRange, frames: framesCount } = getFrames(
                            trajectoryFrames,
                            requestedFrames,
                            requestedFrame,
                        );
                        returnedFrames = framesCount;
                        // Add the frames range to the original urlpath
                        if (framesRange) finalUrlpath = urlpath + `?frames=${framesRange}`;
                    }
                    // Set the component framed urlpath if it doesn't exists
                    if (!comp.framedURLs) comp.framedURLs = [];
                    // Save this final urlpath in the framedURL in the component
                    // Overwrite the previous framed urlpath if exists
                    comp.framedURLs[u] = finalUrlpath;
                    // Add the requested frames number to the frame count
                    comp.frameCount += requestedFrames;
                    // Check if the requested urlpath is already in the list
                    // If so, skip this request
                    // If not, save the request urlpath and proceed
                    const current = currentTrajectories.find(
                        trajectory => trajectory.urlpath === finalUrlpath);
                    if (!current) {
                        newTrajectories.push({
                            urlpath: finalUrlpath,
                            frames: returnedFrames,
                            // Add also the atoms number, which is used further
                            atoms: trajectoryMetadata.atoms,
                            loading: true,
                            requested: false,
                        });
                        setAnyLoadingTrajectory(true);
                    }
                });
            });
            // In case there are new requested trajectories we return a new array to trigger dependencies
            if (newTrajectories.length > 0) return [...currentTrajectories, ...newTrajectories];
            // Otherwise we return the previous array to do no trigger dependencies
            return currentTrajectories;
        });
    }, [components, fileDescriptors, requestedFramesNumber]);

    // Set a state to store trajectories data
    const [trajectories, setTrajectories] = useState([]);

    // Download the requested trajectory data (frames)
    useEffect(() => {
        requestedTrajectories.forEach(trajectory => {
            // Check if the trajectory has been requested already
            // If so, skip this request
            if (trajectory.requested && trajectory.source === accessionAndMdNumber) return;
            trajectory.requested = true;
            trajectory.source = accessionAndMdNumber;
            // Set the loading status as true
            trajectory.loading = true;
            trajectory.progress = 0;
            // DANI: Todavía no me ha hecho falta hacer una selección larga de atomos/frames
            // DANI: Todo está listo a nivel de API
            // DANI: Solo hará falta reformar un poco el viewer-with-controls y este script
            const postData = JSON.stringify({});
            // Request the API
            // http exception is added for local testing in http://localhost
            const protocol = BASE_PATH_PROJECTS.substring(0, 5) === 'https' ? https : http;
            const actualUrl = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}${trajectory.urlpath}`;
            const requestOptions = urlParse(actualUrl);
            // Check if the request points to the /trajectory endpoint or it is pointing to a file
            const requestPathsteps = requestOptions.pathname.split('/')
            const isTrajectoryEndpoint = requestPathsteps[requestPathsteps.length -1] === 'trajectory'
            // We use the POST method instead of the regular GET method to allow long atom selections
            // However, if we are retrieving a specific file the the POST method is not implemented
            requestOptions.method = isTrajectoryEndpoint ? 'POST' : 'GET';
            requestOptions.headers = {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            }
            const request = protocol.request(requestOptions, response => {
            const totalBytes = response.headers['content-length'];
            // Set the new trajectory
            setTrajectories(previousTrajectories => {
                const newTrajectory = {
                    url: actualUrl,
                    source: accessionAndMdNumber,
                    urlpath: trajectory.urlpath,
                    frames: trajectory.frames,
                    atoms: trajectory.atoms,
                    payload: new ArrayBuffer(0),
                    progress: 0,
                };
                return [...previousTrajectories, newTrajectory];
            });
            // Track the amout of bytes already downloaded
            let byteCount = 0;
            response
                .on('data', chunk => {
                    byteCount += chunk.byteLength;
                    trajectory.progress = byteCount / totalBytes;
                    // Update trajectories with the current partial data we have
                    setTrajectories(previousTrajectories => {
                        const currentTrajectory = previousTrajectories.find(
                            traj => traj.url === actualUrl);
                        currentTrajectory.payload = appendBuffer(currentTrajectory.payload, chunk);
                        currentTrajectory.progress = trajectory.progress;
                        return [...previousTrajectories];
                    });
                })
                .on('end', () => {
                    // Save the main data in the ref
                    trajectory.loading = false;
                    // Then check the loading state of all requested trajectories and update the overall loading state
                    const anyLoading = requestedTrajectories.some(
                        trajectory => trajectory.loading,
                    );
                    setAnyLoadingTrajectory(anyLoading);
                });
            });
            // Send the request data (POST method feature)
            if (requestOptions.method === 'POST') request.write(postData);
            // Close the request for it to actually start
            // Note that this is required for the https.request altought it was not by https.get
            request.end();
            currentRequests.current.push(request);
        });
    }, [requestedTrajectories, accessionAndMdNumber]);

    // If the accession or MD changes then we must clear old data to free up memory
    // Purge old topologies and trajectories not belonging to the current accession and MD number
    useEffect(() => {
        setTopologies(previousTopologies => [
            ...previousTopologies.filter(top => top.source === accessionAndMdNumber)
        ]);
        setTrajectories(previousTrajectories => [
            ...previousTrajectories.filter(traj => traj.source === accessionAndMdNumber)
        ]);
    }, [accessionAndMdNumber]);

    // If the whole component is removed then abort all requests in case they were not finished
    // DANI: No he verificado que esto funcione bien a nivel de API
    useEffect(() => {
        // I save it in a constant to avoid a non-sense warning
        const redundantList = currentRequests.current;
        return () => {
            redundantList.forEach(request => {
                request.abort();
            });
        };
    }, []);

    // Update the load progress
    useEffect(() => {
        // Make sure we already have components
        if (!components) return;
        const mainComponentTrajectoryURLs = components[0] && components[0].framedURLs;
        if (!mainComponentTrajectoryURLs) return;
        // Get all trajectories to be used as the current main trajecotry
        const mainTrajectories = [];
        mainComponentTrajectoryURLs.forEach(urlpath => {
            const trajectory = trajectories.find(trajectory => trajectory.urlpath === urlpath);
            if (trajectory) mainTrajectories.push(trajectory);
        });
        if (mainTrajectories.length === 0) return;
        // Then calculate the average progress in all loading trajectories and update the progress state
        const overallFrames = mainTrajectories
            .map(trajectory => trajectory.frames)
            .reduce((a, b) => a + b, 0);
        const overallProgress = mainTrajectories
            .map(trajectory => trajectory.progress * trajectory.frames)
            .reduce((a, b) => a + b, 0) / overallFrames;
        onLoad(overallProgress);
    }, [components, trajectories, onLoad]);

    // Return downloaded data
    return { topologies, trajectories, anyLoadingTopology, anyLoadingTrajectory };
}

export default useViewerData;