import React, { Suspense, useMemo } from 'react';

import { CardContent } from '@material-ui/core';

import style from './style.module.css';

import D3HeatmapGrid from '../d3-heatmap-grid';

import ColorLegend from '../color-legend';

const Heatmap = ({
  // The API url to load the main data
  // The expected data format is an array of arrays, where each array is a heatmap row
  inputData,
  // Maximum number of x and y cells
  xMaxCells = 110,
  yMaxCells = 260,
  // Function to be called when the user clicks in a heatmap cell
  onClick,
  // Title to be rendered over the legend
  // No legend will be rendered if it is blank
  legendTitle = '',
  // New color systems
  maxColor,
  minColor,
  xTitle,
  yTitle,
}) => {
  // Data processing
  const { data, xLabels, yLabels, minValue, maxValue } = useMemo(() => {
    // Return if the payload is not ready
    if (!inputData || !inputData.data || inputData.data.length === 0) return;

    // Get the data reference
    const rData = inputData.data;
    let rxLabels = inputData.xLabels;
    let ryLabels = inputData.yLabels;

    // Get data set x and y lengths
    const xLength = rData[0].length;
    const yLength = rData.length;

    const xstep = xLength / xMaxCells;
    const ystep = yLength / yMaxCells;

    // Get a reduced subset of data which respects the maximum x and y lengths
    let data;
    if (ystep <= 1) {
      if (xstep <= 1) {
        data = rData;
      } else {
        data = new Array(yLength);
        const summarizedIndexes = new Array(xMaxCells);
        for (let x = 0; x < xMaxCells; x++) {
          summarizedIndexes[x] = Math.round(x * xstep);
        }
        for (let y = 0; y < yLength; y++) {
          data[y] = summarizedIndexes.map(x => rData[y][x]);
        }
      }
    } else {
      data = new Array(yMaxCells);
      if (xstep <= 1) {
        for (let y = 0; y < yMaxCells; y++) {
          data[y] = rData[Math.round(y * ystep)];
        }
      } else {
        const summarizedIndexes = new Array(xMaxCells);
        for (let x = 0; x < xMaxCells; x++) {
          summarizedIndexes[x] = Math.round(x * xstep);
        }
        for (let y = 0; y < yMaxCells; y++) {
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
      xLabels = new Array(xMaxCells);
      for (let i = 0; i < xMaxCells; i++)
        xLabels[i] = rxLabels[Math.round(i * xstep)];
    }

    // y labels
    if (ystep <= 1) {
      yLabels = ryLabels;
    } else {
      yLabels = new Array(yMaxCells);
      for (let i = 0; i < yMaxCells; i++)
        yLabels[i] = ryLabels[Math.round(i * ystep)];
    }

    // Set the legend, which is another heatmap
    const minValue = Math.min(...data.map(values => Math.min(...values)));
    const maxValue = Math.max(...data.map(values => Math.max(...values)));

    // Save all processed data
    return {
      data: data,
      xLabels: xLabels,
      yLabels: yLabels,
      minValue: minValue,
      maxValue: maxValue,
    };
    // WARNING: Changes in 'inputData' may be not detected
  }, [inputData, xMaxCells, yMaxCells]);

  // Render loading or error messages according with the API response
  if (!inputData) return 'Heatmap Error: No "inputData" was provided';
  if (!inputData.data || inputData.data.length === 0)
    return 'Heatmap Error: The data field is empty or non existent';

  // Render
  return (
    <Suspense fallback={<div className={style.loading}>Loading...</div>}>
      <D3HeatmapGrid
        data={data}
        xAxisValues={xLabels}
        yAxisValues={yLabels}
        maxColor={maxColor}
        minColor={minColor}
        xAxisLabel={xTitle}
        yAxisLabel={yTitle}
        height={yLabels.length === 1 ? 150 : undefined}
        onClick={onClick ? d => onClick(d.x, d.y) : undefined}
      />
      {legendTitle && (
        <CardContent>
          <ColorLegend
            title={legendTitle}
            minValue={minValue}
            maxValue={maxValue}
            maxColor={maxColor}
            minColor={minColor}
          />
        </CardContent>
      )}
    </Suspense>
  );
};

export default Heatmap;
