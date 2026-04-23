import React, { useMemo } from 'react';

import { CardContent } from '@mui/material';

import D3HeatmapGrid from '../d3-heatmap-grid';

import ColorLegend from '../color-legend';

const Heatmap = ({
  // The expected data format is an complex object
  inputData,
  // Maximum number of x and y cells
  xMaxCells = 110,
  yMaxCells = 260,
  // Function to set what text must appear in the hover tooltip
  onTooltip,
  // Function to be called when the user clicks in a heatmap cell
  onClick,
  // Title to be rendered over the legend
  // No legend will be rendered if it is blank
  legendTitle = '',
  // Colors to represent the values range from lower to higher (e.g. ['red', 'white', 'blue'])
  colorPlan,
  // Titles for x and y axes
  xTitle,
  yTitle,
  minValue: customMinValue, // Add these new props
  maxValue: customMaxValue,
}) => {
  // Data processing
  const {
    data,
    xLabels,
    yLabels,
    minValue,
    maxValue,
    xstep,
    ystep,
  } = useMemo(() => {
    // Return if the payload is not ready
    if (!inputData || !inputData.data || inputData.data.length === 0) return {};

    // Get the data reference
    const rData = inputData.data;
    let rxLabels = inputData.xLabels;
    let ryLabels = inputData.yLabels;

    // Get data set x and y lengths
    const xLength = rData[0].length;
    const yLength = rData.length;

    // Check all rows to have the same length
    rData.forEach(row => {
      if (row.length !== xLength)
        throw new Error('All rows must have the same length');
    });

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
      // WARNING: Note that the list of lists has to be generated this way
      // WARNING: If you fill the first array with an array then it will be same array for all values
      data = new Array(yMaxCells).fill().map(u => new Array(xMaxCells).fill(null));
      if (xstep <= 1) {
        for (let y = 0; y < yMaxCells; y++) {
          data[y] = rData[Math.round(y * ystep)];
        }
      } else {
        for (let y = 0; y < yMaxCells; y++) {
          const yIndex = Math.round(y * ystep);
          for (let x = 0; x < xMaxCells; x++) {
            const xIndex = Math.round(x * xstep);
            data[y][x] = rData[yIndex][xIndex];
          }
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
    const validValues = data.flat().filter(value => !isNaN(value));
    const minValue = customMinValue ?? Math.min(...validValues);
    const maxValue = customMaxValue ?? Math.max(...validValues);

    // Save all processed data
    return {
      data: data,
      xLabels: xLabels,
      yLabels: yLabels,
      minValue: minValue,
      maxValue: maxValue,
      xstep,
      ystep,
    };
    // WARNING: Changes in 'inputData' may be not detected
  }, [inputData, xMaxCells, yMaxCells, customMinValue, customMaxValue]);

  // Render loading or error messages according with the API response
  if (!inputData) return 'Heatmap Error: No "inputData" was provided';
  if (!inputData.data || inputData.data.length === 0)
    return 'Heatmap Error: The data field is empty or non existent';

  // The main value and axes values are the same, but not the incides
  // Since we reduced the dataset we must convert indices in order to match the original dataset
  const convertMousePosition = ({
    xIndex,
    yIndex,
    value,
    xAxisValue,
    yAxisValue,
  }) => {
    const realXIndex = xstep <= 1 ? xIndex : Math.round(xIndex * xstep);
    const realYIndex = ystep <= 1 ? yIndex : Math.round(yIndex * ystep);
    return {
      xIndex: realXIndex,
      yIndex: realYIndex,
      value,
      xAxisValue,
      yAxisValue,
    };
  };

  const handleMouseClick = e => {
    if (!onClick) return;
    const mousePosition = convertMousePosition(e);
    return onClick(mousePosition);
  };

  const handleMouseTooltip = e => {
    if (!onTooltip) return;
    const mousePosition = convertMousePosition(e);
    return onTooltip(mousePosition);
  };

  // If there is only one column then make the heatmap shorter
  const rowsCount = data.length;
  const height = rowsCount === 1 ? '150px' : '600px';

  // Render
  return (
    <>
      <D3HeatmapGrid
        data={data}
        xAxisValues={xLabels}
        yAxisValues={yLabels}
        colorPlan={colorPlan}
        xAxisLabel={xTitle}
        yAxisLabel={yTitle}
        onClick={handleMouseClick}
        onTooltip={handleMouseTooltip}
        style={{ height: height, width: '100%' }}
        minValue={minValue}  // Add these
        maxValue={maxValue}
      />
      {legendTitle && (
        <CardContent>
          <ColorLegend
            title={legendTitle}
            minValue={minValue}
            maxValue={maxValue}
            colorPlan={colorPlan}
          />
        </CardContent>
      )}
    </>
  );
};

export default Heatmap;
