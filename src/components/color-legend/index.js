import React, { useMemo } from 'react';

import { CardContent } from '@mui/material';

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
  flip = false,
  // Allow to force a custom className from the parent component
  className,
}) => {
  // Create a fake 'data' object for the heatmap
  const { legendData, legendLabels } = useMemo(() => {
    // Set the legend, which is another heatmap
    // Make labels for different value regions
    const values = [];
    // If the minimum and maximum are the same then there is only one label to show
    if (minValue === maxValue) values.push(minValue);
    // Otherwise make the different regions
    // WARNING: If we have same minimum and maximum values then the logic below will enter in an infinite loop
    else for (let i = minValue; i <= maxValue; i += (maxValue - minValue) / splits)
      values.push(i);

    // Round all values
    let legendLabels = values.map(val => Math.round(val));
    // If there is more than 1 label then the make sure all of them are unique
    // WARNING: If we have a single label  the logic below will enter in an infinite loop
    if (legendLabels.length > 1)
      // If there are repeated labels then we round to the next 10 fold lower scale until there are no more duplicates
      for (let decimal = 1; new Set(legendLabels).size < legendLabels.length; decimal++) {
        legendLabels = values.map(val => Math.round(val * 10 ** decimal) / 10 ** decimal);
      }

    // Data must be an array inside an array
    const legendData = vertical ? values.map(v => [v]) : [values];
    if (flip) {
      // Flip the legend data array
      legendData.reverse();
      legendLabels.reverse();
    }

    return { legendData, legendLabels };
  }, [maxValue, minValue, splits, vertical]);

  // Render
  return (
    <CardContent
      className={
        className ? className : vertical ? style.vertical : style.horizontal
      }
    >
      {title}
      <D3HeatmapGrid
        data={legendData}
        xAxisValues={vertical ? [''] : legendLabels}
        yAxisValues={vertical ? legendLabels : ['']}
        colorPlan={colorPlan}
        flippedXAxisValues={false}
        className={
          vertical ? style['heatmap-vertical'] : style['heatmap-horizontal']
        }
      />
    </CardContent>
  );
};

export default ColorLegend;
