import React, { lazy, Suspense, useState, useContext, useMemo, useRef, useEffect, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';

import {
    CardContent,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    FormControlLabel,
    Checkbox,
} from '@mui/material';

import Card from '../../../components/animated-card';
import ViewerWithControls from '../../../components/viewer-with-controls';
import Loading from '../../../components/loading';
import useAPI from '../../../hooks/use-api';
import { ProjectCtx } from '../../../contexts';
import { BASE_PATH_PROJECTS } from '../../../utils/constants';
import { getMean } from '../../../utils/statistics';
import style from './style.module.css';
import ColorLegend from '../../../components/color-legend';
import { ColormakerRegistry } from 'ngl';


const Graph = lazy(() =>
    import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);
const colors = ['green', 'blue', 'red'];
// To see the available schemes log ColormakerRegistry.userSchemes or ColormakerRegistry.schemes
const generateScheme = (frame, data, std1) => {
    return ColormakerRegistry.addScheme(function (params) {
        this.atomColor = function (atom) {
            let midplane_z = data.midplane_z[frame];
            let std = 3 * std1;
            let zPos = atom.z - midplane_z;
            let ratio, r, g, b, layerZ;
            if (zPos > 0) { // top leaflet
                layerZ = data.mean_positive[frame];
            } else { // bottom leaflet
                layerZ = -1 * data.mean_negative[frame];
                zPos = -zPos;
            }

            if (zPos >= layerZ) { // thickening
                ratio = (zPos - layerZ) / std;
                ratio = Math.min(1, ratio);
                r = Math.floor(255 * (1 - ratio));
                g = Math.floor(255 * (1 - ratio));
                b = 255;
            } else { // thinning
                ratio = -(zPos - layerZ) / std;
                ratio = Math.min(1, ratio);
                r = 255;
                g = Math.floor(255 * (1 - ratio));
                b = Math.floor(255 * (1 - ratio));
            }
            return (r << 16) + (g << 8) + b;
        };
    }, 'distorsion');
};

const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const Thickness = () => {
    // Get the metadata
    const { accessionAndMdNumber, metadata, chains, topology } = useContext(ProjectCtx);

    // Send a request to the API with the url of the specific analysis
    const {
        loading: thicknessLoading,
        payload: thicknessPayload,
        error: thicknessError,
    } = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/thickness/`);
    // Get the membrane map
    const {
        loading: memMapLoading,
        payload: memMapPayload,
        error: memMapError,
    } = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/mem-map/`);

    // Set which thickness components to display
    const [display, setDisplay] = useState({});
    // Track if the NGL viewer is visible
    const [nglRef, isNglVisible] = useInView(useInViewOptions);
    const viewerRef = useRef(null);
    // Use default representations hook
    const defaultRepresentations = topology && topology.defaultRepresentations;
    // Define the representations to be displayed in the viewer
    const [representations, setRepresentations] = useState(null);
    // Initialize an empty dictionary for the schemes
    const schemes = useRef({});
    // Function to get or generate a scheme for a specific frame
    const getSchemeForFrame = (frame, data, std1) => {
        if (!schemes.current[frame]) {
            schemes.current[frame] = generateScheme(frame, data, std1);
        }
        return schemes.current[frame];
    };

    // Format the data
    const {
        thicknessData,
        frameStep,
        xAxisStep,
        xAxisLabel,
        isEnsemble,
        xTooltip,
        xValues,
        defaultDisplay
    } = useMemo(() => {
        if (!thicknessPayload || !thicknessPayload.data) return {};

        const thicknessData = {
            'Membrane': {
                data: thicknessPayload.data.thickness,
                color: colors[0],
                average: getMean(thicknessPayload.data.thickness),
                mean_stddev: getMean(thicknessPayload.data.std_thickness),
                areaStdDev: thicknessPayload.data.std_thickness
            },
            'Upper leaflet': {
                data: thicknessPayload.data.mean_positive,
                color: colors[1],
                average: getMean(thicknessPayload.data.mean_positive),
                mean_stddev: getMean(thicknessPayload.data.std_positive),
                areaStdDev: thicknessPayload.data.std_positive
            },
            'Lower leaflet': {
                data: thicknessPayload.data.mean_negative,
                color: colors[2],
                average: getMean(thicknessPayload.data.mean_negative),
                mean_stddev: getMean(thicknessPayload.data.std_negative),
                areaStdDev: thicknessPayload.data.std_negative
            }
        };

        const frameStep = thicknessPayload.data.step;
        const defaultDisplay = {
            'Membrane': true,
            'Upper leaflet': true,
            'Lower leaflet': true
        };

        const isEnsemble = metadata.TYPE === 'ensemble';
        const framesTimeStep = metadata.FRAMESTEP;
        let xAxisStep, xAxisLabel, xTooltip;
        if (isEnsemble || !framesTimeStep) {
            xAxisStep = frameStep;
            xAxisLabel = 'Frames';
            xTooltip = xValue => 'frame ' + xValue;
        }
        else {
            const analysisTimeStep = frameStep * framesTimeStep
            xAxisStep = analysisTimeStep;
            xAxisLabel = 'Time (ns)';
            xTooltip = xValue => +xValue.toFixed(2) + ' ns';
        }
        return {
            thicknessData,
            frameStep: frameStep,
            xAxisStep: xAxisStep,
            xAxisLabel: xAxisLabel,
            isEnsemble,
            xTooltip: xTooltip,
            xValues: thicknessPayload.data.frame,
            defaultDisplay
        };
    }, [metadata, thicknessPayload]);

    // Add useEffect to set initial display state
    useMemo(() => {
        if (defaultDisplay) {
            setDisplay(defaultDisplay);
        }
    }, [defaultDisplay]);

    // Set when one point in the graph is selected
    const [selected, setSelected] = useState(-100);
    // When the user clicks on the graph
      const handleFrameSelection = useCallback(frame => {
        viewerRef.current.togglePlaying(false);
        viewerRef.current.currentFrame = frame;
        setSelected(frame);
      }, []);

    // Set the mark for selected
    const marks = useMemo(() => {
        const selectedMark = {
            x: selected,
            attr: { fill: '#c8c8c8' },
        };
        return [selectedMark];
    }, [selected]);

    // Handle the change of frame
    useEffect(() => {
        if (!viewerRef.current) return;
        viewerRef.current.currentFrame = selected;
    }, [selected]);

    // Set the main component to be passed to NGL
    const components = useMemo(() => {
        // Wait for payload to be downloaded
        if (!thicknessData) return;
        // Load the required frames from the main trajectory
        const trajectoryUrl = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/trajectory`;
        const mainURL = `${trajectoryUrl}?frames=1:${metadata.mdFrames}:${frameStep}`;
        // Set the main component, which includes everything but the pockets
        const mainComponent = { trajectoryURLs: [mainURL] };
        return [mainComponent];
    }, [accessionAndMdNumber, metadata, frameStep]);

    // Set or update the representations state
    useMemo(() => {
        if (!components || !thicknessPayload.data || !memMapPayload) return;
        if (!defaultRepresentations || defaultRepresentations.length === 0) return;
        const keepRepresentations = defaultRepresentations.filter(rep => (rep.name !== 'M' && rep.name !== 'Membrane'));
        setRepresentations(previous => {
            if (previous !== null) return previous;
            keepRepresentations.forEach(rep => {
                if (rep.name == 'Protein' || chains.indexOf(rep.selection.slice(1,2)) !== -1) {
                    rep.color = 'grey';
                }
            });

            let distRepr = [{
                name: 'Upper leaflet',
                type: 'ball+stick',
                opacity: 1,
                selection: '@' + memMapPayload.mems[0].polar_atoms.top.join(','),
                other: { radius: 0.75 },
                color: getSchemeForFrame(0, thicknessPayload.data, thicknessData.Membrane.mean_stddev),
                customScheme: 'distorsion',
            },
            {
                name: 'Lower leaflet',
                type: 'ball+stick',
                opacity: 1,
                selection: '@' + memMapPayload.mems[0].polar_atoms.bot.join(','),
                other: { radius: 0.75 },
                color: getSchemeForFrame(0, thicknessPayload.data, thicknessData.Membrane.mean_stddev),
                customScheme: 'distorsion',
            }]
            return [...keepRepresentations, ...distRepr];
        });
    }, [components, defaultRepresentations, thicknessPayload, memMapPayload, thicknessData]);

    // Update the the representations according to selected or hovered pockets
    useEffect(() => {
        if (!representations || representations.length === 0) return;
        setRepresentations(previousRepresentations => { 
        // Update chain representations
        previousRepresentations.forEach( previousRepresentation => {
            if (previousRepresentation.name.endsWith('leaflet'))
                previousRepresentation.show = display[previousRepresentation.name] ? true : false;
        });
        // Update the state
        return [...previousRepresentations];
        })
    }, [display]);

    const updateColor = useCallback(progress => {
        if (!thicknessPayload || !thicknessPayload.data) return {};
        const frame = viewerRef.current.currentFrame;
        setRepresentations(previousRepresentations => {
            previousRepresentations.forEach(rep => {
                if (rep.name.endsWith('leaflet'))
                    rep.color = getSchemeForFrame(frame, thicknessPayload.data, thicknessData.Membrane.mean_stddev);
            });
            return [...previousRepresentations];
        });
        setSelected(frame);
    }, [thicknessPayload]);

    // Render loading or error states
    if (thicknessLoading) return <Loading />;
    else if (thicknessError) return thicknessError.toString();
    else if (!thicknessPayload) return 'Something bad happened loading thickness data';
    const cents = num => Math.round(num * 100) / 100;
    //console.log('Render')

    // Render
    return (
        <Suspense fallback={<Loading />}>
            <Card className={style.tablecard}>
                <div className={style.paper} >
                    <Table padding="checkbox">
                        <TableHead>
                            <TableRow>
                                <TableCell>selected chains</TableCell>
                                <TableCell>{`mean`}</TableCell>
                                <TableCell>{`mean of standard deviations`}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Object.entries(thicknessData).map(([key, thickness], i) => (
                                <TableRow key={key}>
                                    <TableCell>
                                        {
                                            <FormControlLabel
                                                onChange={() =>
                                                    setDisplay(previous => {
                                                        previous[key] = !previous[key];
                                                        return { ...previous };
                                                    })
                                                }
                                                control={
                                                    <Checkbox
                                                        checked={display[key]}
                                                        style={{ color: colors[i] }}
                                                    />
                                                }
                                                label={key}
                                            />
                                        }
                                    </TableCell>
                                    <TableCell>{cents(thickness.average)}</TableCell>
                                    <TableCell>{cents(thickness.mean_stddev)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Card>
            <Card className={style.legend_container}>
                <ColorLegend
                    title={'Distortion (Å)'}
                    minValue={-thicknessData.Membrane.mean_stddev}
                    maxValue={thicknessData.Membrane.mean_stddev}
                    colorPlan={['red', 'white', 'blue']}
                    vertical={true}
                    className={style.legend}
                    flip={true}
                />
            </Card>
            <Card className={style.nglcard} ref={nglRef}>
                {isNglVisible ? (
                    <ViewerWithControls
                        className={style.container}
                        startingComponents={components}
                        representationsState={[representations, setRepresentations]}
                        onProgress={updateColor}
                        ref={viewerRef}
                        rotateX={true}
                    />
                ) : (
                    <div style={{ height: '50vh' }} />
                )}
            </Card>
            <Card className={style.graph}>
                <CardContent>
                    <Graph
                        yData={thicknessData}
                        step={xAxisStep}
                        xAxisLabel={xAxisLabel}
                        xAxisValues={xValues}
                        xTooltip={xTooltip}
                        yAxisLabel={'Thickness'}
                        onSelect={handleFrameSelection}
                        selfLegend={false}
                        dataDisplay={display}
                        marks={marks}
                        areaStdDev={true}
                        className={style.graph}
                        zeroLine={true}
                        margin={{ top: 10, right: 10, bottom: 30, left: 10 }}
                        yPadding={thicknessData.Membrane.mean_stddev}
                    />
                </CardContent>
            </Card>
        </Suspense>
    );
};

Thickness.displayName = 'Thickness'
export default Thickness;
