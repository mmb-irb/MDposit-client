import React, { lazy, useContext, useState } from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';

import style from './style.module.css';

//import { AccessionCtx } from '../../../contexts';
import { AccessionCtx, ProjectCtx, PdbCtx } from '../../../contexts';

import Info from '../../../components/info';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import //complexNumerationParser,
//getMetadataChainname,
'../../../utils/topology-manager';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

const Graph2 = lazy(() =>
  import(/* webpackChunkName: 'graph2' */ '../../../components/graph2'),
);

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const Pockets = () => {
  // useInView acts as a React hook
  // Track if the NGL viewer (nglRef) and the analyses (nightingaleRef) are on screen
  // The status (e.g. isNglVisible) is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the accession
  //const accession = useContext(AccessionCtx);
  // Get the current project chains
  const { metadata } = useContext(ProjectCtx);
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);

  // Set which pocket is selected by the user
  const [selectedPocket, setSelectedPocket] = useState('p1');

  // Send a request to the API with the url of the rgyr analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/pockets/`,
  );

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!metadata || !pdbData.file) return <Loading />;

  //console.log(payload);

  delete payload.name;
  const pocketNames = Object.keys(payload);

  // Set the input objet for the NGL
  const pockets = [];
  // Set the input objets for the graph
  const graphInputData = {};
  const show = {};
  for (const pocketName of pocketNames) {
    // NGL
    const pocket = {
      topologyURL: `${BASE_PATH_PROJECTS}${accession}/files/${pocketName}.pdb`,
      onlyTopology: true,
      representations: [
        {
          name: pocketName,
          defaultDrawingMethod: 'surface',
          // Make the surface a transparent net
          other: { contour: true },
        },
      ],
      chainLabels: [pocketName],
    };
    pockets.push(pocket);
    // Graph
    graphInputData[pocketName] = {
      data: payload[pocketName].pock_volume,
    };
    show[pocketName] = pocketName === selectedPocket;
  }

  // Set the xAxis values: frame numbers
  const datalength = payload[selectedPocket].pock_volume.length;
  const xAxisStep = Math.floor(metadata.SNAPSHOTS / datalength);
  const xAxisValues = Array(datalength)
    .fill(undefined)
    .map((v, i) => i * xAxisStep);

  // Set a function to calculate the average value from a values array
  const roundedAvg = values => {
    const sum = values.reduce((pv, cv) => pv + cv, 0);
    const length = values.length;
    const average = sum / length;
    const rounded = Math.round(average * 10) / 10;
    return rounded;
  };

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
              {pocketNames.map(pocketName => (
                <TableRow
                  key={pocketName}
                  // Hover only when it is not already selected
                  hover={pocketName !== selectedPocket}
                  role="checkbox"
                  className={
                    pocketName === selectedPocket
                      ? style.selectedrow
                      : undefined
                  }
                  onClick={() => setSelectedPocket(pocketName)}
                >
                  {[
                    pocketName,
                    roundedAvg(payload[pocketName].pock_volume),
                  ].map(cell => (
                    <TableCell key={cell}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))}
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
            components={[{}, ...pockets]}
            selectedRepresentation={selectedPocket}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
      <Card>
        <Graph2
          y={graphInputData}
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
        />
      </Card>
    </>
  );
};

export default Pockets;
