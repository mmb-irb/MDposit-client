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
import ViewerWithControls from '../../../components/viewer-with-controls';

import style from './style.module.css';

import { ProjectCtx } from '../../../contexts';

import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import useColors from '../../../hooks/use-colors';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

// Set references to find representations between different renders
const POCKET_REFERENCE = 'pocket';
const POCKET_SURFACE_REFERENCE = 'pocket surface';

// Default value for the 'shaw all pockets' button
const showAllPocketsDefault = false;

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
  const { accessionAndMdNumber, metadata, topology } = useContext(ProjectCtx);

  // This blockRef is a workaround to avoid selecting a pocket row when clicking on the checkbox
  const blockRef = useRef(null);

  // Set a ref to the ngl which allows access to the ngl viewer exposed methods
  const viewerRef = useRef(null);

  // Use the colors hook
  const [getColor, freeColor] = useColors();

  // Track which pockets is beeing hovered in the list
  const [showAllPockets, setShowAllPockets] = useState(showAllPocketsDefault);
  // Track which pockets is beeing hovered in the list
  const [hoveredPocket, setHoveredPocket] = useState(null);

  // Track which pocket is selected by the user
  const [selectedPockets, setSelectedPockets] = useState([]);
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

  // Set the main component to be passed to NGL
  const components = useMemo(() => {
    // Wait for payload to be downloaded
    if (!data) return;
    // Load the required frames from the main trajectory
    const trajectoryUrl = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/trajectory`;
    const mainURL = `${trajectoryUrl}?frames=1:${metadata.mdFrames}:${frameStep}`;
    // Set the main component, which includes everything but the pockets
    const mainComponent = { trajectoryURLs: [mainURL] };
    // Set every pocket component
    const pocketComponents = data.map(pocket => ({
      name: pocket.name,
      topologyURL: `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/files/${pocket.name}.pdb`,
      onlyTopology: true,
      //chainLabels: [pocket.name],
    }));
    return [mainComponent, ...pocketComponents];
  }, [data, accessionAndMdNumber, metadata, frameStep]);

  // Use this hook to get the memoized NGL default representations
  // We need to access the default representations from here to know the number of representations
  const defaultRepresentations = topology && topology.defaultRepresentations;

  // Define the representations to be displayed in the viewer
  const [ representations, setRepresentations ] = useState(null);

  // Set or update the representations state
  useMemo(() => {
    // Wait until we have both the components and the default representations available
    if (!components) return;
    if (!defaultRepresentations || defaultRepresentations.length === 0) return;
    setRepresentations(previousRepresentations => {
      // This must be the first time we set the representations
      // However this may be recalled during a code refresh while in development
      // WARNING: This line may cause a shaddy error, starting representations are made just once
      // Make sure the conditionals above are not met until we are ready to set the representations
      if (previousRepresentations !== null) return previousRepresentations;
      // Reduce the opacity of all default representations
      defaultRepresentations.forEach(rep => {
        rep.color = 'black';
        rep.opacity = 0.3;
      });
      // Set the surface representation of each pocket, which are to be linked to the main component
      const pocketSurfaceRepresentations = data.map(pocket => ({
        name: pocket.name + ' surface',
        selection: '@' + pocket.atoms.join(','),
        type: 'surface',
        color: 'grey',
        show: false,
        reference: POCKET_SURFACE_REFERENCE
      }));
      // Now set a representation for every pocket
      const pocketRepresentations = components.slice(1).map(pocketComponent => ({
        name: pocketComponent.name,
        type: 'surface',
        color: 'grey',
        // Make the surface a transparent net
        other: { contour: true },
        label: pocketComponent.name,
        component: pocketComponent.name,
        show: showAllPocketsDefault,
        reference: POCKET_REFERENCE
      }));
      // Update the state
      const allRepresentations = [
        ...defaultRepresentations,
        ...pocketSurfaceRepresentations,
        ...pocketRepresentations
      ];
      return allRepresentations;
    });
  }, [components, defaultRepresentations]);

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

  // Update the the representations according to selected or hovered pockets
  useEffect(() => {
    setRepresentations(previousRepresentations => {
      // If representations are not yet set then there is nothing to update
      if (previousRepresentations === null) return null;
      // Find previous pocket representations
      const pocketRepresentations = previousRepresentations.filter(
        rep => rep.reference === POCKET_REFERENCE);
      // Update pocket representations
      pocketRepresentations.forEach((previousRepresentation, i) => {
        // If this is the hovered pocket then show it and paint it yellow
        if (hoveredPocket === i) {
          previousRepresentation.show = true;
          previousRepresentation.color = 'yellow';
        }
        // Otherwise continue with normal behaviour
        else {
          const selected = selectedPockets[i];
          previousRepresentation.show = (selected ? true : false) || showAllPockets;
          previousRepresentation.color = selected || 'grey';
        }
      });
      // Find previous pocket surface representations
      const pocketSurfaceRepresentations = previousRepresentations.filter(
        rep => rep.reference === POCKET_SURFACE_REFERENCE);
      // Update pocket surface representations
      pocketSurfaceRepresentations.forEach((previousRepresentation, i) => {
        const selected = selectedPockets[i];
        previousRepresentation.show = selected ? true : false;
      });
      // Update the state
      return [...previousRepresentations];
    })
  }, [selectedPockets, hoveredPocket, showAllPockets]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!metadata) return <Loading />;

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
          <ViewerWithControls
            className={style.container}
            startingComponents={components}
            representationsState={[representations, setRepresentations]}
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
