import React, { lazy, Suspense, useContext, useState } from 'react';

import { Card, CardContent, Typography } from '@material-ui/core';

import Loading from '../../../components/loading';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx, ProjectCtx, PdbCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

const Heatmap = lazy(() =>
  import(/* webpackChunkName: 'project-menu' */ '../../../components/heatmap'),
);

const DistPerres = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project chains
  const { chains } = useContext(ProjectCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/dist-perres-mean/`,
  );

  // The selected heatmap cell [x,y]
  const [selected, setSelected] = useState(null);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  // Get data set x and y lengths
  const xLength = payload.y[0].length;
  const yLength = payload.y.length;

  // Set how many labels there must be
  const xMax = 110;
  const yMax = 260;

  const xstep = xLength / xMax;
  const ystep = yLength / yMax;

  // Get a reduced subset of data which respects the maximum x and y lengths
  let data;
  if (ystep <= 1) {
    if (xstep <= 1) {
      data = payload.y;
    } else {
      data = new Array(yLength);
      const summarizedIndexes = new Array(xMax);
      for (let x = 0; x < xMax; x++) {
        summarizedIndexes[x] = Math.round(x * xstep);
      }
      for (let y = 0; y < yLength; y++) {
        data[y] = summarizedIndexes.map(x => payload.y[y][x]);
      }
    }
  } else {
    data = new Array(yMax);
    if (xstep <= 1) {
      for (let y = 0; y < yMax; y++) {
        data[y] = payload.y[Math.round(y * ystep)];
      }
    } else {
      const summarizedIndexes = new Array(xMax);
      for (let x = 0; x < xMax; x++) {
        summarizedIndexes[x] = Math.round(x * xstep);
      }
      for (let y = 0; y < yMax; y++) {
        data[y] = summarizedIndexes.map(x => payload.y[y][x]);
      }
    }
  }

  // Set the heatmap labels
  let xLabels;
  let yLabels;

  // How many rows/columns are for every displayed label
  const xLabelStep = 10;
  const yLabelStep = 10;

  // x labels
  if (xstep <= 1) {
    xLabels = new Array(xLength);
    for (let i = 0; i < xLength; i++)
      // If this is multiple of the step
      if (i % xLabelStep === 0) xLabels[i] = i;
      else xLabels[i] = '';
  } else {
    xLabels = new Array(xMax);
    for (let i = 0; i < xMax; i++)
      // If this is multiple of the step
      if (i % xLabelStep === 0) xLabels[i] = Math.round(i * xstep);
      else xLabels[i] = '';
  }

  // y labels
  if (ystep <= 1) {
    yLabels = new Array(yLength);
    for (let i = 0; i < yLength; i++)
      // If this is multiple of the step
      if (i % yLabelStep === 0) yLabels[i] = i;
      else yLabels[i] = '';
  } else {
    yLabels = new Array(yMax);
    for (let i = 0; i < yMax; i++)
      // If this is multiple of the step
      if (i % yLabelStep === 0) yLabels[i] = Math.round(i * ystep);
      else yLabels[i] = '';
  }

  // Set the legend, which is another heatmap
  const minValue = Math.min(...data.map(values => Math.min(...values)));
  const maxValue = Math.max(...data.map(values => Math.max(...values)));
  const values = [];
  for (let i = minValue; i <= maxValue; i += (maxValue - minValue) / 10)
    values.push(Math.round(i));
  // Data mas be an array inside an array
  const legendData = [values];

  // Color interpolation from red (closest) to blue (farest)
  const colorinter = (value, min, max) => {
    const prop = 1 - (max - value) / (max - min);
    if (prop < 0.5) {
      const curved = 1 - (2 * prop * prop + prop);
      return `rgba(255, 0, 0, ${curved})`;
    } else {
      const curved = 1 - (4 * prop * prop - 8 * prop + 4);
      return `rgba(0, 0, 255, ${curved})`;
    }
  };

  // Get first atom number from resiude number
  const residue2atom = residue => {
    // get a list with the atom count of each resiude in order
    const atomCounts = pdbData.file.residueStore.atomCount;
    let atom = 0;
    for (let r = 0; r < residue; r++) atom += atomCounts[r];
    return atom;
  };

  // Set the chains to be represented in the NGL viewer
  const chainsNGL = [];
  for (const chain of chains) {
    chainsNGL.push({
      name: 'Chain ' + chain,
      selection: ':' + chain,
    });
  }

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Typography variant="h5">Residues distance averages</Typography>
      <Heatmap
        data={data}
        xLabels={xLabels}
        yLabels={yLabels}
        xLabelsLocation={'bottom'}
        // Cells width is automatically calculated from number of labels to display and available space
        // Cells height is set here and it will take as much space as needed
        height={2}
        cellStyle={(background, value, min, max, data, x, y) => ({
          background: colorinter(value, min, max),
          margin: '0px',
        })}
        onClick={(x, y) =>
          setSelected([
            residue2atom(Math.round(x * xstep) + yLength),
            residue2atom(Math.round(y * ystep)),
          ])
        }
      />
      <Card className={style.card}>
        <CardContent>
          <Typography variant="h6">Legend</Typography>
          <Heatmap
            data={legendData}
            xLabels={values}
            yLabels={['']}
            xLabelsLocation={'bottom'}
            yLabelWidth={0}
            cellStyle={(background, value, min, max, data, x, y) => ({
              background: colorinter(value, min, max),
              margin: '0px',
            })}
          />
        </CardContent>
      </Card>

      {selected && (
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

export default DistPerres;
