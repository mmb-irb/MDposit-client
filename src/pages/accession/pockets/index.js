import React, {
  lazy,
  useContext,
  useState,
  useRef,
  useMemo,
  useEffect,
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
} from '@mui/material';

import Card from '../../../components/animated-card';
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';
import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';

import style from './style.module.css';

import { ProjectCtx, PdbCtx } from '../../../contexts';

import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import useColors from '../../../hooks/use-colors';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

const hoveredPocketColor = 'yellow';
const pocketsColor = 'grey';
const surfaceColor = 'grey';
const defaultRepresentationsColor = 'black';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
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

const Pockets = () => {
  // Track if the NGL viewer
  // The status isNglVisible is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the current project metadata
  const { accession, accessionAndMdNumber, metadata } = useContext(ProjectCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);

  // This blockRef is a workaround to avoid selecting a pocket row when clicking on the checkbox
  const blockRef = useRef(null);

  // Set a ref to the ngl which allows access to the ngl viewer exposed methods
  const viewerRef = useRef(null);

  // Use the colors hook
  const [getColor, freeColor] = useColors();

  // Track which pockets is beeing hovered in the list
  const [showAllPockets, setShowAllPockets] = useState(false);

  // Track which pockets is beeing hovered in the list
  const [hoveredPocket, setHoveredPocket] = useState(null);
  // Track which pocket is selected by the user
  const [selectedPockets, setSelectedPockets] = useState([]);

  // Set which representations are shown
  // Note that this state is syncroniced to the representations manager in NGL
  const [showRepresentations, setShowRepresentations] = useState([]);

  // Set the color of each representation
  // Note that this state is syncroniced to the representations manager in NGL
  const [colorRepresentations, setColorRepresentations] = useState([]);

  // Set when one point in the graph is selected
  const [selectedFrame, setSelectedFrame] = useState(0);

  // Send a request to the API with the url of the rgyr analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/pockets/`,
  );

  const { data, frameStep } = useMemo(() => {
    if (!payload) return {};
    // Get the main data
    const data = payload && payload.data;
    const pocketsNumber = data.length;
    // Calculate the frames step of the first pocket volumes analysis
    // All pockets must have the same frames step
    const frameNumber = data[0].volumes.length;
    const frameStep =
      payload.step || Math.floor(metadata.mdFrames / (frameNumber - 1));
    // Instantiate the selected pockets state using the number of pockets
    // Setting the surfaces as hidden by default returns some warnings but everything works fine
    // e.g. 'Unexpected value NaN parsing y1 attribute'
    setSelectedPockets(new Array(pocketsNumber).fill(null));
    return { data, frameStep };
  }, [payload, metadata]);

  // Use this hook to get the memoized NGL default representations
  // We need to access the default representations from here to know the number of representations
  const defaultRepresentations = useDefaultRepresentations();

  // Set the main component to be passed to NGL
  const components = useMemo(() => {
    // Wait for payload to be downloaded
    if (!data) return;

    // Load the required frames from the main trajectory
    const mainURL = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/files/trajectory?frames=1:${metadata.mdFrames}:${frameStep}`;

    // Set the surface representation of each pocket
    const pocketSurfaceRepresentations = data.map(pocket => {
      return {
        name: pocket.name + ' surface',
        selection: '@' + pocket.atoms.join(','),
        type: 'surface',
        color: 'electrostatic',
      };
    });

    // Reduce the opacity of all default representations
    defaultRepresentations.forEach(
      representation => (representation.opacity = 0.3),
    );
    // Set representations by adding default representations and pockets surface representations together
    const representations = [
      ...defaultRepresentations,
      ...pocketSurfaceRepresentations,
    ];

    // The first component, which includes everything but the pockets
    const mainComponent = {
      trajectoryURLs: [mainURL],
      representations: representations,
    };

    const pocketComponents = data.map(pocket => {
      // NGL
      const pocketName = pocket.name;
      const pocketComponent = {
        topologyURL: `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/files/${pocketName}.pdb`,
        onlyTopology: true,
        representations: [
          {
            name: pocketName,
            type: 'surface',
            // Make the surface a transparent net
            other: { contour: true },
            label: pocketName,
          },
        ],
        //chainLabels: [pocketName],
      };
      return pocketComponent;
    });

    const components = [mainComponent, ...pocketComponents];

    // Create an array of 'true' as long as the number of default representations
    const showDefaultRepresentations = Array(
      defaultRepresentations.length,
    ).fill(true);
    // Create an array of 'true' as long as the number of pockets
    const pocketNumber = data.length;
    // Set the default pockets to be shown (none)
    const showPockets = Array(pocketNumber).fill(false);
    // Add the show pockets twice: the first for the surfaces and the second for the pockets themselves
    setShowRepresentations([
      ...showDefaultRepresentations,
      ...showPockets,
      ...showPockets,
    ]);
    // Use the default show to count how many representations we have at the end
    const defaultRepresentationColors = Array(
      defaultRepresentations.length,
    ).fill(defaultRepresentationsColor);
    const surfaceRepresentationColors = Array(showPockets.length).fill(
      surfaceColor,
    );
    const pocketRepresentationColors = Array(showPockets.length).fill(
      pocketsColor,
    );
    // Set the default colors
    setColorRepresentations([
      ...defaultRepresentationColors,
      ...surfaceRepresentationColors,
      ...pocketRepresentationColors,
    ]);

    return components;
  }, [accession, metadata, data, defaultRepresentations, frameStep]);

  // Set the graph parameters
  const { graphInputData, dataDisplay } = useMemo(() => {
    // Wait for data and metadata to be ready
    if (!data || !metadata) return {};

    // Set the input objets for the graph
    const graphInputData = {};
    const dataDisplay = {};

    data.forEach((pocket, p) => {
      const pocketName = pocket.name;
      // Graph
      graphInputData[pocketName] = {
        data: pocket.volumes,
        color: selectedPockets[p],
      };
      dataDisplay[pocketName] = selectedPockets[p] ? true : false;
    });

    return { graphInputData, dataDisplay };
  }, [data, metadata, selectedPockets]);

  // Set the mark for selected
  const marks = useMemo(() => {
    const selectedMark = {
      x: selectedFrame,
      attr: { fill: '#c8c8c8' },
    };
    return [selectedMark];
  }, [selectedFrame]);

  // Set the tooltip generator for the graph hover
  const xTooltip = useMemo(() => {
    return xValue => 'frame ' + xValue;
  });

  // Handle the change of frame
  useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.currentFrame = selectedFrame;
  }, [selectedFrame]);

  // Update the showRepresentations state when the selected or hovered pockets change
  useEffect(() => {
    setShowRepresentations(previous => {
      const pocketsNumber = selectedPockets.length;
      const defaultRepresentationsNumber = previous.length - pocketsNumber * 2;
      // First hide all pockets and surfaces
      for (let i = 0; i < previous.length; i++) {
        if (i < defaultRepresentationsNumber) continue;
        previous[i] = false;
      }
      // Display the selected pockets and their surfaces
      const defaultAndSurfaces = defaultRepresentationsNumber + pocketsNumber;
      selectedPockets.forEach((selected, p) => {
        previous[defaultRepresentationsNumber + p] = selected ? true : false; // The pocket surface
        previous[defaultAndSurfaces + p] = selected ? true : false; // The pocket itself
      });
      // Display the hovered pocket
      if (hoveredPocket !== null) {
        previous[
          defaultRepresentationsNumber + pocketsNumber + hoveredPocket
        ] = true;
      }
      // Show all pockets in case the overall pockets checkbox is selected
      if (showAllPockets)
        for (let i = 0; i < previous.length; i++) {
          if (i < defaultAndSurfaces) continue;
          previous[i] = true;
        }
      return [...previous];
    });
    // Paint selected pockets according to their order of selection and paint the hovered pocket
    setColorRepresentations(previous => {
      const pocketsNumber = selectedPockets.length;
      const defaultRepresentationsNumber = previous.length - pocketsNumber * 2;
      selectedPockets.forEach((selected, p) => {
        //previous[defaultRepresentationsNumber + p] = selected ? selected : surfaceColor; // The pocket surface
        previous[defaultRepresentationsNumber + pocketsNumber + p] = selected
          ? selected
          : pocketsColor; // The pocket itself
      });
      // Display the hovered pocket
      if (hoveredPocket !== null) {
        previous[
          defaultRepresentationsNumber + pocketsNumber + hoveredPocket
        ] = hoveredPocketColor;
      }
      return [...previous];
    });
  }, [selectedPockets, hoveredPocket, showAllPockets]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!metadata || !pdbData.file) return <Loading />;

  return (
    <>
      <Card className={style.tablecard}>
        <div className={style.paper}>
          <Table stickyHeader size="small" padding="checkbox">
            <TableHead>
              <TableRow>
                <TableCell key={0}>
                  {
                    <FormControlLabel
                      onChange={() => setShowAllPockets(previous => !previous)}
                      control={<Checkbox checked={showAllPockets} />}
                      label={'Pockets'}
                    />
                  }
                </TableCell>
                <TableCell key={1}>{'Average volume (Å³)'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((pocket, p) => {
                const pocketName = pocket.name;
                return (
                  <TableRow
                    key={pocketName}
                    // Hover only when it is not already selected
                    //hover={p !== selectedPocket}
                    role="checkbox"
                    className={
                      p === hoveredPocket ? style.selectedrow : undefined
                    }
                    onMouseOver={() => setHoveredPocket(p)}
                    onMouseOut={() =>
                      setHoveredPocket(previous =>
                        previous === p ? null : previous,
                      )
                    }
                  >
                    {[
                      <FormControlLabel
                        data-key={pocketName}
                        key={pocketName}
                        onMouseOver={() => {
                          blockRef.current = p;
                        }}
                        onMouseOut={() => {
                          blockRef.current = null;
                        }}
                        onChange={() =>
                          setSelectedPockets(previous => {
                            if (!previous[p]) previous[p] = getColor();
                            else {
                              freeColor(previous[p]);
                              previous[p] = null;
                            }
                            return [...previous];
                          })
                        }
                        control={
                          <Checkbox
                            checked={selectedPockets[p] ? true : false}
                            style={{
                              color: selectedPockets[p]
                                ? selectedPockets[p]
                                : 'black',
                            }}
                            inputProps={{ 'data-key': pocketName }}
                          />
                        }
                        label={pocketName}
                      />,
                      roundedAvg(pocket.volumes),
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
            //selectedRepresentation={currentPocket.name}
            showRepresentationsForced={[
              showRepresentations,
              setShowRepresentations,
            ]}
            coloringMethodsForced={[
              colorRepresentations,
              setColorRepresentations,
            ]}
            preventTrajectory
            ref={viewerRef}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
      <Card className={style.graph}>
        {selectedPockets.every(pocket => pocket === null) && (
          <div className={style['graph-placeholder']}>
            <Typography variant="h6">No pocket selected</Typography>
          </div>
        )}
        <Graph
          yData={graphInputData}
          step={frameStep}
          xTooltip={xTooltip}
          xScaleFactor={1}
          xAxisLabel={'Frames'}
          yAxisLabel={`Pocket volume (Å³)`}
          dataDisplay={dataDisplay}
          showPrecisionSlider={false}
          blockMaxPrecision={true}
          roundcents={false}
          //mean
          //standardDeviation
          onSelect={setSelectedFrame}
          className={style.graph}
          marks={marks}
        />
      </Card>
    </>
  );
};

export default Pockets;
