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
  TableFooter,
  TablePagination,
  FormControlLabel,
  Checkbox,
  Typography,
} from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';
import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';

import style from './style.module.css';

import { AccessionCtx, ProjectCtx } from '../../../contexts';

import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import useColors from '../../../hooks/use-colors';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import useEpitopesRepresentations from '../../../components/ngl-viewer/use-epitopes-representations';

import { complexSelectionRanger } from '../../../utils/topology-manager';

const pdbUrlBase = 'https://www.rcsb.org/structure/';

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

const rowsPerPageDefault = 10;
const rowsPerPageOptions = [10, 25, 50, 100];

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
  const {
    metadata,
    references: referenceData,
    topology: topologyManager,
  } = useContext(ProjectCtx);
  // Get the accession
  const accession = useContext(AccessionCtx);

  // Get the references data
  const epitopes = useMemo(() => {
    const epitopes = [];
    referenceData.forEach(reference => {
      const referenceEpitopes = reference.epitopes;
      if (!referenceEpitopes) return;
      const formattedEpitopes = Object.entries(referenceEpitopes).map(
        ([name, epitope]) => [
          reference.name,
          name,
          epitope.residues,
          epitope.mas,
        ],
      );
      epitopes.push(...formattedEpitopes);
    });
    return epitopes;
  }, [referenceData]);

  // This blockRef is a workaround to avoid selecting a row when clicking on the checkbox
  const blockRef = useRef(null);

  // Set a ref to the table to access its scroll parameters
  const tableRef = useRef(null);
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

  // Table pagination states
  const [selectedPage, setSelectedPage] = useState(0);
  const [selectedRowsPerPage, setSelectedRowsPerPage] = useState(
    rowsPerPageDefault,
  );

  // Send a request to the API with the url of the rgyr analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/sasa/`,
  );

  // Set the epitopes formatted data
  const { data, epitopesData, frameStep, frameCount } = useMemo(() => {
    // Wait for data and metadata to be ready
    if (!payload || !metadata || !topologyManager) return {};
    // Get the main data
    const data = payload && payload.data;
    // Calculate the frames step of the first residue SAS analysis
    // All residues must have the same frames step
    const frameCount = data[0].saspf.length;
    const frameStep =
      payload.step || Math.floor(metadata.SNAPSHOTS / (frameCount - 1));
    // Set the input objets for the graph
    const epitopesData = [];
    epitopes.forEach(
      ([referenceName, epitopeName, epitopeResidues, epitopeSurface]) => {
        // Parse the reference residues list to a mapped NGL selection string
        const mappedResidues = topologyManager.reference2absolute(
          referenceName,
          epitopeResidues,
        );
        // In case the epitope is not found in the current structure we do not push it
        if (mappedResidues.length === 0) return {};
        const chainedResidues = topologyManager.byChains(mappedResidues);
        const chains = Object.keys(chainedResidues);
        // Get the SAS values for each residue in each chain
        const chainedResiduesData = {};
        Object.entries(chainedResidues).forEach(([chain, residues]) => {
          const residuesData = residues.map(residueIndex => {
            const residueData = data[residueIndex];
            residueData.atoms = topologyManager.getResidueAtomsCount(
              residueIndex,
            );
            return residueData;
          });
          chainedResiduesData[chain] = residuesData;
        });
        // Handle epitope SAS for each chain independently
        const chainedFramedData = {};
        const summary = [];
        Object.entries(chainedResiduesData).forEach(([chain, residuesData]) => {
          // It may happen that the epitope is found several times in a single chain
          // In this case we have to found hoy many times it is there in order to multiply de epitope surface
          // WARNING: If any epitope is only partially in the structure then we are introducing an error with this multiplication
          // WARNING: We must then mark the percent to warn the user
          const epitopeCoverage = residuesData.length / epitopeResidues.length;
          const fullEpitopeCoverage = epitopeCoverage % 1 === 0;
          const totalEpitopeSurface = epitopeSurface * epitopeCoverage;
          // Add SAS values along frames for each chain
          const sasPerFrame = [];
          const exposurePerFrame = [];
          for (let i = 0; i < frameCount; i++) {
            const residuesSAS = residuesData.map(
              residue => residue.saspf[i] * residue.atoms,
            );
            const totalSAS = residuesSAS.reduce((a, b) => a + b, 0);
            sasPerFrame.push(totalSAS);
            const exposure = (totalSAS / totalEpitopeSurface) * 100;
            exposurePerFrame.push(exposure);
          }
          // Calculate the averages of each chain and prepare a string summary for display
          const averageSAS = roundedAvg(sasPerFrame);
          const averageExposure = decimalRound(
            (averageSAS / totalEpitopeSurface) * 100,
          );
          const chainSummary = `${chain}:${averageSAS} Å² (${averageExposure}%)${
            fullEpitopeCoverage ? '' : '*'
          }`;
          summary.push(chainSummary);
          //chainedFramedData[chain] = sasPerFrame;
          chainedFramedData[chain] = exposurePerFrame;
        });
        // Get also the NGL selection from the mapped residues
        // This is not separated in chains so the selection is for all chains together
        const sourceResidues = mappedResidues.map(
          residue => topologyManager.absolute2sourceResidue(residue).numeration,
        );
        const { rangedSelection, small } = complexSelectionRanger(
          sourceResidues,
        );
        epitopesData.push({
          name: epitopeName,
          data: chainedFramedData,
          selection: rangedSelection,
          small: small,
          chains: chains,
          summary: summary.join('\n'),
        });
      },
    );

    // Instantiate the selected epitopes state using the number of epitopes data
    setSelectedEpitopes(new Array(epitopesData.length).fill(null));

    return { data, epitopesData, frameStep, frameCount };
  }, [payload, metadata, topologyManager, epitopes]);

  // Use this hook to get the memoized NGL default representations
  const defaultRepresentations = useDefaultRepresentations();
  // Use this hook to get the memoized NGL epitopes representations
  const allEpitopesRepresentations = useEpitopesRepresentations();

  // Set the main component to be passed to NGL
  const components = useMemo(() => {
    // Load the required frames from the main trajectory
    const trajectoryURL = `${BASE_PATH_PROJECTS}${accession}/files/trajectory?frames=1:${metadata.SNAPSHOTS}:${frameStep}`;
    // Set the representations
    const representations = [];
    // Reduce the opacity of all default representations and set their color as black
    defaultRepresentations.forEach(representation => {
      representation.opacity = 0.3;
      representation.color = defaultRepresentationsColor;
      representations.push(representation);
    });
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

    // The main component, which will include everything
    const mainComponent = {
      trajectoryURLs: [trajectoryURL],
      representations: representations,
    };

    return [mainComponent];
  }, [
    accession,
    metadata,
    epitopesData,
    frameStep,
    defaultRepresentations,
    selectedEpitopes,
    showAllEpitopes,
    allEpitopesRepresentations,
  ]);

  // Set the main component to be passed to NGL
  const snapRepresentations = useMemo(() => {
    if (!epitopesData) return;
    const representations = [];
    // In case the showAllEpitopes is marked show the all epitopes representation
    if (hoveredEpitope !== null) {
      const epitopeData = epitopesData[hoveredEpitope];
      const newRepresentation = {
        name: epitopeData.name,
        selection: epitopeData.selection,
        type: 'spacefill',
        color: hoveredEpitopeColor,
        opacity: 0.15,
      };
      representations.push(newRepresentation);
    }
    return representations;
  }, [epitopesData, hoveredEpitope]);

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

  if (!topologyManager) return <Loading />;

  const firstEpitopeIndex = selectedPage * selectedRowsPerPage;
  const lastEpitopeIndex = (selectedPage + 1) * selectedRowsPerPage;

  return (
    <>
      <Card className={style.tablecard}>
        <div className={style.paper} ref={tableRef}>
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
                <TableCell key={1}>{'Average SAS and exposure'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {epitopesData
                .slice(firstEpitopeIndex, lastEpitopeIndex)
                .map(({ name: epitopeName, summary }, e) => {
                  const num = selectedPage * selectedRowsPerPage + e;
                  return (
                    <TableRow
                      key={epitopeName}
                      role="checkbox"
                      className={
                        num === hoveredEpitope ? style.selectedrow : style.row
                      }
                      onMouseEnter={() => setHoveredEpitope(num)}
                      onMouseLeave={() =>
                        setHoveredEpitope(previous =>
                          previous === num ? null : previous,
                        )
                      }
                    >
                      {[
                        <FormControlLabel
                          data-key={epitopeName}
                          key={epitopeName}
                          onMouseOver={() => {
                            blockRef.current = num;
                          }}
                          onMouseOut={() => {
                            blockRef.current = null;
                          }}
                          onChange={() =>
                            setSelectedEpitopes(previous => {
                              if (!previous[num]) previous[num] = getColor();
                              else {
                                freeColor(previous[num]);
                                previous[num] = null;
                              }
                              return [...previous];
                            })
                          }
                          control={
                            <Checkbox
                              checked={selectedEpitopes[num] ? true : false}
                              style={{
                                color: selectedEpitopes[num]
                                  ? selectedEpitopes[num]
                                  : 'black',
                              }}
                              inputProps={{ 'data-key': epitopeName }}
                            />
                          }
                          label={
                            <a
                              href={pdbUrlBase + epitopeName}
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              {epitopeName}
                            </a>
                          }
                        />,
                        summary,
                      ].map(cell => (
                        <TableCell key={cell}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  );
                })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={rowsPerPageOptions} // Optional numbers of rows displayed in each page. It can be modified by the user.
                  colSpan={4} // Set the anchor of columns which is taken as a reference for the horizontal position of the footer
                  count={epitopesData.length} // Total number of rows
                  rowsPerPage={selectedRowsPerPage} // The actual number of rows displayed
                  page={selectedPage} // The actual page
                  onChangePage={(_, page) => {
                    setSelectedPage(page);
                    // Scroll to the top of the table
                    tableRef.current.scrollTop = 0;
                  }}
                  onChangeRowsPerPage={({ target: { value } }) => {
                    setSelectedRowsPerPage(value);
                    setSelectedPage(0);
                  }}
                />
              </TableRow>
            </TableFooter>
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
          yAxisLabel={`Exposure (%)`}
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
