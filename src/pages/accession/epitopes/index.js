import React, {
  lazy,
  useContext,
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  FormControlLabel,
  Checkbox,
  Typography,
} from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';
import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';

import style from './style.module.css';

import {
  AccessionCtx,
  ProjectCtx,
  PdbCtx,
  ToporefsCtx,
} from '../../../contexts';

import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import useColors from '../../../hooks/use-colors';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import useEpitopesRepresentations from '../../../components/ngl-viewer/use-epitopes-representations';

import {
  absolute2sourceResidue,
  complexSelectionRanger,
  reference2absolute,
} from '../../../utils/topology-manager';

const hoveredEpitopeColor = 'yellow';
const defaultRepresentationsColor = 'black';

const Graph2 = lazy(() =>
  import(/* webpackChunkName: 'graph2' */ '../../../components/graph2'),
);

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

// Set a function to calculate the average value from a values array
const roundedAvg = values => {
  const sum = values.reduce((pv, cv) => pv + cv, 0);
  const length = values.length;
  const average = sum / length;
  const rounded = Math.round(average * 10) / 10;
  return rounded;
};

const Epitopes = () => {
  // Track if the NGL viewer
  // The status isNglVisible is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);
  // Get the toporefs data
  const toporefData = useContext(ToporefsCtx);
  const epitopes = useMemo(() => {
    const epitopes = [];
    toporefData.forEach(toporef => {
      const toporefEpitopes = toporef.epitopes;
      if (!toporefEpitopes) return;
      const formattedEpitopes = Object.entries(toporefEpitopes).map(
        ([name, residues]) => [toporef.name, name, residues],
      );
      epitopes.push(...formattedEpitopes);
    });
    return epitopes;
  }, [toporefData]);

  // This blockRef is a workaround to avoid selecting a row when clicking on the checkbox
  const blockRef = useRef(null);

  // Set a ref to the ngl which allows access to the ngl viewer exposed methods
  const viewerRef = useRef(null);

  // Use the colors hook
  const [getColor, freeColor] = useColors();

  // Track which epitope is beeing hovered in the list
  const [showAllEpitopes, setShowAllEpitopes] = useState(false);

  // Track which epitope is beeing hovered in the list
  const [hoveredEpitope, setHoveredEpitope] = useState(null);
  // Track which epitope is selected by the user
  const [selectedEpitopes, setSelectedEpitopes] = useState([]);

  // Set when one point in the graph is selected
  const [selectedFrame, setSelectedFrame] = useState(0);

  // Send a request to the API with the url of the rgyr analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/sasa/`,
  );

  // Set the epitopes formatted data
  const { data, epitopesData, frameStep, frameCount } = useMemo(() => {
    // Wait for data and metadata to be ready
    if (!payload || !metadata || !pdbData) return {};
    // get the topology data
    const topology = pdbData.file;
    // Get the main data
    const data = payload && payload.data;
    // Calculate the frames step of the first residue SAS analysis
    // All residues must have the same frames step
    const frameCount = data[0].saspf.length;
    const frameStep =
      payload.step || Math.floor(metadata.SNAPSHOTS / (frameCount - 1));
    // Set the input objets for the graph
    const epitopesData = [];
    epitopes.forEach(([toporefName, epitopeName, epitopeResidues]) => {
      // Parse the reference residues list to a mapped NGL selection string
      const mappedResidues = reference2absolute(
        toporefName,
        epitopeResidues,
        metadata,
      );
      // In case the epitope is not found in the current structure we do not push it
      if (mappedResidues.length === 0) return {};
      // Get the SAS values for each residue and add them along frames
      const residuesData = mappedResidues.map(
        residueIndex => data[residueIndex],
      );
      const epitopeData = [];
      for (let i = 0; i < frameCount; i++) {
        const frameData = residuesData.map(residue => residue.saspf[i]);
        const average = frameData.reduce((a, b) => a + b, 0) / frameData.length;
        epitopeData.push(average);
      }
      // Get also the NGL selection from the mapped residues
      const sourceResidues = mappedResidues.map(
        residue => absolute2sourceResidue(residue, topology).numeration,
      );
      const { rangedSelection, small } = complexSelectionRanger(sourceResidues);
      epitopesData.push({
        name: epitopeName,
        data: epitopeData,
        selection: rangedSelection,
        small: small,
      });
    });

    // Instantiate the selected epitopes state using the number of epitopes data
    setSelectedEpitopes(new Array(epitopesData.length).fill(null));

    return { data, epitopesData, frameStep, frameCount };
  }, [payload, metadata, pdbData, epitopes]);

  // Set the main component to be passed to NGL
  const component = useMemo(() => {
    // Load the required frames from the main trajectory
    const trajectoryURL = `${BASE_PATH_PROJECTS}${accession}/files/trajectory?frames=1:${metadata.SNAPSHOTS}:${frameStep}`;

    // The main component, which will include everything
    const component = {
      trajectoryURLs: [trajectoryURL],
    };

    return component;
  }, [accession, metadata, frameStep]);

  // Use this hook to get the memoized NGL default representations
  // We need to access the default representations from here to know the number of representations
  const defaultRepresentations = useDefaultRepresentations();
  const allEpitopesRepresentations = useEpitopesRepresentations();

  // Set the main component to be passed to NGL
  const representations = useMemo(() => {
    if (!epitopesData) return;
    // Reduce the opacity of all default representations and set their color as black
    defaultRepresentations.forEach(representation => {
      representation.opacity = 0.3;
      representation.color = defaultRepresentationsColor;
    });
    // Set representations with the defualt representations by the moment
    const representations = [...defaultRepresentations];
    // In case there are selected epitopes add an extra representation for each one
    selectedEpitopes.forEach((color, i) => {
      if (color === null) return;
      const epitopeData = epitopesData[i];
      const newRepresentation = {
        name: epitopeData.name,
        selection: epitopeData.selection,
        type: epitopeData.small ? 'licorice' : 'cartoon',
        color: color,
      };
      representations.push(newRepresentation);
    });
    // In case the showAllEpitopes is marked show the all epitopes representation
    if (showAllEpitopes) representations.push(...allEpitopesRepresentations);
    // In case the showAllEpitopes is marked show the all epitopes representation
    if (hoveredEpitope !== null) {
      const epitopeData = epitopesData[hoveredEpitope];
      const newRepresentation = {
        name: epitopeData.name,
        selection: epitopeData.selection,
        type: epitopeData.small ? 'licorice' : 'cartoon',
        color: hoveredEpitopeColor,
      };
      representations.push(newRepresentation);
    }
    return representations;
  }, [
    epitopesData,
    selectedEpitopes,
    showAllEpitopes,
    hoveredEpitope,
    defaultRepresentations,
    allEpitopesRepresentations,
  ]);

  component.representations = representations;

  // Set the graph parameters
  const { graphInputData, dataDisplay } = useMemo(() => {
    // Wait for data and metadata to be ready
    if (!data || !metadata) return {};

    // Set the input objets for the graph and when they must be displayed
    const graphInputData = {};
    const dataDisplay = {};
    epitopesData.forEach(({ name, data }, i) => {
      const color = selectedEpitopes[i];
      // Graph
      graphInputData[name] = {
        data: data,
        color: color,
      };
      dataDisplay[name] = selectedEpitopes[i] ? true : false;
    });

    return { graphInputData, dataDisplay };
  }, [data, metadata, epitopesData, selectedEpitopes]);

  // Handle the change of frame
  useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.currentFrame = selectedFrame;
  }, [selectedFrame]);

  // When the user clicks on the graph
  const handleFrameSelection = useCallback(frame => {
    viewerRef.current.togglePlaying(false);
    viewerRef.current.currentFrame = frame;
    //setSelectedFrame(frame);
  }, []);

  // When the ngl is playing
  const handleFrameProgress = useCallback(
    progress => {
      // Process is a float number which ranges from 0 to 1
      // Guess the frame number which belongs to the process
      // WARNING: The follwoing multiplication must return always a whole number
      // WARNING: This 'round' is only for the float problem (e.g. 57 = 56.9999...)
      const frame = Math.round(progress * (frameCount - 1));
      setSelectedFrame(frame);
    },
    [frameCount, setSelectedFrame],
  );

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!metadata || !pdbData.file) return <Loading />;

  return (
    <>
      <Card className={style.tablecard}>
        <div className={style.paper}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell key={0}>
                  {
                    <FormControlLabel
                      onChange={() => setShowAllEpitopes(previous => !previous)}
                      control={<Checkbox checked={showAllEpitopes} />}
                      label={'Epitopes'}
                    />
                  }
                </TableCell>
                <TableCell key={1}>{'Average SAS per atom (Å²)'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {epitopesData.map(
                ({ name: epitopeName, data: epitopeData }, e) => {
                  return (
                    <TableRow
                      key={epitopeName}
                      role="checkbox"
                      className={
                        e === hoveredEpitope ? style.selectedrow : undefined
                      }
                      onMouseOver={() => setHoveredEpitope(e)}
                      onMouseOut={() =>
                        setHoveredEpitope(previous =>
                          previous === e ? null : previous,
                        )
                      }
                    >
                      {[
                        <FormControlLabel
                          data-key={epitopeName}
                          key={epitopeName}
                          onMouseOver={() => {
                            blockRef.current = e;
                          }}
                          onMouseOut={() => {
                            blockRef.current = null;
                          }}
                          onChange={() =>
                            setSelectedEpitopes(previous => {
                              if (!previous[e]) previous[e] = getColor();
                              else {
                                freeColor(previous[e]);
                                previous[e] = null;
                              }
                              return [...previous];
                            })
                          }
                          control={
                            <Checkbox
                              checked={selectedEpitopes[e] ? true : false}
                              style={{
                                color: selectedEpitopes[e]
                                  ? selectedEpitopes[e]
                                  : 'black',
                              }}
                              inputProps={{ 'data-key': epitopeName }}
                            />
                          }
                          label={epitopeName}
                        />,
                        roundedAvg(epitopeData),
                      ].map(cell => (
                        <TableCell key={cell}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  );
                },
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      <Card className={style.nglcard} ref={nglRef}>
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <NGLViewerWithControls
            className={style.container}
            components={[component]}
            onProgress={handleFrameProgress}
            ref={viewerRef}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
      <Card className={style.graph}>
        {selectedEpitopes.every(epitope => epitope === null) && (
          <div className={style['graph-placeholder']}>
            <Typography variant="h6">No epitope selected</Typography>
          </div>
        )}
        <Graph2
          yData={graphInputData}
          step={frameStep}
          xUnit={'frame'}
          xScaleFactor={1}
          xAxisLabel={'Frames'}
          yAxisLabel={`Average SAS per atom (Å²)`}
          showPrecisionSlider={false}
          blockMaxPrecision={true}
          roundcents={false}
          //mean
          //standardDeviation
          onSelect={handleFrameSelection}
          selected={selectedFrame}
          dataDisplay={dataDisplay}
        />
      </Card>
    </>
  );
};

export default Epitopes;
