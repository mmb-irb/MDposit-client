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
} from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx, ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import { getMeanAndStdv } from '../../../utils/statistics';

import Info from '../../../components/info';

import style from './style.module.css';

const Graph2 = lazy(() =>
  import(/* webpackChunkName: 'graph2' */ '../../../components/graph2'),
);

const tabs = [
  { reference: 'firstframe', type: 'rmsd', label: 'First frame RMSd' },
  { reference: 'average', type: 'rmsd', label: 'Average RMSd' },
  { reference: 'firstframe', type: 'tmscore', label: 'First frame TM score' },
  { reference: 'average', type: 'tmscore', label: 'Average TM score' },
];

const colors = ['black', 'red', 'orange', 'yellow'];

const Rmsd = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the metadata
  const { metadata } = useContext(ProjectCtx);

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
  } = useAPI(`${BASE_PATH_PROJECTS}${accession}/analyses/tmscores/`);

  // Set which tab is selected
  const [selectedTab, setSelectedTab] = useState(tabs[0]);

  // Format the data
  const { rmsds, xAxesStep } = useMemo(() => {
    let payload;
    const type = selectedTab.type;
    const reference = selectedTab.reference;
    if (type === 'rmsd') payload = rmsdsPayload;
    if (type === 'tmscore') payload = tmscoresPayload;
    if (!payload) return {};
    const rmsds = {};
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
    });
    // Get the frames step
    // WARNING: We want the time step in nanoseconds (ns)
    // WARNING: Frequency is divided by 1000 since it is in picoseconds (ps)
    const xAxesStep = payload.step * (metadata.FREQUENCY / 1000);
    return { rmsds, xAxesStep };
  }, [metadata, rmsdsPayload, tmscoresPayload, selectedTab]);

  // Set which rmsd is displayed
  const [display, setDisplay] = useState({
    protein: true,
    'protein-h': true,
    backbone: true,
    'c-alpha': true,
  });

  // Set when one point in the graph is selected
  const [selected, setSelected] = useState(null);

  // Render loading or error messages according with the API response
  if (rmsdsLoading || tmscoresLoading) return <Loading />;
  else if (rmsdsError) return rmsdsError.toString();
  else if (tmscoresError) return tmscoresError.toString();
  else if (!rmsdsPayload || !tmscoresPayload) return 'Something bad happened';

  // Set the y axis label according to if it is an RMSd or a TM score
  let yAxisLabel = 'RMSd (Å)';
  if (selectedTab.type === 'tmscore') yAxisLabel = 'TM score';

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
          <Tabs
            value={selectedTab}
            variant="fullWidth"
            indicatorColor="secondary"
            textColor="secondary"
            onChange={(event, value) => {
              setSelectedTab(value);
            }}
            className={style['margined-bottom']}
          >
            {tabs.map((tab, t) => (
              <Tab key={t} value={tab} label={tab.label} />
            ))}
          </Tabs>
          <Table padding="checkbox">
            <TableHead>
              <TableRow>
                <TableCell>selected atoms</TableCell>
                <TableCell>mean (Å)</TableCell>
                <TableCell>standard deviation (Å)</TableCell>
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
          <div className={style.graph}>
            <Graph2
              yData={rmsds}
              step={xAxesStep}
              xAxisLabel={'Time (ns)'}
              xScaleFactor={1}
              yAxisLabel={yAxisLabel}
              onSelect={setSelected}
              selected={selected}
              selfLegend={false}
              show={display}
            />
          </div>
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
