import React, { Suspense, useRef, useEffect, memo } from 'react';

import Loading from '../loading';

import { getTextWidth, getTextSizeDOM } from '../../utils/document-measurer';

import {
  axisBottom,
  select,
  scaleLinear,
  scaleBand,
  axisLeft,
  mouse,
} from 'd3';

// According to d3 documentation
const defaultD3font = 'normal 10px sans-serif';

// DANI: Ni este 'memo' ni el 'useMemo' de dentro funcionan. Siempre se vuelve a calcular
// Lo óptimo sería que funcionase, ya que cada vez que el ususario hace click todo se vuelve a cargar
// Hay que construir una 'comparision function': https://reactjs.org/docs/react-api.html#reactmemo
const D3HeatmapGrid = memo(
  ({
    data, // The main values
    xLabels = [], // String labels for the horizontal axis
    yLabels = [], // String labels for the vertical axis
    xTitle, // String title for the horizontal axis
    yTitle, // String title for the vertical axis
    titlesFont = 'normal 14px sans-serif', // Experimentally verfied
    width = 1000,
    height = 600,
    verticalPadding = 0,
    maxColor = 'blue',
    midColor = 'white',
    minColor = 'red',
    onTooltip, // Text to be rendered on the tooltip
    onClick, // Function to be called when clicking on the heatmap
  }) => {
    if (!data)
      throw new Error(
        `Data is missing. Data is mandatory for the heatmap representation`,
      );
    // If any label is empty, fill it with 1-n numbers
    if (xLabels.length === 0)
      xLabels = Array.from(Array(data[0].length).keys());
    if (yLabels.length === 0)
      yLabels = Array.from(Array(data[0].length).keys());

    // Convert data to heatmap friendly format

    // Join all rows into a single array with all values
    const values = [].concat(...data);
    // Save the maximum and minimum values
    const maxv = Math.max(...values);
    const minv = Math.min(...values);
    // Repeat the x labels as many times as rows are there
    const xlabs = [].concat(...Array(data.length).fill(xLabels));
    // Repeat each y label as many times as rows are there
    const ylabs = [];
    for (const lab of yLabels) ylabs.push(...Array(xLabels.length).fill(lab));
    // Fill an array with an object fo each d, x and y
    const fdata = [];
    for (const i in values) {
      fdata.push({ v: values[i], x: xlabs[i], y: ylabs[i] });
    }

    // Set the reference to the element where the graph will be allocated
    const containerRef = useRef(null);
    // Save the previous chart reference so we can remove it before a new render
    const previousCharts = useRef(null);

    // Get the calculated widths of all y labels and select the maximum
    // In addition, add a small margin between labels and the axis which is added further
    // This margin is only in x axes, which are rotated 90 degrees and end too much close to the axis
    const xLabelsMargin = 9; // In px
    const maxXLabelWidth =
      Math.max(...xLabels.map(label => getTextWidth(label, defaultD3font))) +
      xLabelsMargin;
    // Get the calculated widths of all y labels and select the maximum
    const maxYLabelWidth = Math.max(
      ...yLabels.map(label => getTextWidth(label, defaultD3font)),
    );

    // In addition, add a small margin between labels and the axis which is added further
    // This margin is only in x axes, which are rotated 90 degrees and end too much close to the axis
    const yTitleMargin = 9; // Extra margin In px
    const titlesHeight = getTextSizeDOM('|', titlesFont).height;
    const xTitleHegiht = xTitle ? titlesHeight : 0;
    const yTitleHegiht = yTitle ? titlesHeight + yTitleMargin : 0;

    // Finally, estimate the space need by axes, titles, etc.
    const requiredXMargin = maxXLabelWidth + xTitleHegiht;
    // DANI: Aquí no debería ir la default font, sino la titlesFont. Sin embargo queda mejor así.
    const requiredYMargin =
      yLabels.length === 1
        ? Math.max(maxYLabelWidth, getTextWidth(yTitle, titlesFont))
        : maxYLabelWidth + yTitleHegiht;

    // Set the dimensions and margins of the graph
    const margin = {
        top: 10,
        right: 10,
        bottom: requiredXMargin + 10,
        left: requiredYMargin + 10,
      },
      bodyWidth = width - margin.left - margin.right,
      bodyHeight = height - margin.top - margin.bottom;

    // Calculate how many labels we can show in any axis while avoiding overlapping
    // Take in count that bottom labels are rotated 90º, so it is their height that counts
    const labelsHeight = getTextSizeDOM('|', defaultD3font).height;
    const xSlots = bodyWidth / (labelsHeight * 1.05); // This '* 1.05' is to grant a small padding
    const ySlots = bodyHeight / (labelsHeight * 1.05); // This '* 1.05' is to grant a small padding

    // Estimate how many labels we must skip to reach the desired number
    const xstep = Math.ceil(xLabels.length / xSlots);
    const ystep = Math.ceil(yLabels.length / ySlots);

    // The chart is assigned to a referenced 'div' which must be rendered first
    // All this process is runned after the render
    useEffect(() => {
      // Reset the chart
      // WARNING: For some reason, if this part is re-render the original render is not gone
      // WARNING: We must reset the element manually or infinite elements are rendered and stacked
      if (previousCharts.current)
        previousCharts.current.forEach(chart => chart.remove());

      // append the svg object to the body of the page
      const svg = select(containerRef.current)
        .append('svg')
        .attr('viewBox', [
          0,
          0,
          bodyWidth + margin.left + margin.right,
          bodyHeight + margin.top + margin.bottom,
        ]);

      // Build X scales and axis:
      const x = scaleBand()
        .range([margin.left, bodyWidth + margin.left])
        .domain(xLabels)
        .paddingInner(0);

      svg
        .append('g')
        .attr('transform', 'translate(0,' + (bodyHeight + margin.top) + ')')
        .call(
          axisBottom(x).tickFormat((d, i) => {
            if (i % xstep === 0) return d;
            else return '';
          }),
        )
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', -xLabelsMargin + 'px')
        .attr('dy', -xLabelsMargin + 'px')
        .attr('transform', 'rotate(-90)');

      // Build the X axis title
      svg
        .append('text')
        .attr('class', 'x label')
        .attr('text-anchor', 'middle')
        .attr('x', margin.left + bodyWidth / 2)
        .attr('y', margin.top + bodyHeight + maxXLabelWidth + xTitleHegiht)
        .text(xTitle);

      // Build Y scales and axis:
      const y = scaleBand()
        .domain(yLabels)
        .range([margin.top, bodyHeight + margin.top])
        .padding(verticalPadding);

      svg
        .append('g')
        .attr('transform', 'translate(' + margin.left + ', 0)')
        .call(
          axisLeft(y).tickFormat((d, i) => {
            if (i % ystep === 0) return d;
            else return '';
          }),
        );

      // Build the Y axis title
      if (yLabels.length === 1) {
        svg
          .append('text')
          .attr('class', 'y label')
          .attr('text-anchor', 'start')
          .attr('x', 0)
          .attr('y', yTitleHegiht - yTitleMargin)
          .text(yTitle);
      } else {
        svg
          .append('text')
          .attr('class', 'y label')
          .attr('text-anchor', 'middle')
          .attr('x', -(margin.top + bodyHeight / 2))
          .attr('y', yTitleHegiht - yTitleMargin)
          .attr('transform', 'rotate(-90)')
          .text(yTitle);
      }

      // Build color scale
      const myColor = scaleLinear()
        .range([minColor, midColor, maxColor])
        .domain([minv, (minv + maxv) / 2, maxv]);

      // Create a tooltip
      var tooltip = select(containerRef.current)
        .append('div')
        .style('opacity', 0)
        .attr('class', 'tooltip')
        .style('background-color', 'white')
        .style('border', 'solid')
        .style('border-width', '2px')
        .style('border-radius', '5px')
        .style('padding', '5px')
        .style('position', 'absolute');

      // Three functions that change the tooltip when user hover / move / leave a cell
      const mouseover = () => {
        tooltip.style('opacity', 1);
      };
      // WARNING: Arrow function here makes it crash. I dont know why
      const mousemove = function(d) {
        tooltip
          .html(
            onTooltip
              ? onTooltip(d)
              : d.x + ' - ' + d.y + '<br>' + Math.round(d.v * 100) / 100,
          )
          .style('left', () => {
            return mouse(this)[0] > margin.left + bodyWidth / 2
              ? mouse(this)[0] - 150 + 'px'
              : mouse(this)[0] + 50 + 'px';
          })
          .style('top', () => {
            return mouse(this)[1] > margin.top + bodyHeight / 2
              ? mouse(this)[1] + 'px'
              : mouse(this)[1] + 150 + 'px';
          });
        //.style("top", (mouse(this)[1]) + "px")
      };
      const mouseleave = () => {
        tooltip.style('opacity', 0);
      };
      const mouseclick = d => {
        if (onClick) onClick(d);
      };

      // Draw the heatmap cells
      svg
        .selectAll()
        .data(fdata)
        .enter()
        .append('rect')
        .attr('x', d => x(d.x))
        .attr('y', d => y(d.y))
        .attr('width', x.bandwidth()) // This * 1.05 is to remove the small gap between cells
        .attr('height', y.bandwidth()) // Padding is 0 but it is still there
        .style('fill', (d, i) => myColor(d.v))
        .on('mouseover', mouseover)
        .on('mousemove', mousemove)
        .on('mouseleave', mouseleave)
        .on('click', mouseclick);

      previousCharts.current = [svg, tooltip];
    }); // This useEffect has no dependencies

    // Finally, render the heatmap
    return (
      <Suspense fallback={<Loading />}>
        <div ref={containerRef} id={'container'} />
      </Suspense>
    );
  },
);

export default D3HeatmapGrid;
