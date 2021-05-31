import React, { useMemo } from 'react';

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
  // Colors to represent the values range from lower to higher (e.g. ['red', 'white', 'blue'])
  colorPlan,
  // Number of cells in the legend heatmap (i.e. how many times we split the color bar)
  splits = 19,
  // Set if the color bar must be veritcal
  vertical = false,
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
    for (
      let decimal = 1;
      new Set(legendLabels).size < legendLabels.length;
      decimal++
    ) {
      legendLabels = values.map(
        val => Math.round(val * 10 ** decimal) / 10 ** decimal,
      );
    }

    // Data must be an array inside an array
    const legendData = vertical ? values.map(v => [v]) : [values];
    return { legendData, legendLabels };
  }, [maxValue, minValue, splits, vertical]);

  // Render
  return (
    <CardContent className={vertical ? style.vertical : style.horizontal}>
      {title}
      <D3HeatmapGrid
        data={legendData}
        xAxisValues={vertical ? [''] : legendLabels}
        yAxisValues={vertical ? legendLabels : ['']}
        colorPlan={colorPlan}
        flippedXAxisValues={false}
      />
    </CardContent>
  );
};

export default ColorLegend;
