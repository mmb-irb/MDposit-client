import React, { Suspense, useRef, useMemo } from 'react';

import { Card, CardContent, Typography } from '@material-ui/core';

import Loading from '../loading';

import useAPI from '../../hooks/use-api';

import style from './style.module.css';

// Heatmap moduel: https://www.npmjs.com/package/react-heatmap-grid
import HeatmapGrid from 'react-heatmap-grid';

import { range } from 'lodash-es';

const Heatmap = ({
  // The API url to load the main data
  // The expected data format is an array of arrays, where each array is a heatmap row
  url,
  // Residues to filter
  searchResidues,
  // Maximum number of x and y cells
  xMaxCells = 110,
  yMaxCells = 260,
  // Total heatmap height (no cell height)
  // In case the cell number does not reach the maximum, cells are enlarged
  totalHeight = 520,
  // Function to be called when the user clicks in a heatmap cell
  onClick,
  // Title to be rendered over the legend
  // No legend will be rendered if it is blank
  legendTitle = '',
  legendLength = 11,
  // Color to represent the maximum and minimum values in rgb format {r:r,g:g,b:b}
  maxValueColor = { r: 255, g: 0, b: 0 },
  minValueColor = { r: 0, g: 0, b: 255 },
  // How many rows/columns are for every displayed label
  xLabelStep = 10,
  yLabelStep = 10,
}) => {
  // The stored previous data
  const filteredData = useRef(null);
  const processedData = useRef({});

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(url);

  // DANI: Esto debería ir en el análisis, no aquí
  // Filter data by selected residues
  useMemo(() => {
    // Return if the payload is not ready
    if (loading || error || !payload) return;

    // Return the intact payload if there is no selection
    if (!searchResidues) {
      filteredData.current = payload.y;
      return;
    }

    // Filter data
    const selection = searchResidues.split(',');
    const ranged = /^([0-9]*)-([0-9]*)$/;
    const curatedSelection = [];
    for (const res of selection) {
      if (res.match(ranged)) {
        const matches = ranged.exec(res);
        const resiudes = range(+matches[1], +matches[2] + 1);
        curatedSelection.push(...resiudes);
      } else curatedSelection.push(+res);
    }

    // Get data set x and y lengths
    const yLength = payload.y.length;

    const xSelection = [];
    const ySelection = [];
    for (const res of curatedSelection) {
      if (res < yLength) {
        ySelection.push(res);
      } else {
        xSelection.push(res);
      }
    }

    const selectedData = [];
    for (const row of ySelection) {
      const newRow = [];
      for (const value of xSelection)
        newRow.push(payload.y[row][value - yLength]);
      selectedData.push(newRow);
    }

    filteredData.current = selectedData;
  }, [loading, error, payload, searchResidues]);

  // Data processing
  useMemo(() => {
    // Return if the payload is not ready
    if (!filteredData.current) return;

    // Get the data reference
    const fData = filteredData.current;

    // Get data set x and y lengths
    const xLength = fData[0].length;
    const yLength = fData.length;

    // Set how many labels there must be
    const xMax = xMaxCells;
    const yMax = yMaxCells;

    const xstep = xLength / xMax;
    const ystep = yLength / yMax;

    // Get a reduced subset of data which respects the maximum x and y lengths
    let data;
    if (ystep <= 1) {
      if (xstep <= 1) {
        data = fData;
      } else {
        data = new Array(yLength);
        const summarizedIndexes = new Array(xMax);
        for (let x = 0; x < xMax; x++) {
          summarizedIndexes[x] = Math.round(x * xstep);
        }
        for (let y = 0; y < yLength; y++) {
          data[y] = summarizedIndexes.map(x => fData[y][x]);
        }
      }
    } else {
      data = new Array(yMax);
      if (xstep <= 1) {
        for (let y = 0; y < yMax; y++) {
          data[y] = fData[Math.round(y * ystep)];
        }
      } else {
        const summarizedIndexes = new Array(xMax);
        for (let x = 0; x < xMax; x++) {
          summarizedIndexes[x] = Math.round(x * xstep);
        }
        for (let y = 0; y < yMax; y++) {
          data[y] = summarizedIndexes.map(x => fData[y][x]);
        }
      }
    }

    // Set the heatmap labels
    let xLabels;
    let yLabels;

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

    // Set the cells height to reach the specified height
    let cellHeight;
    if (ystep <= 1) cellHeight = totalHeight / yLength;
    else cellHeight = totalHeight / yMax;

    // Set the legend, which is another heatmap
    const minValue = Math.min(...data.map(values => Math.min(...values)));
    const maxValue = Math.max(...data.map(values => Math.max(...values)));
    const legendLabels = [];
    for (
      let i = minValue;
      i <= maxValue;
      i += (maxValue - minValue) / legendLength
    )
      legendLabels.push(Math.round(i));
    // Data must be an array inside an array
    const legendData = [legendLabels];

    // Save all processed data
    processedData.current = {
      data: data,
      xLabels: xLabels,
      yLabels: yLabels,
      legendData: legendData,
      legendLabels: legendLabels,
      xstep: xstep,
      ystep: ystep,
      yLength: yLength,
      cellHeight: cellHeight,
    };
    // WARNING: Changes in 'filteredData' may be not detected
  }, [
    filteredData.current,
    xMaxCells,
    yMaxCells,
    legendLength,
    xLabelStep,
    yLabelStep,
    totalHeight,
    searchResidues,
  ]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  // Retrieve all processed data
  const {
    data,
    xLabels,
    yLabels,
    legendData,
    legendLabels,
    xstep,
    ystep,
    yLength,
    cellHeight,
  } = processedData.current;

  // Color interpolation from red (closest) to blue (farest)
  const colorinter = (value, min, max) => {
    const prop = 1 - (max - value) / (max - min);
    if (prop < 0.5) {
      const curved = 1 - (2 * prop * prop + prop);
      return `rgba(${minValueColor.r}, ${minValueColor.g}, ${minValueColor.b}, ${curved})`;
    } else {
      const curved = 1 - (4 * prop * prop - 8 * prop + 4);
      return `rgba(${maxValueColor.r}, ${maxValueColor.g}, ${maxValueColor.b}, ${curved})`;
    }
  };

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <HeatmapGrid
        data={data}
        xLabels={xLabels}
        yLabels={yLabels}
        xLabelsLocation={'bottom'}
        // Cells width is automatically calculated from number of labels to display and available space
        // Cells height is set here and it will take as much space as needed
        height={cellHeight}
        cellStyle={(background, value, min, max, data, x, y) => ({
          background: colorinter(value, min, max),
          margin: '0px',
        })}
        onClick={
          onClick
            ? (x, y) =>
                onClick(
                  // DANI: Hay que revisar si el + 1 este va bien
                  Math.round(x * xstep) + yLength + 1,
                  Math.round(y * ystep),
                )
            : undefined
        }
      />
      {legendTitle && (
        <Card className={style.card}>
          <CardContent>
            <Typography variant="h6">{legendTitle}</Typography>
            <HeatmapGrid
              data={legendData}
              xLabels={legendLabels}
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
      )}
    </Suspense>
  );
};

export default Heatmap;
