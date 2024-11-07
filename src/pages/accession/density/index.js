import React, { lazy, Suspense, useState, useContext, useMemo } from 'react';

import {
  CardContent,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  FormControlLabel,
  Checkbox,
} from '@mui/material';

import Card from '../../../components/animated-card';
import ViewerSpawner from '../../../components/viewer-spawner';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import { getMeanAndStdv } from '../../../utils/statistics';

import style from './style.module.css';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

const colors = ['black', 'red', 'orange', 'yellow', 'blue', 'green', 'purple'];

const Density = () => {
  // Get the metadata
  const { accession, accessionAndMdNumber, metadata, analyses } = useContext(ProjectCtx);

  // Send a request to the API with the url of the specific analysis
  const {
    loading: densityLoading,
    payload: densityPayload,
    error: densityError,
  } = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/density/`);

  // Set which density components to display
  const [display, setDisplay] = useState({});

  // Format the data
  const {
    densityData,
    frameStep,
    xAxisStep,
    xAxisLabel,
    isEnsemble,
    xTooltip,
  } = useMemo(() => {
    if (!densityPayload || !densityPayload.data || !densityPayload.data.comps) return {};

    const densityData = {};
    const defaultDisplay = {};
    
    // Process each component's density data
    densityPayload.data.comps.forEach((comp, index) => {
      const dataset = {};
      dataset.data = comp.dens;
      const { mean: average, stdv: stddev } = getMeanAndStdv(dataset.data);
      dataset.average = average;
      dataset.stddev = stddev;
      dataset.color = colors[index % colors.length];
      
      const name = comp.name;
      densityData[name] = dataset;
      defaultDisplay[name] = true;
    });

    setDisplay(defaultDisplay);
    const isEnsemble = metadata.TYPE === 'ensemble';
    // Calculate timestep from z-axis data
    const zValues = densityPayload.data.z;
    const timestep = zValues[1] - zValues[0]; // Difference between first two points

    return {
      densityData,
      frameStep: 1,
      xAxisStep: timestep,
      xAxisLabel: 'Distance (Å)', // Using Angstroms as label
      isEnsemble,
      xTooltip: xValue => `${xValue.toFixed(2)} Å`,
      xValues: zValues, // Add z values for x-axis
    };
  }, [metadata, densityPayload]);

  // Set when one point in the graph is selected
  const [selected, setSelected] = useState(null);
  const selectedFrame = selected * frameStep;

  // Set the mark for selected
  const marks = useMemo(() => {
    const selectedMark = {
      x: selected,
      attr: { fill: '#c8c8c8' },
    };
    return [selectedMark];
  }, [selected]);

  // Render loading or error states
  if (densityLoading) return <Loading />;
  else if (densityError) return densityError.toString();
  else if (!densityPayload) return 'Something bad happened loading density data';

  const cents = num => Math.round(num * 100) / 100;
  // Set the y axis label for density
  const yAxisLabel = 'Density';

  console.log('Render')

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <CardContent>
          <Table padding="checkbox">
            <TableHead>
              <TableRow>
                <TableCell>selected chains</TableCell>
                <TableCell>{`mean`}</TableCell>
                <TableCell>{`standard deviation`}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(densityData).map(([key, density], i) => (
                <TableRow key={key}>
                  <TableCell>
                    {
                      <FormControlLabel
                        onChange={() =>
                          setDisplay(previous => {
                            previous[key] = !previous[key];
                            return { ...previous };
                          })
                        }
                        control={
                          <Checkbox
                            checked={display[key]}
                            style={{ color: colors[i] }}
                          />
                        }
                        label={key}
                      />
                    }
                  </TableCell>
                  <TableCell>{cents(density.average)}</TableCell>
                  <TableCell>{cents(density.stddev)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className={style.card}>
        <CardContent>
          <Graph
            yData={densityData}
            step={xAxisStep}
            xAxisLabel={xAxisLabel}
            type={isEnsemble ? 'dots' : 'line'}
            xTooltip={xTooltip}
            xScaleFactor={1}
            yAxisLabel={yAxisLabel}
            onSelect={setSelected}
            selfLegend={false}
            dataDisplay={display}
            marks={marks}
          />
        </CardContent>
      </Card>
      <ViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          typeof selected === 'number'
            ? {
              accession: accession,
              requestedFrame: selectedFrame,
              // This is used only as a tag for the onNail and onClose functions below
              // It has no effect on the viewer
              xSelection: selected,
            }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelected(previous => {
            if (viewer.xSelection === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelected(previous => {
            if (viewer.xSelection === previous) return null;
            else return previous;
          })
        }
      />
    </Suspense>
  );
};

export default Density;
