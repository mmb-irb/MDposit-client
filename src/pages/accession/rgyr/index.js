import React, { lazy, Suspense, useState, useContext, useMemo } from 'react';

import {
  CardContent,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

const cents = num => Math.round(num * 100) / 100;

const Rgyr = () => {
  // Get the current project metadata
  const { accession, accessionAndMdNumber, metadata, populations } = useContext(ProjectCtx);

  // Send a request to the API with the url of the rgyr analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/rgyr/`,
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

  const {
    xAxisStep,
    xAxisLabel,
    isEnsemble,
    xTooltip,
    xWeights,
  } = useMemo(() => {
    if (!payload || (populations && populations.loading) || !metadata) return {};
    // Get the frames step
    const analysisFrameStep = payload.step;
    // Get the total time length
    const framesTimeStep = metadata.FRAMESTEP;
    // If this is an ensemble or we are missing the time length then we use frames as the x axis
    // If this is a trajectory and we have the time length then we use time as the x axis
    const isEnsemble = metadata.TYPE === 'ensemble';
    let xAxisStep;
    let xAxisLabel;
    let xTooltip;
    if (isEnsemble || !framesTimeStep) {
      xAxisStep = analysisFrameStep;
      xAxisLabel = 'Frames';
      xTooltip = xValue => 'frame ' + xValue;
    }
    else {
      // DANI: Esto es lo correcto, pero dado que hay analysis con el step mal de momento lo tapamos
      //const analysisTimeStep = analysisFrameStep * framesTimeStep
      //xAxisStep = analysisTimeStep;
      // DANI: De esta forma siempre cuarda, pero si realmente el step era correcto entonces el eje estará mal
      const timeLength = metadata.FRAMESTEP * metadata.mdFrames;
      const analysisSteps = payload.y.rgyr.data.length;
      xAxisStep = timeLength / analysisSteps;
      xAxisLabel = 'Time (ns)';
      xTooltip = xValue => +xValue.toFixed(2) + ' ns';
    }
    // Get the weigths for each data value corresponding frame
    let xWeights;
    if (populations && populations.payload) {
      xWeights = [];
      for (let i = 0; i < populations.payload.length; i += xAxisStep) {
        xWeights.push(populations.payload[i]);
      }
    }

    return { xAxisStep, xAxisLabel, isEnsemble, xTooltip, xWeights };
  }, [payload, metadata, populations]);

  // Render loading or error messages according with the API response
  if (loading || (populations && populations.loading)) return <Loading />;
  else if (error) return error.toString();
  else if (populations && populations.error)
    return populations.error.toString();
  else if (!payload) return 'Something bad happened with the analysis data';
  else if (populations && !populations.payload)
    return 'Something bad happened with populations';

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
          <Graph
            yData={payload.y}
            step={xAxisStep}
            xAxisLabel={xAxisLabel}
            type={isEnsemble ? 'dots' : 'line'}
            xWeights={xWeights}
            xTooltip={xTooltip}
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
