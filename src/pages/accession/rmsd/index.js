import React, { lazy, Suspense, useState, useContext, useMemo } from 'react';

import {
  CardContent,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx, ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import Info from '../../../components/info';

import style from './style.module.css';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

const Rmsd = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/rmsd/`,
  );

  // Rmsd analysis comes in nanometers (nm) and we want it in Ångstroms
  useMemo(() => {
    if (!payload) return;
    const rmsd = payload.y['rmsd'];
    rmsd.data = rmsd.data.map(v => v * 10);
    rmsd.average = rmsd.average * 10;
    rmsd.stddev = rmsd.stddev * 10;
  }, [payload]);

  // React hooks
  // Set when one point in the graph is selected
  const [selected, setSelected] = useState(null);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  const dataLength = payload.y['rmsd'].data.length;
  const xAxesStep = (metadata.LENGTH / (dataLength - 1)) * 1000;

  const cents = num => Math.round(num * 100) / 100;

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <Info
          reference={'rmsd-statistics'}
          tooltip={
            <>
              Statistics table including RMSd data label, mean and standard
              deviation. Values are in namometers.
            </>
          }
        />
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>name</TableCell>
                <TableCell>mean (Å)</TableCell>
                <TableCell>standard deviation (Å)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>{'RMSd'}</TableCell>
                <TableCell>{cents(payload.y.rmsd.average)}</TableCell>
                <TableCell>{cents(payload.y.rmsd.stddev)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className={style.card}>
        <Info
          reference={'rmsd-graph'}
          tooltip={
            <>
              This graph represents the RMSd in the average atom positions along
              the trajectory compared to the original position (frame 0). Data
              is displayed (more opaque lines) alongside corresponding mean
              value (light horizontal line) and mean ± 1 standard deviation
              (lighter horizontal bands).
              <br />
              <br />
              The horizontal edge stands for the trajectory time in nanoseconds.
              <br />
              The vertical edge stands for the RMSd in nanometers.
              <br />
              <br />
              The graph is{' '}
              <span style={{ color: 'lightGreen' }}>interactive</span>. Use the
              mouse to move along data by holding the click button and dragging
              left or right. Use the mouse wheel to zoom in a specific region.
              <span style={{ color: 'lightGreen' }}> Click any point </span>
              on the graph to open an interactive window to display the
              strucutre at the corresponding frame.
            </>
          }
        />
        <CardContent>
          <Typography variant="h6" />
          <Graph
            y={payload.y}
            start={payload.start || 0}
            step={xAxesStep}
            xLabel={'Time (ns)'}
            xScaleFactor={0.001}
            yLabel={'RMSd (Å)'}
            onSelect={setSelected}
            selected={selected}
            selfLegend={false}
          />
        </CardContent>
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          typeof selected === 'number'
            ? {
                accession: accession,
                requestedFrame: selected,
              }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelected(previous => {
            if (viewer.requestedFrame === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelected(previous => {
            if (viewer.requestedFrame === previous) return null;
            else return previous;
          })
        }
      />
    </Suspense>
  );
};

export default Rmsd;
