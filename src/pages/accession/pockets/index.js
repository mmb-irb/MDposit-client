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
} from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';
import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';

import style from './style.module.css';

import { AccessionCtx, ProjectCtx, PdbCtx } from '../../../contexts';

import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

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

const Pockets = () => {
  // Track if the NGL viewer
  // The status isNglVisible is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the current project metadata
  const { chains, metadata } = useContext(ProjectCtx);
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);

  // This blockRef is a workaround to avoid selecting a pocket row when clicking on the checkbox
  const blockRef = useRef(null);

  // Set a ref to the ngl which allows access to the ngl viewer exposed methods
  const viewerRef = useRef(null);

  // Set which pocket is selected by the user
  const [selectedPocket, setSelectedPocket] = useState(0);

  // Set which pocket is selected by the user
  const [showRepresentations, setShowRepresentations] = useState([]);

  // Set when one point in the graph is selected
  const [selectedFrame, setSelectedFrame] = useState(0);

  // Send a request to the API with the url of the rgyr analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/pockets/`,
  );

  const { data, currentPocket, frameStep } = useMemo(() => {
    if (!payload) return {};
    // Get the main data
    const data = payload && payload.data;

    // Get the selected pocket data
    // There must be always 1 selected pocket
    const currentPocket = data[selectedPocket];

    // Get the frames step of the analysis
    // If the step is missing guess it from the number of frames
    const frameNumber = currentPocket.volumes.length;
    const frameStep =
      payload.step || Math.floor(metadata.SNAPSHOTS / (frameNumber - 1));

    return { data, currentPocket, frameStep };
  }, [payload, metadata, selectedPocket]);

  // Use this hook to get the memoized NGL default representations
  // We need to access the default representations from here to know the number of representations
  const defaultRepresentations = useDefaultRepresentations(chains, metadata);

  // Set the main component to be passed to NGL
  const { components, representationsNumber } = useMemo(() => {
    // Wait for payload to be downloaded
    if (!data || !currentPocket) return {};

    // DANI: Temporalmente se suspende el average
    // Use the average structure to reference the pockets
    //const averageURL = `${BASE_PATH_PROJECTS}${accession}/files/average.bin`;
    // Load the required frames from the main trajectory
    const mainURL = `${BASE_PATH_PROJECTS}${accession}/files/trajectory?frames=1:${metadata.SNAPSHOTS}:${frameStep}`;
    //console.log(mainURL);
    // Set representations
    // Default representations and, if there is a selected frame, the surface of the selected pocket
    const representations = [...defaultRepresentations];
    // Set the surface representation of the pocket
    representations.push({
      name: currentPocket.name + ' surface',
      selection: '@' + currentPocket.atoms.join(','),
      type: 'surface',
      color: 'electrostatic',
    });

    // The first component, which includes everything but the pockets
    const mainComponent = {
      trajectoryURLs: [mainURL],
      // DANI: Temporalmente se suspende el average
      //trajectoryURLs: [averageURL, mainURL],
      representations: representations,
    };

    const representationsNumber = representations.length;

    const pocketComponents = data.map(pocket => {
      // NGL
      const pocketName = pocket.name;
      const pocketComponent = {
        topologyURL: `${BASE_PATH_PROJECTS}${accession}/files/${pocketName}.pdb`,
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
    const showDefaultRepresentations = Array(representationsNumber).fill(true);
    // Create an array of 'true' as long as the number of pockets
    const pocketNumber = data.length;
    const showPockets = Array(pocketNumber).fill(true);
    setShowRepresentations([...showDefaultRepresentations, ...showPockets]);

    return { components, representationsNumber };
  }, [
    accession,
    metadata,
    data,
    defaultRepresentations,
    currentPocket,
    frameStep,
  ]);

  // Set the graph parameters
  const { graphInputData, show } = useMemo(() => {
    // Wait for data and metadata to be ready
    if (!data || !metadata) return {};

    // Set the input objets for the graph
    const graphInputData = {};
    const show = {};

    data.forEach((pocket, p) => {
      const pocketName = pocket.name;
      // Graph
      graphInputData[pocketName] = {
        data: pocket.volumes,
      };
      show[pocketName] = p === selectedPocket;
    });

    return { graphInputData, show };
  }, [data, metadata, selectedPocket]);

  // Handle the change of frame
  useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.currentFrame = selectedFrame;
    // DANI: Temporalmente se suspende el average
    // The first frame (0) is the average
    //if (selectedFrame === null) viewerRef.current.currentFrame = 0;
    //else viewerRef.current.currentFrame = selectedFrame + 1;
  }, [selectedFrame]);

  // Set a function to wrap the 'setSelectedFrame'
  // Make the 'selectedFrame' null when the new frame is the already selected frame
  const handleFrameSelection = useCallback(
    frame => {
      setSelectedFrame(previousFrame => {
        return frame;
        // DANI: Temporalmente se suspende el average
        //if (frame === previousFrame) return null;
        //else return frame;
      });
    },
    [setSelectedFrame],
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
                {['Pocket', 'Average volume (Å³)'].map(name => (
                  <TableCell key={name}>{name}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((pocket, p) => {
                const pocketName = pocket.name;
                return (
                  <TableRow
                    key={pocketName}
                    // Hover only when it is not already selected
                    hover={p !== selectedPocket}
                    role="checkbox"
                    className={
                      p === selectedPocket ? style.selectedrow : undefined
                    }
                    onClick={() => {
                      if (blockRef.current === p) return;
                      return setSelectedPocket(p);
                    }}
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
                          setShowRepresentations(previous => {
                            previous[p + representationsNumber] = !previous[
                              p + representationsNumber
                            ];
                            return [...previous];
                          })
                        }
                        control={
                          <Checkbox
                            checked={
                              showRepresentations[p + representationsNumber]
                            }
                            style={{ color: 'black' }}
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
            selectedRepresentation={currentPocket.name}
            showRepresentationsForced={[
              showRepresentations,
              setShowRepresentations,
            ]}
            preventTrajectory
            ref={viewerRef}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
      <Card className={style.graph}>
        <Graph2
          yData={graphInputData}
          step={frameStep}
          xUnit={'frame'}
          xScaleFactor={1}
          xAxisLabel={'Frames'}
          yAxisLabel={`Pocket volume (Å³)`}
          show={show}
          showPrecisionSlider={false}
          blockMaxPrecision={true}
          roundcents={false}
          mean
          standardDeviation
          onSelect={handleFrameSelection}
          selected={selectedFrame}
        />
      </Card>
    </>
  );
};

export default Pockets;
