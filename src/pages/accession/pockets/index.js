import React, { lazy, useContext, useState, useRef, useMemo } from 'react';
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
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';

import style from './style.module.css';

import { AccessionCtx, ProjectCtx, PdbCtx } from '../../../contexts';

import Info from '../../../components/info';
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

  // Set which pocket is selected by the user
  const [selectedPocket, setSelectedPocket] = useState(0);

  // Set which pocket is selected by the user
  const [showRepresentations, setShowRepresentations] = useState([]);

  // Set when one point in the graph is selected
  const [selectedFrame, setSelectedFrame] = useState(null);

  // Send a request to the API with the url of the rgyr analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/pockets/`,
  );

  // Use this hook to get the memoized NGL default representations
  // We need to access the default representations from here to know the number of representations
  const defaultRepresentations = useDefaultRepresentations(chains, metadata);

  // Set the components to be passed to NGL
  const { data, components, representationsNumber } = useMemo(() => {
    // Wait for payload to be downloaded
    if (!payload) return {};

    const data = payload.data;

    // Set a new NGL component for each pocket
    const pocketComponents = [];
    data.forEach(pocket => {
      // NGL
      const pocketName = pocket.name;
      const pocketComponent = {
        topologyURL: `${BASE_PATH_PROJECTS}${accession}/files/${pocketName}.pdb`,
        onlyTopology: true,
        representations: [
          {
            name: pocketName,
            defaultDrawingMethod: 'surface',
            // Make the surface a transparent net
            other: { contour: true },
            label: pocketName,
          },
        ],
        //chainLabels: [pocketName],
      };
      pocketComponents.push(pocketComponent);
    });
    // Use the average structure to reference the pockets (only backbone right now)
    const averageURL = `${BASE_PATH_PROJECTS}${accession}/files/average.bin`;
    // Set first the default representations object
    const components = [
      {
        trajectoryURL: averageURL,
        //frame: 0,
        //onlyTopology: true,
        representations: defaultRepresentations,
      },
      ...pocketComponents,
    ];

    const representationsNumber = defaultRepresentations
      ? defaultRepresentations.length
      : undefined;

    // Create an array of 'true' as long as the number of default representations
    const showDefaultRepresentations = Array(representationsNumber).fill(true);
    // Create an array of 'true' as long as the number of pockets
    const pocketNumber = data.length;
    const showPockets = Array(pocketNumber).fill(true);
    setShowRepresentations([...showDefaultRepresentations, ...showPockets]);

    return { data, components, representationsNumber };
  }, [accession, payload, defaultRepresentations]);

  const { graphInputData, show, xAxisValues, currentPocket } = useMemo(() => {
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

    // Set the xAxis values: frame numbers
    const currentPocket = data[selectedPocket];
    const dataLength = currentPocket.volumes.length;
    const xAxisStep = Math.floor(metadata.SNAPSHOTS / (dataLength - 1));
    const xAxisValues = Array(dataLength)
      .fill(undefined)
      .map((v, i) => i * xAxisStep);

    return { graphInputData, show, xAxisValues, currentPocket };
  }, [data, metadata, selectedPocket]);

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
                {['Pocket', 'Average volume'].map(name => (
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
        <Info
          reference={'electrostatic'}
          tooltip={
            <>
              This is the pockets representation.
              <br />
              <br />
              The{' '}
              <a
                href="http://nglviewer.org/"
                target="_blank"
                rel="noreferrer noopener"
              >
                NGL viewer
              </a>{' '}
              represents the most important pockets.
              <br />
              <br />
              Click any pocket to get extra data.
            </>
          }
        />
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
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
      <Card className={style.graph}>
        <Graph2
          yData={graphInputData}
          xAxisValues={xAxisValues}
          xUnit={'frame'}
          xScaleFactor={0.001}
          xAxisLabel={'Frames'}
          yAxisLabel={'Pocket volume'}
          show={show}
          showPrecisionSlider={false}
          blockMaxPrecision={true}
          roundcents={false}
          mean
          standardDeviation
          onSelect={setSelectedFrame}
        />
      </Card>
      {selectedFrame && (
        <NGLViewerSpawner
          // Set the new viewer or null if there is not a proper "selected" value
          newViewer={
            typeof selectedFrame === 'number'
              ? {
                  accession: accession,
                  requestedFrame: selectedFrame,
                  selectedAtoms: currentPocket.atoms,
                }
              : null
          }
          // If the nailed/closed viewer is the current viewer then reset the 'selected'
          onNail={viewer =>
            setSelectedFrame(previous => {
              if (viewer.requestedFrame === previous) return null;
              else return previous;
            })
          }
          onClose={viewer =>
            setSelectedFrame(previous => {
              if (viewer.requestedFrame === previous) return null;
              else return previous;
            })
          }
        />
      )}
    </>
  );
};

export default Pockets;
