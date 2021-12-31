import React, {
  lazy,
  useContext,
  useState,
  useRef,
  useMemo,
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
  getAtomsCount,
  byChains,
} from '../../../utils/topology-manager';

const hoveredEpitopeColor = 'yellow';
const defaultRepresentationsColor = 'black';

const dashStyles = [
  null,
  '10, 4',
  '4, 4',
  '10, 4, 1, 4',
  '10, 4, 1, 4, 1, 4',
  '1, 4',
];

const Graph2 = lazy(() =>
  import(/* webpackChunkName: 'graph2' */ '../../../components/graph2'),
);

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

// Get a number after rounding to decimals
const decimalRound = value => Math.round(value * 10) / 10;
// Set a function to calculate the average value from a values array
const roundedAvg = values => {
  const sum = values.reduce((pv, cv) => pv + cv, 0);
  const length = values.length;
  const average = sum / length;
  const rounded = decimalRound(average);
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
        ([name, epitope]) => [toporef.name, name, epitope.residues, epitope.mas],
      );
      epitopes.push(...formattedEpitopes);
    });
    return epitopes;
  }, [toporefData]);

  // This blockRef is a workaround to avoid selecting a row when clicking on the checkbox
  const blockRef = useRef(null);

  // Set a ref to the ngl which allows access to its exposed methods
  const viewerRef = useRef(null);
  // Set a ref to the graph which allows access to its exposed methods
  const graphRef = useRef(null);

  // Use the colors hook
  const [getColor, freeColor] = useColors();

  // Track which epitope is beeing hovered in the list
  const [showAllEpitopes, setShowAllEpitopes] = useState(false);

  // Track which epitope is beeing hovered in the list
  const [hoveredEpitope, setHoveredEpitope] = useState(null);
  // Track which epitope is selected by the user
  const [selectedEpitopes, setSelectedEpitopes] = useState([]);

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
    epitopes.forEach(([toporefName, epitopeName, epitopeResidues, epitopeSurface]) => {
      // Parse the reference residues list to a mapped NGL selection string
      const mappedResidues = reference2absolute(
        toporefName,
        epitopeResidues,
        metadata,
      );
      // In case the epitope is not found in the current structure we do not push it
      if (mappedResidues.length === 0) return {};
      const chainedResidues = byChains(mappedResidues, topology);
      const chains = Object.keys(chainedResidues);
      // Get the SAS values for each residue in each chain
      const chainedResiduesData = {};
      Object.entries(chainedResidues).forEach(([chain, residues]) => {
        const residuesData = residues.map(residueIndex => {
          const residueData = data[residueIndex];
          residueData.atoms = getAtomsCount(residueIndex, topology);
          return residueData;
        });
        chainedResiduesData[chain] = residuesData;
      });
      // Add SAS values along frames for each chain
      // Calculate the averages of each chain and prepare a string summary for display
      const chainedFramedData = {};
      const summary = [];
      Object.entries(chainedResiduesData).forEach(([chain, residuesData]) => {
        const framedData = [];
        for (let i = 0; i < frameCount; i++) {
          const residuesSAS = residuesData.map(
            residue => residue.saspf[i] * residue.atoms,
          );
          const totalSAS = residuesSAS.reduce((a, b) => a + b, 0);
          framedData.push(totalSAS);
        }
        const chainSummary = chain + ': ' + roundedAvg(framedData) + ' / ' + decimalRound(epitopeSurface);
        summary.push(chainSummary);
        chainedFramedData[chain] = framedData;
      });
      // Get also the NGL selection from the mapped residues
      // This is not separated in chains so the selection is for all chains together
      const sourceResidues = mappedResidues.map(
        residue => absolute2sourceResidue(residue, topology).numeration,
      );
      const { rangedSelection, small } = complexSelectionRanger(sourceResidues);
      epitopesData.push({
        name: epitopeName,
        data: chainedFramedData,
        selection: rangedSelection,
        small: small,
        chains: chains,
        summary: summary.join('\n'),
      });
    });

    // Instantiate the selected epitopes state using the number of epitopes data
    setSelectedEpitopes(new Array(epitopesData.length).fill(null));

    return { data, epitopesData, frameStep, frameCount };
  }, [payload, metadata, pdbData, epitopes]);

  // Use this hook to get the memoized NGL default representations
  const defaultRepresentations = useDefaultRepresentations();
  // Use this hook to get the memoized NGL epitopes representations
  const allEpitopesRepresentations = useEpitopesRepresentations();

  // Set the main component to be passed to NGL
  const components = useMemo(() => {
    // Load the required frames from the main trajectory
    const trajectoryURL = `${BASE_PATH_PROJECTS}${accession}/files/trajectory?frames=1:${metadata.SNAPSHOTS}:${frameStep}`;
    // Reduce the opacity of all default representations and set their color as black
    defaultRepresentations.forEach(representation => {
      representation.opacity = 0.3;
      representation.color = defaultRepresentationsColor;
    });

    // The main component, which will include everything
    const mainComponent = {
      trajectoryURLs: [trajectoryURL],
      representations: defaultRepresentations,
    };

    return [mainComponent];
  }, [accession, metadata, frameStep, defaultRepresentations]);

  // Set the main component to be passed to NGL
  const snapRepresentations = useMemo(() => {
    if (!epitopesData) return;
    // Set representations with the defualt representations by the moment
    const representations = [];
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
    allEpitopesRepresentations,
  ]);

  // Set the graph parameters
  const graphInputData = useMemo(() => {
    // Wait for data and metadata to be ready
    if (!data || !metadata) return;

    // Set the input objets for the graph and when they must be displayed
    const graphInputData = {};
    epitopesData.forEach(({ name, data }, i) => {
      if (!selectedEpitopes[i]) return;
      const color = selectedEpitopes[i];
      // Graph
      Object.entries(data).forEach(([chain, chainData], index) => {
        const tag = name + '-' + chain;
        const dash = dashStyles[index];
        graphInputData[tag] = {
          data: chainData,
          color: color,
          dash: dash,
        };
      });
    });

    return graphInputData;
  }, [data, metadata, epitopesData, selectedEpitopes]);

  // When the user clicks on the graph
  const handleFrameSelection = useCallback(frame => {
    viewerRef.current.togglePlaying(false);
    viewerRef.current.currentFrame = frame;
  }, []);

  // When the ngl frame changes
  const handleFrameProgress = useCallback(
    progress => {
      // Process is a float number which ranges from 0 to 1
      // Guess the frame number which belongs to the process
      // WARNING: The follwoing multiplication must return always a whole number
      // WARNING: This 'round' is only for the float problem (e.g. 57 = 56.9999...)
      const frame = Math.round(progress * (frameCount - 1));
      graphRef.current.marks = [
        {
          x: frame,
          attr: { fill: '#c8c8c8' },
        },
      ];
    },
    [frameCount],
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
          <Table stickyHeader size="small">
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
                <TableCell key={1}>{'Average SAS (Å²)'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {epitopesData.map(({ name: epitopeName, summary }, e) => {
                return (
                  <TableRow
                    key={epitopeName}
                    role="checkbox"
                    className={
                      e === hoveredEpitope ? style.selectedrow : style.row
                    }
                    onMouseEnter={() => setHoveredEpitope(e)}
                    onMouseLeave={() =>
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
                      summary,
                    ].map(cell => (
                      <TableCell key={cell}>{cell}</TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
      <Card className={style.nglcard} ref={nglRef}>
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <NGLViewerWithControls
            className={style.container}
            components={components}
            snapRepresentations={snapRepresentations}
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
          yAxisLabel={`SAS (Å²)`}
          showPrecisionSlider={false}
          blockMaxPrecision={true}
          roundcents={false}
          onSelect={handleFrameSelection}
          displayLegend
          className={style.graph}
          ref={graphRef}
        />
      </Card>
    </>
  );
};

export default Epitopes;
