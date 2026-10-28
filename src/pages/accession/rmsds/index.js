import React, { lazy, Suspense, useState, useContext, useMemo, useCallback } from 'react';

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

const tabs = [
  { reference: 'firstframe', type: 'rmsd', label: 'First frame RMSD' },
  { reference: 'average', type: 'rmsd', label: 'Average RMSD' },
  { reference: 'firstframe', type: 'tmscore', label: 'First frame TM score' },
  { reference: 'average', type: 'tmscore', label: 'Average TM score' },
];

const colors = ['black', 'red', 'orange', 'yellow'];

const cents = num => Math.round(num * 100) / 100;

const getMedian = values => {
  if (!values || values.length === 0) return;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
};

// Get the overall mean and standard deviation from the means and standard deviations of blocks
// All blocks have the same number of frames (step) but the last one, which may be shorter
const getBlocksMeanAndStdv = (means, stdvs, step, totalFrames) => {
  const counts = means.map((_, i) => {
    if (!step || !totalFrames) return 1;
    return Math.max(Math.min(step, totalFrames - i * step), 1);
  });
  const total = counts.reduce((a, b) => a + b, 0);
  const mean = means.reduce((acc, m, i) => acc + m * counts[i], 0) / total;
  // Law of total variance: mean of the variances + variance of the means
  const squares = means.reduce(
    (acc, m, i) => acc + counts[i] * (stdvs[i] ** 2 + m ** 2), 0) / total;
  const stdv = Math.sqrt(Math.max(squares - mean ** 2, 0));
  return { mean, stdv };
};

