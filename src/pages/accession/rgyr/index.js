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

import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

const Graph2 = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph2'),
);

const cents = num => Math.round(num * 100) / 100;

const Rgyr = () => {
  // Get the current project metadata
  const { accession, metadata } = useContext(ProjectCtx);

  // Send a request to the API with the url of the rgyr analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/rgyr/`,
  );

  // Rgyr analysis comes in nanometers (nm) and we want it in Ångstroms (Å) so we must multuply by 10 all values
  useMemo(() => {
    if (!payload) return;
    const rgyr = payload.y['rgyr'];
    rgyr.data = rgyr.data.map(v => v * 10);
    const rgyrx = payload.y['rgyrx'];
    rgyrx.data = rgyrx.data.map(v => v * 10);
    rgyrx.color = 'red';
    const rgyry = payload.y['rgyry'];
    rgyry.data = rgyry.data.map(v => v * 10);
    rgyry.color = 'green';
    const rgyrz = payload.y['rgyrz'];
    rgyrz.data = rgyrz.data.map(v => v * 10);
    rgyrz.color = 'blue';
  }, [payload]);

  // React hooks
  // Set when one point in the graph is selected
  const [selected, setSelected] = useState(null);

  // Set the mark for selected
  const marks = useMemo(() => {
    const selectedMark = {
      x: selected,
      attr: { fill: '#c8c8c8' },
    };
    return [selectedMark];
  }, [selected]);

  const { xAxisStep, xAxisLabel, xUnit } = useMemo(() => {
    if (!payload) return {};
    const dataLength = payload.y['rgyr'].data.length;
    // If this is an ensemble we use frames as the x axis
    // If this is a trajectory we use time as the x axis
    const xAxisStep =
      metadata.TYPE === 'ensemble'
        ? metadata.SNAPSHOTS / (dataLength - 1)
        : metadata.LENGTH / (dataLength - 1);
    const xAxisLabel = metadata.TYPE === 'ensemble' ? 'Frames' : 'Time (ns)';
    const xUnit = metadata.TYPE === 'ensemble' ? 'frame' : 'ns';
    return { xAxisStep, xAxisLabel, xUnit };
  }, [payload, metadata]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
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
        <CardContent>
          <Typography variant="h6" />
          <Graph2
            yData={payload.y}
            step={xAxisStep}
            xAxisLabel={xAxisLabel}
            xUnit={xUnit}
            xScaleFactor={1}
            yAxisLabel={'Rgyr (Å)'}
            onSelect={setSelected}
            selfLegend={true}
            mean={true}
            standardDeviation={true}
            marks={marks}
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
