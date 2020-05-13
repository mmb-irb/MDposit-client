import React, { lazy, Suspense, useState, useContext } from 'react';

import { CardContent, Typography } from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx } from '../../../contexts';
import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';
import { range } from 'lodash-es';

const StatisticsTable = lazy(() =>
  import(
    /* webpackChunkName: 'statistics-table' */ '../../../components/statistics-table'
  ),
);
const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

const InterfaceAnalysis = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project chains
  const { chains } = useContext(ProjectCtx);
  // Set the graph analysis propierties
  const analysis = 'rmsd-perres';
  const defaultPrecision = 1;
  const xLabel = 'Time (ns)';
  const xScaleFactor = 0.001;
  const yLabel = 'RMSd (nm)';
  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/${analysis}/`,
  );

  // Set when one point in the graph is selected
  const [selected, setSelected] = useState(null);
  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  //const selection = payload.y["ALA:104"];
  //let data = payload.y;
  //let data = { "ALA:104": payload.y["ALA:104"]};

  // Get the interface residues in a standarized fromat: an array with each resiude 1 by 1
  const selection = '1-30,60-65,303-315,330-339,365-375,669,683,700-722,739-745,750-771'.split(
    ',',
  );
  const ranged = /^([0-9]*)-([0-9]*)$/;
  const curatedSelection = [];
  for (const res of selection) {
    if (res.match(ranged)) {
      const matches = ranged.exec(res);
      const resiudes = range(+matches[1], +matches[2] + 1);
      curatedSelection.push(...resiudes);
    } else curatedSelection.push(+res);
  }

  // Find the corrsponding key for each selected resiude
  // First get all available keys in order
  const keyNumber = /^[A-Z]*:([0-9]*)$/;
  const keys = [];
  for (const key of Object.keys(payload.y)) {
    //console.log(key);
    const result = keyNumber.exec(key);
    if (!result) continue;
    keys[result[1]] = key;
  }

  // Then add all selected keys and their corresponding data to the 'data' object
  let data = {};
  for (const res of curatedSelection) {
    const key = keys[res];
    data[key] = payload.y[key];
  }

  // Check if there are selected
  const showDND = !!(
    (typeof selected === 'number' && Number.isFinite(selected)) ||
    (selected && selected.size)
  );

  // Set the chains to be represented in the NGL viewer
  const chainsNGL = [];
  for (const c in chains) {
    // The last chain is represented as licorice
    if (+c === +(chains.length - 1)) {
      chainsNGL.push({
        name: 'Chain ' + chains[c],
        selection: ':' + chains[c],
        defaultDrawingMethod: 'licorice',
      });
    } else {
      chainsNGL.push({
        name: 'Chain ' + chains[c],
        selection: ':' + chains[c],
        defaultDrawingMethod: 'surface',
        defaultColoringMethod: 'electrostatic',
      });
    }
  }

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <CardContent>
          <Typography variant="h6">Statistics</Typography>
          <StatisticsTable y={data} />
        </CardContent>
      </Card>
      <Card className={style.card}>
        <CardContent>
          <Typography variant="h6" />
          <Graph
            y={data}
            start={payload.start}
            step={payload.step}
            defaultPrecision={defaultPrecision}
            xLabel={xLabel}
            xScaleFactor={xScaleFactor}
            yLabel={yLabel}
            onSelect={setSelected}
            selected={selected}
            mean={false}
            standardDeviation={false}
            startKeys={2}
          />
        </CardContent>
      </Card>
      {showDND && (
        <NGLViewerSpawner
          accession={accession}
          analysis={'rmsd'}
          selected={selected}
          chains={chainsNGL}
        />
      )}
    </Suspense>
  );
};

export default InterfaceAnalysis;