const Rmsds = () => {
  // Get the metadata
  const { accessionAndMdNumber, metadata, analyses, populations } = useContext(ProjectCtx);
  // Note that TM scores is not mandatory to load this page
  // Actually a simulation with no protein will have no TM score, so it is normal
  const hasTMscore = analyses.includes('tmscores');

  // Send a request to the API with the url of the specific analysis
  const {
    loading: rmsdsLoading,
    payload: rmsdsPayload,
    error: rmsdsError,
  } = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/rmsds/`);

  // Send a request to the API with the url of the specific analysis
  const {
    loading: tmscoresLoading,
    payload: tmscoresPayload,
    error: tmscoresError,
  } = useAPI(hasTMscore
    ? `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/tmscores/`
    : null,
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
    else if (type === 'tmscore') payload = tmscoresPayload;
    else throw new Error(`Not supported type ${type}`);
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
      // New format: version 1.0.0
      // The whole trajectory is analyzed and values are averaged in blocks of frames
      // Every block has its mean, standard deviation and maximum value
      if (rmsd.means) {
        dataset.data = rmsd.means;
        dataset.areaStdDev = rmsd.stdvs;
        // Get the overall mean and standard deviation from the blocks
        const { mean, stdv } = getBlocksMeanAndStdv(
          rmsd.means, rmsd.stdvs, payload.step, metadata.mdFrames);
        dataset.average = mean;
        dataset.stddev = stdv;
        dataset.maximum = rmsd.maxs.reduce((a, b) => Math.max(a, b), -Infinity);
        // Keep the frame where the maximum value is found for every block, if available
        // Note that the API returns 1-based frame numbers but we work with 0-based frame numbers
        dataset.maxframes = rmsd.maxframes && rmsd.maxframes.map(frame => frame - 1);
        // Get how much every block maximum stands out, compared to the typical block standard deviation
        // This value is comparable between different datasets, so it is used to decide which frame to show
        const typicalStdv = getMedian(rmsd.stdvs);
        dataset.maxScores = rmsd.maxs.map((max, i) => {
          if (!typicalStdv) return 0;
          return (max - rmsd.means[i]) / typicalStdv;
        });
      }
      // Old format: values are a subset of frames along the trajectory
      else {
        dataset.data = rmsd.values;
        const { mean: average, stdv: stddev } = getMeanAndStdv(dataset.data);
        dataset.average = average;
        dataset.stddev = stddev;
        dataset.maximum = rmsd.values.reduce((a, b) => Math.max(a, b), -Infinity);
      }
      dataset.color = colors[count];
      count += 1;
      const name = rmsd.group;
      rmsds[name] = dataset;
      defaultDisplay[name] = true;
    });
    setDisplay(defaultDisplay);
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
    else if (analysisFrameStep) {
      // DANI: Esto es lo correcto
      const analysisTimeStep = analysisFrameStep * framesTimeStep
      xAxisStep = analysisTimeStep;
      // DANI: De esta forma siempre cuarda, pero es trampa
      // DANI: Si el step está mal cuadrará también tapando así el problema
      //const timeLength = metadata.FRAMESTEP * metadata.mdFrames;
      //const analysisSteps = payload.data[0].values.length;
      //xAxisStep = timeLength / analysisSteps;
      xAxisLabel = 'Time (ns)';
      xTooltip = xValue => +xValue.toFixed(2) + ' ns';
    } else {
      // Fallback to frames when no step is available
      const totalFrames = (payload.data[0].values || payload.data[0].means).length;
      console.log('totalFrames', totalFrames);
      xAxisStep = metadata.mdFrames / totalFrames;
      xAxisLabel = 'Frames';
      xTooltip = xValue => 'frame ' + Math.round(xValue);
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
      frameStep: analysisFrameStep,
      xAxisStep,
      xAxisLabel,
      isEnsemble,
      xTooltip,
      xWeights,
    };
  }, [metadata, rmsdsPayload, tmscoresPayload, selectedTab, populations]);

  // Set when one point in the graph is selected
  const [selected, setSelected] = useState(null);
  // Find the maximum frame of a block, if available
  // If there are several displayed datasets then select the one whose maximum stands out the most
  // Return both the frame and the dataset it belongs to
  const getBlockMaxFrame = useCallback(index => {
    let best;
    let bestScore = -Infinity;
    Object.entries(rmsds || {}).forEach(([key, { maxframes, maxScores }]) => {
      if (!display[key] || !maxframes) return;
      if (maxframes[index] === undefined) return;
      if (maxScores[index] <= bestScore) return;
      best = { frame: maxframes[index], group: key };
      bestScore = maxScores[index];
    });
    return best;
  }, [rmsds, display]);

  // Set the frame to be loaded when a block is selected: the block maximum frame
  // If there are not maximum frames then select the first frame in the block
  const selectedFrame = useMemo(() => {
    if (typeof selected !== 'number') return null;
    const blockMax = getBlockMaxFrame(selected);
    if (blockMax) return blockMax.frame;
    return selected * frameStep;
  }, [selected, getBlockMaxFrame, frameStep]);

  // Set the x axis tooltip
  // If we have maximum frames then show the block frames range
  // Frame numbers are shown 1-based, as they are returned by the API
  const blocksTooltip = useCallback((xValue, index) => {
    if (!getBlockMaxFrame(index) || !frameStep) return xTooltip && xTooltip(xValue, index);
    const firstFrame = index * frameStep + 1;
    let lastFrame = firstFrame + frameStep - 1;
    if (metadata.mdFrames) lastFrame = Math.min(lastFrame, metadata.mdFrames);
    return `frames ${firstFrame}-${lastFrame}`;
  }, [getBlockMaxFrame, frameStep, xTooltip, metadata]);

  // Set the y padding so the standard deviation areas fit in the graph
  const yPadding = useMemo(() => {
    if (!rmsds) return 0;
    let maxStdv = 0;
    Object.entries(rmsds).forEach(([key, rmsd]) => {
      if (!display[key] || !rmsd.areaStdDev) return;
      rmsd.areaStdDev.forEach(stdv => (maxStdv = Math.max(maxStdv, stdv)));
    });
    return maxStdv;
  }, [rmsds, display]);

  // Set the mark for selected
  const marks = useMemo(() => {
    const selectedMark = {
      x: selected,
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

  // Set the y axis label according to if it is an RMSD or a TM score
  let yAxisLabel = 'RMSD (Å)';
  if (selectedTab.type === 'tmscore') yAxisLabel = 'TM score';

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
                <TableCell>{`maximum${
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
                  <TableCell>{cents(rmsd.maximum)}</TableCell>
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
            xTooltip={blocksTooltip}
            xScaleFactor={1}
            yAxisLabel={yAxisLabel}
            onSelect={setSelected}
            selfLegend={false}
            dataDisplay={display}
            marks={marks}
            areaStdDev={true}
            yPadding={yPadding}
          />
        </CardContent>
      </Card>
      <ViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          typeof selected === 'number'
            ? {
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
