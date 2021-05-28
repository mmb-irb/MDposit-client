import React, { Suspense, useMemo } from 'react';

import { CardContent } from '@material-ui/core';

import style from './style.module.css';

import D3HeatmapGrid from '../d3-heatmap-grid';

// Display a color legend using the d3 heatmap
const ColorLegend = ({
  // Title to be rendered over the legend
  title = '',
  // Maximum and minimum possible values
  maxValue = 1,
  minValue = 0,
  // Color to represent the maximum and minimum values in rgb format {r:r,g:g,b:b}
  maxColor = 'red',
  minColor = 'blue',
  // Number of cells in the legend heatmap (i.e. how many times we split the color bar)
  splits = 19,
}) => {
  // Create a fake 'data' object for the heatmap
  const { legendData, legendLabels } = useMemo(() => {
    // Set the legend, which is another heatmap
    const values = [];
    for (let i = minValue; i <= maxValue; i += (maxValue - minValue) / splits)
      values.push(i);

    let legendLabels;
    // Round all values
    legendLabels = values.map(val => Math.round(val));
    // If are there repeated labels we round to decimals
    if (new Set(legendLabels).size < legendLabels.length)
      legendLabels = values.map(val => Math.round(val * 10) / 10);
    // If are there repeated labels we round to centesimals
    if (new Set(legendLabels).size < legendLabels.length)
      legendLabels = values.map(val => Math.round(val * 100) / 100);
    // If are there repeated labels you may consider what you are loading :)

    // Data must be an array inside an array
    const legendData = [values];
    return { legendData, legendLabels };
  }, [maxValue, minValue, splits]);

  // Render
  return (
    <Suspense fallback={<div className={style.loading}>Loading...</div>}>
      <CardContent className={style.horizontal}>
        {title}
        <D3HeatmapGrid
          data={legendData}
          xAxisValues={legendLabels}
          yAxisValues={['']}
          maxColor={maxColor}
          minColor={minColor}
          flippedXAxisValues={false}
          height={80}
        />
      </CardContent>
    </Suspense>
  );
};

export default ColorLegend;
