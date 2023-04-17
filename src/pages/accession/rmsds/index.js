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
  Tabs,
  Tab,
} from '@mui/material';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import { getMeanAndStdv } from '../../../utils/statistics';

import style from './style.module.css';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

const tabs = [
  { reference: 'firstframe', type: 'rmsd', label: 'First frame RMSd' },
  { reference: 'average', type: 'rmsd', label: 'Average RMSd' },
  { reference: 'firstframe', type: 'tmscore', label: 'First frame TM score' },
  { reference: 'average', type: 'tmscore', label: 'Average TM score' },
];

const colors = ['black', 'red', 'orange', 'yellow'];

const Rmsds = () => {
  // Get the metadata
  const { accession, metadata, analyses, populations } = useContext(ProjectCtx);
  // Note that TM scores is not mandatory to load this page
  // Actually a simulation with no protein will have no TM score, so it is normal
  const hasTMscore = analyses.includes('tmscores');

  // Send a request to the API with the url of the specific analysis
  const {
    loading: rmsdsLoading,
    payload: rmsdsPayload,
    error: rmsdsError,
  } = useAPI(`${BASE_PATH_PROJECTS}${accession}/analyses/rmsds/`);

  // Send a request to the API with the url of the specific analysis
  const {
    loading: tmscoresLoading,
    payload: tmscoresPayload,
    error: tmscoresError,
  } = useAPI(
    hasTMscore ? `${BASE_PATH_PROJECTS}${accession}/analyses/tmscores/` : null,
  );

  // Set which tab is selected
  const [selectedTab, setSelectedTab] = useState(tabs[0]);

  // Set which rmsd is displayed
  const [display, setDisplay] = useState({});

  // Format the data
  const {
    rmsds,
    frameStep,
    xAxisStep,
    xAxisLabel,
    isEnsemble,
    xTooltip,
    xWeights,
  } = useMemo(() => {
    let payload;
    const type = selectedTab.type;
    const reference = selectedTab.reference;
    if (type === 'rmsd') payload = rmsdsPayload;
    if (type === 'tmscore') payload = tmscoresPayload;
    if (!payload) return {};
    if (populations && populations.loading) return {};
    const rmsds = {};
    // Set the default graph display for the rmsds (all true)
    const defaultDisplay = {};
    let count = 0;
    payload.data.forEach(rmsd => {
      // Proceed only if this rmsd is from the set reference
      if (rmsd.reference !== reference) return;
      const dataset = {};
      // Multiply by 10 since rmsd analysis comes in nanometers (nm) and we want it in Ångstroms
      dataset.data = rmsd.values;
      const { mean: average, stdv: stddev } = getMeanAndStdv(dataset.data);
      dataset.average = average;
      dataset.stddev = stddev;
      dataset.color = colors[count];
      count += 1;
      const name = rmsd.group;
      rmsds[name] = dataset;
      defaultDisplay[name] = true;
    });
    setDisplay(defaultDisplay);
    // Get the frames step
    const frameStep = payload.step;
    // Get the total time length
    const timeLength = metadata.LENGTH;
    // If this is an ensemble or we are missing the time length then we use frames as the x axis
    // If this is a trajectory and we have the time length then we use time as the x axis
    const isEnsemble = metadata.TYPE === 'ensemble';
    let xAxisStep;
    let xAxisLabel;
    let xTooltip;
    if (isEnsemble || !timeLength) {
      xAxisStep = frameStep;
      xAxisLabel = 'Frames';
      xTooltip = xValue => 'frame ' + xValue;
    }
    else {
      const timeStep = timeLength / metadata.SNAPSHOTS;
      xAxisStep = frameStep * timeStep;
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

    // Return values to be memoized
    return {
      rmsds,
      frameStep,
      xAxisStep,
      xAxisLabel,
      isEnsemble,
      xTooltip,
      xWeights,
    };
  }, [metadata, rmsdsPayload, tmscoresPayload, selectedTab, populations]);

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

  // Render loading or error messages according with the API response
  if (rmsdsLoading || tmscoresLoading || (populations && populations.loading))
    return <Loading />;
  else if (rmsdsError) return rmsdsError.toString();
  else if (tmscoresError) return tmscoresError.toString();
  else if (populations && populations.error)
    return populations.error.toString();
  else if (!rmsdsPayload) return 'Something bad happened with RMSD';
  else if (hasTMscore && !tmscoresPayload)
    return 'Something bad happened with TM score';
  else if (populations && !populations.payload)
    return 'Something bad happened with populations';

  // Set the y axis label according to if it is an RMSd or a TM score
  let yAxisLabel = 'RMSd (Å)';
  if (selectedTab.type === 'tmscore') yAxisLabel = 'TM score';

  const cents = num => Math.round(num * 100) / 100;

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <CardContent>
          <Tabs
            value={selectedTab}
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
            onChange={(event, value) => {
              setSelected(null);
              setSelectedTab(value);
            }}
            className={style['margined-bottom']}
          >
            {tabs.map((tab, t) => (
              <Tab
                key={t}
                value={tab}
                label={tab.label}
                disabled={tab.type === 'tmscore' && !hasTMscore}
              />
            ))}
          </Tabs>
          <Table padding="checkbox">
            <TableHead>
              <TableRow>
                <TableCell>selected atoms</TableCell>
                <TableCell>{`mean${
                  selectedTab.type === 'rmsd' ? ' (Å)' : ''
                }`}</TableCell>
                <TableCell>{`standard deviation${
                  selectedTab.type === 'rmsd' ? ' (Å)' : ''
                }`}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(rmsds).map(([key, rmsd], i) => (
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
                  <TableCell>{cents(rmsd.average)}</TableCell>
                  <TableCell>{cents(rmsd.stddev)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className={style.card}>
        <CardContent>
          <Graph
            yData={rmsds}
            step={xAxisStep}
            xAxisLabel={xAxisLabel}
            type={isEnsemble ? 'dots' : 'line'}
            xWeights={xWeights}
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
      <NGLViewerSpawner
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

export default Rmsds;
