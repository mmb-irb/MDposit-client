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

const Rgyr = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);

  // Send a request to the API with the url of the rgyr analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/rgyr/`,
  );

  // Rgyr analysis comes in nanometers (nm) and we want it in Ångstroms
  useMemo(() => {
    if (!payload) return;
    payload.y['rgyr'].data = payload.y['rgyr'].data.map(v => v * 10);
  }, [payload]);

  // React hooks
  // Set when one point in the graph is selected
  const [selected, setSelected] = useState(null);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  const cents = num => Math.round(num * 100) / 100;

  const dataLength = payload.y['rgyr'].data.length;
  const xAxesStep = (metadata.LENGTH / (dataLength - 1)) * 1000;

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <Info
          reference={'rgyr-statistics'}
          tooltip={
            <>
              Statistics table including data label, mean and standard deviation
              values for the overall Rgyr and each dimension. Values are in
              namometers.
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
                <TableCell>{'Rgyr (x,y,z)'}</TableCell>
                <TableCell>
                  {cents(payload.y.rgyr.average) +
                    ' (' +
                    cents(payload.y.rgyrx.average) +
                    ', ' +
                    cents(payload.y.rgyry.average) +
                    ', ' +
                    cents(payload.y.rgyrz.average) +
                    ')'}
                </TableCell>
                <TableCell>
                  {cents(payload.y.rgyr.stddev) +
                    ' (' +
                    cents(payload.y.rgyrx.stddev) +
                    ', ' +
                    cents(payload.y.rgyry.stddev) +
                    ', ' +
                    cents(payload.y.rgyrz.stddev) +
                    ')'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className={style.card}>
        <Info
          reference={'rgyr-graph'}
          tooltip={
            <>
              This graph represents the radius of gyration (Rgyr). There are
              four data sets: One three-dimensional (blue) and three
              single-dimensional radius. These are RgyrX (yellow), RgyrY (green)
              and RgyrZ (red). Data is displayed (more opaque lines) alongside
              corresponding mean value (light horizontal line) and mean ± 1
              standard deviation (lighter horizontal bands)
              <br />
              <br />
              The horizontal edge stands for the trajectory time in nanoseconds.
              <br />
              The vertical edge stands for the Rgyr in nanometers.
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
            //defaultPrecision={2 ** 6}
            xLabel={'Time (ns)'}
            xScaleFactor={0.001}
            yLabel={'Rgyr (Å)'}
            onSelect={setSelected}
            selected={selected}
            selfLegend={true}
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

export default Rgyr;
