import React, { useRef, useEffect } from 'react';

import {
  range,
  max,
  select,
  scaleLinear,
  scaleBand,
  axisTop,
  axisLeft,
  mouse,
} from 'd3';

import style from './style.module.css';

const HorizontalBars = ({
  // The main data array
  data,
  // Y edge labels in string array format
  ylabels,
  // Set the maximum x engle value
  xMax,
  // Size parameters
  // WARNING: small widths seems to scale the whole component
  width = 500,
  height = 260,
  // Hooks
  setHovered,
  setSelected,
}) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!data) return 'Data is requiered';

    // This function allows to calculate the width of a given string text
    // The font for the calculation in the d3 default font
    const getTextWidth = text => {
      const canvas =
        getTextWidth.canvas ||
        (getTextWidth.canvas = document.createElement('canvas'));
      const context = canvas.getContext('2d');
      context.font = '10px sans-serif'; // The default d3 font
      const metrics = context.measureText(text);
      return metrics.width;
    };

    // Get the calculated widths of all y labels and select the maximum
    const maxYLabelWidth = max(ylabels.map(label => getTextWidth(label)));

    // Set the chart margins, using the maximum y label width as left margin
    const margin = { top: 30, right: 15, bottom: 10, left: maxYLabelWidth };

    const xMaximum = xMax || max(data, d => d);
    const x = scaleLinear()
      .domain([0, xMaximum])
      .range([margin.left, width - margin.right]);

    const y = scaleBand()
      .domain(range(data.length))
      .range([margin.top, height - margin.bottom])
      .padding(0.1); // Set padding between each bar
    // Get the bar hegiht, which is used further
    const barHeight = y.step();

    const xAxis = g =>
      g
        .attr('transform', `translate(0,${margin.top})`)
        .call(axisTop(x).ticks(width / 80, data.format))
        .call(g => g.select('.domain').remove());

    const yAxis = g =>
      g.attr('transform', `translate(${margin.left},0)`).call(
        axisLeft(y)
          .tickFormat(i => (ylabels && ylabels[i]) || null)
          .tickSizeOuter(0),
      );

    const chart = select(containerRef.current)
      .append('svg')
      .attr('viewBox', [0, 0, width, height]);

    chart
      .append('g')
      .attr('fill', 'steelblue')
      .selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', x(0))
      .attr('y', (d, i) => y(i))
      .attr(
        'width',
        d => (d / xMaximum) * (width - (margin.left + margin.right)),
      )
      .attr('height', y.bandwidth());

    chart.append('g').call(xAxis);

    chart.append('g').call(yAxis);

    // On mouse click, calculat over which bar is the mouse and return the corresponding data index
    chart.on('click', (_, index, nodes) => {
      const [, yValue] = mouse(nodes[index]);
      const positionIndex = Math.floor((yValue - margin.top) / barHeight);
      //console.log(yValue + ' -> ' + positionIndex);
      setSelected(positionIndex);
    });
  }, [data, height, setSelected, width, xMax, ylabels]);

  return <div className={style.chart} ref={containerRef} id={'container'} />;
};

export default HorizontalBars;
