import React, { Suspense, useRef, useMemo } from 'react';

import { Card, CardContent, Typography } from '@material-ui/core';

import Loading from '../loading';

import style from './style.module.css';

// Heatmap moduel: https://www.npmjs.com/package/react-heatmap-grid
import HeatmapGrid from 'react-heatmap-grid';

// Takes a string array and return the array after converting some strings in ''
// It is useful to delete some labels, so they are not all displayed
const labelStepper = (labels, step) => {
  // Copy the labels array into a new array
  // IMPORTANT: Do no overwrite the labels array, because we need it further
  const newLabels = [...labels];
  // If this is not multiple of the label step, delete the label setting it as ''
  for (const l in newLabels) if (l % step !== 0) newLabels[l] = '';
  return newLabels;
};

const Heatmap = ({
  // The API url to load the main data
  // The expected data format is an array of arrays, where each array is a heatmap row
  inputData,
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
  const processedData = useRef({});

  // Data processing
  useMemo(() => {
    // Return if the payload is not ready
    if (!inputData || !inputData.data || inputData.data.length === 0) return;

    // Get the data reference
    const rData = inputData.data;
    let rxLabels = inputData.xLabels;
    let ryLabels = inputData.yLabels;

    // Get data set x and y lengths
    const xLength = rData[0].length;
    const yLength = rData.length;

    // Set how many labels there must be
    const xMax = xMaxCells;
    const yMax = yMaxCells;

    const xstep = xLength / xMax;
    const ystep = yLength / yMax;

    // Get a reduced subset of data which respects the maximum x and y lengths
    let data;
    if (ystep <= 1) {
      if (xstep <= 1) {
        data = rData;
      } else {
        data = new Array(yLength);
        const summarizedIndexes = new Array(xMax);
        for (let x = 0; x < xMax; x++) {
          summarizedIndexes[x] = Math.round(x * xstep);
        }
        for (let y = 0; y < yLength; y++) {
          data[y] = summarizedIndexes.map(x => rData[y][x]);
        }
      }
    } else {
      data = new Array(yMax);
      if (xstep <= 1) {
        for (let y = 0; y < yMax; y++) {
          data[y] = rData[Math.round(y * ystep)];
        }
      } else {
        const summarizedIndexes = new Array(xMax);
        for (let x = 0; x < xMax; x++) {
          summarizedIndexes[x] = Math.round(x * xstep);
        }
        for (let y = 0; y < yMax; y++) {
          data[y] = summarizedIndexes.map(x => rData[y][x]);
        }
      }
    }

    // Create 1-n labels if they are not provided
    if (!rxLabels) rxLabels = Array.from(Array(xLength).keys());
    if (!ryLabels) ryLabels = Array.from(Array(yLength).keys());

    // Check that both lengths match as they should
    if (xLength !== rxLabels.length)
      console.error('Heatmap error: x labels do not match data dimensions');
    if (yLength !== ryLabels.length)
      console.error('Heatmap error: y labels do not match data dimensions');

    // Set the heatmap labels
    let xLabels;
    let yLabels;

    // x labels
    if (xstep <= 1) {
      xLabels = rxLabels;
    } else {
      xLabels = new Array(xMax);
      for (let i = 0; i < xMax; i++)
        xLabels[i] = rxLabels[Math.round(i * xstep)];
    }

    // y labels
    if (ystep <= 1) {
      yLabels = ryLabels;
    } else {
      yLabels = new Array(yMax);
      for (let i = 0; i < yMax; i++)
        yLabels[i] = ryLabels[Math.round(i * ystep)];
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
    // WARNING: Changes in 'inputData' may be not detected
  }, [inputData, xMaxCells, yMaxCells, legendLength, totalHeight]);

  // Render loading or error messages according with the API response
  if (!inputData) return 'Heatmap Error: No "inputData" was provided';
  if (!inputData.data || inputData.data.length === 0)
    return 'Heatmap Error: The data field is empty or non existent';

  // Retrieve all processed data
  const {
    data,
    xLabels,
    yLabels,
    legendData,
    legendLabels,
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
        xLabels={labelStepper(xLabels, xLabelStep)}
        yLabels={labelStepper(yLabels, yLabelStep)}
        xLabelsLocation={'bottom'}
        // Cells width is automatically calculated from number of labels to display and available space
        // Cells height is set here and it will take as much space as needed
        height={cellHeight}
        cellStyle={(background, value, min, max, data, x, y) => ({
          background: colorinter(value, min, max),
          margin: '0px',
        })}
        onClick={
          onClick ? (x, y) => onClick(xLabels[x], yLabels[y]) : undefined
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
