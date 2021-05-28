import React, { Suspense, useRef, useEffect, memo } from 'react';

import Loading from '../loading';

import { getTextWidth, getTextSizeDOM } from '../../utils/document-measurer';

import { axisBottom, select, scaleLinear, scaleBand, axisLeft } from 'd3';

import { setTooltipPosition } from '../../utils/tooltip-position-manager';

// According to d3 documentation
const defaultD3font = 'normal 10px sans-serif';
// Experimentally verfied
const titlesD3font = 'normal 14px sans-serif';

// DANI: Ni este 'memo' ni el 'useMemo' de dentro funcionan. Siempre se vuelve a calcular
// Lo óptimo sería que funcionase, ya que cada vez que el ususario hace click todo se vuelve a cargar
// Hay que construir una 'comparision function': https://reactjs.org/docs/react-api.html#reactmemo

// Input 'data' is expected to be an array of arrays (i.e. a matrix)
const D3HeatmapGrid = memo(
  ({
    data, // The main values
    xAxisValues = [], // String labels for the horizontal axis
    yAxisValues = [], // String labels for the vertical axis
    xAxisLabel, // String title for the horizontal axis
    yAxisLabel, // String title for the vertical axis
    width = 1000,
    height = 600,
    verticalPadding = 0,
    maxColor = 'blue',
    midColor = 'white',
    minColor = 'red',
    onTooltip, // Text to be rendered on the tooltip
    onClick, // Function to be called when clicking on the heatmap
    flippedXAxisValues = true, // Set if values in x axis is horizontal (false) or vertical (true)
    margin = { top: 10, right: 10, bottom: 10, left: 10 },
  }) => {
    if (!data)
      throw new Error(
        `Data is missing. Data is mandatory for the heatmap representation`,
      );
    // Check that there are no duplicates in both x and y axes values
    // WARNING: Duplicates would not make the heatmap fail, but they will result in overlaps
    if (xAxisValues.length !== new Set(xAxisValues).size) {
      console.log(xAxisValues);
      throw new Error(`Duplicated values in the X axis`);
    }
    if (yAxisValues.length !== new Set(yAxisValues).size) {
      console.log(yAxisValues);
      throw new Error(`Duplicated values in the Y axis`);
    }

    // If any label is empty, fill it with 1-n numbers
    if (xAxisValues.length === 0)
      xAxisValues = Array.from(Array(data[0].length).keys());
    if (yAxisValues.length === 0)
      yAxisValues = Array.from(Array(data[0].length).keys());

    // Convert data to heatmap friendly format

    // Join all rows into a single array with all values
    const values = [].concat(...data);
    // Save the maximum and minimum values
    const maxv = Math.max(...values);
    const minv = Math.min(...values);
    // Repeat the x labels as many times as rows are there
    const xlabs = [].concat(...Array(data.length).fill(xAxisValues));
    // Repeat each y label as many times as rows are there
    const ylabs = [];
    for (const lab of yAxisValues)
      ylabs.push(...Array(xAxisValues.length).fill(lab));
    // Fill an array with an object fo each d, x and y
    const fdata = [];
    for (const i in values) {
      fdata.push({ v: values[i], x: xlabs[i], y: ylabs[i] });
    }

    // Set the reference to the element where the heatmap will be allocated
    const containerRef = useRef(null);
    // Save the previous chart reference so we can remove it before a new render
    const previousCharts = useRef(null);

    // ----------------------------------------------------------------------------------------

    // OFFSETS: Estimate the space needed for all the labels and titles to not overlap

    // Set a small offset to be added between normal labels and 90 degrees rotated labels
    // This offset is added between the y labels (normal) and the y title (rotated)
    // This offset is added between the x labels (rotated) and the x title (normal)
    const roatatedTextOffset = 9; // In px

    // Set a small offset to keep away the axis labels and the axis values
    // They are very close to the axis values by default
    const axisLabelsOffset = 9; // In px

    // Measure the height of normal and text and labels
    const textHeight = getTextSizeDOM('|', defaultD3font).height;
    const labelsHeight =
      getTextSizeDOM('|', titlesD3font).height + axisLabelsOffset;

    // Get the calculated widths of all y labels and select the maximum
    // In addition, add a small offset between labels and the axis which is added further
    // This offset is only in x axes, which are rotated 90 degrees and end too much close to the axis
    const maxXAxisWidth =
      Math.max(
        ...xAxisValues.map(label => getTextWidth(label, defaultD3font)),
      ) + roatatedTextOffset;
    // Get the calculated widths of all y labels and select the maximum
    const maxYAxisWidth = Math.max(
      ...yAxisValues.map(label => getTextWidth(label, defaultD3font)),
    );

    // In addition, add a small offset between labels and the axis which is added further
    // This offset is only in x axes, which are rotated 90 degrees and end too much close to the axis
    const xAxisLabelHegiht = xAxisLabel ? labelsHeight : 0;
    const yAxisLabelHegiht = yAxisLabel ? labelsHeight + roatatedTextOffset : 0;

    // Finally, estimate the space needed by axes, titles, etc.
    const requiredXOffset = flippedXAxisValues
      ? maxXAxisWidth + xAxisLabelHegiht
      : textHeight + xAxisLabelHegiht;
    const requiredYOffset =
      yAxisValues.length === 1
        ? Math.max(maxYAxisWidth, getTextWidth(yAxisLabel, titlesD3font))
        : maxYAxisWidth + yAxisLabelHegiht;

    // Set the dimensions and offsets of the graph
    const offset = {
        top: margin.top,
        right: margin.right,
        bottom: requiredXOffset + margin.bottom,
        left: requiredYOffset + margin.left,
      },
      bodyWidth = width - offset.left - offset.right,
      bodyHeight = height - offset.top - offset.bottom;

    // ----------------------------------------------------------------------------------------

    // Calculate how many labels we can show in any axis while avoiding overlapping
    // Take in count that bottom labels are rotated 90º, so it is their height that counts
    // The '* 1.05' is to grant a small padding
    const xSlots =
      bodyWidth / ((flippedXAxisValues ? textHeight : maxXAxisWidth) * 1.05);
    const ySlots = bodyHeight / (textHeight * 1.05);

    // Estimate how many labels we must skip to reach the desired number
    const xstep = Math.ceil(xAxisValues.length / xSlots);
    const ystep = Math.ceil(yAxisValues.length / ySlots);

    // The chart is assigned to a referenced 'div' which must be rendered first
    // All this process is runned after the render
    useEffect(() => {
      // Reset the chart
      // WARNING: For some reason, if this part is re-render the original render is not gone
      // WARNING: We must reset the element manually or infinite elements are rendered and stacked
      if (previousCharts.current)
        previousCharts.current.forEach(chart => chart.remove());

      const container = containerRef.current;

      // append the svg object to the body of the page
      const svg = select(container)
        .append('svg')
        .attr('id', 'svg')
        .attr('viewBox', [0, 0, width, height]);

      // Build X scales and axis:
      const x = scaleBand()
        .range([offset.left, bodyWidth + offset.left])
        .domain(xAxisValues)
        .paddingInner(0);

      const xAxis = svg
        .append('g')
        .attr('transform', 'translate(0,' + (bodyHeight + offset.top) + ')')
        .call(
          axisBottom(x).tickFormat((d, i) => {
            if (i % xstep === 0) return d;
            else return '';
          }),
        )
        .selectAll('text');

      if (flippedXAxisValues) {
        xAxis
          .style('text-anchor', 'end')
          .attr('dx', -roatatedTextOffset + 'px')
          .attr('dy', -roatatedTextOffset + 'px')
          .attr('transform', 'rotate(-90)');
      }

      // Build the X axis label
      svg
        .append('text')
        .attr('class', 'x label')
        .attr('text-anchor', 'middle')
        .attr('x', offset.left + bodyWidth / 2)
        .attr('y', offset.top + bodyHeight + requiredXOffset)
        .text(xAxisLabel);

      // Build Y scales and axis:
      const y = scaleBand()
        .domain(yAxisValues)
        .range([offset.top, bodyHeight + offset.top])
        .padding(verticalPadding);

      svg
        .append('g')
        .attr('transform', 'translate(' + offset.left + ', 0)')
        .call(
          axisLeft(y).tickFormat((d, i) => {
            if (i % ystep === 0) return d;
            else return '';
          }),
        );

      // Build the Y axis label
      if (yAxisValues.length === 1) {
        svg
          .append('text')
          .attr('class', 'y label')
          .attr('text-anchor', 'start')
          .attr('x', 0)
          .attr('y', margin.top + bodyHeight)
          .text(yAxisLabel);
      } else {
        svg
          .append('text')
          .attr('class', 'y label')
          .attr('text-anchor', 'middle')
          .attr('x', -(offset.top + bodyHeight / 2))
          .attr(
            'y',
            margin.left +
              yAxisLabelHegiht -
              roatatedTextOffset -
              axisLabelsOffset,
          )
          .attr('transform', 'rotate(-90)')
          .text(yAxisLabel);
      }

      // Build color scale
      const myColor = scaleLinear()
        .range([minColor, midColor, maxColor])
        .domain([minv, (minv + maxv) / 2, maxv]);

      // Draw the heatmap cells
      const cellsContainer = svg.append('g').attr('id', 'cells-container');

      const cellsContainerElement = document.getElementById('cells-container');

      const cells = cellsContainer
        .selectAll()
        .data(fdata)
        .enter()
        .append('rect')
        .attr('x', d => x(d.x))
        .attr('y', d => y(d.y))
        .attr('width', x.bandwidth()) // This * 1.05 is to remove the small gap between cells
        .attr('height', y.bandwidth()) // Padding is 0 but it is still there
        .style('fill', (d, i) => myColor(d.v))
        .style('cursor', onClick ? 'pointer' : undefined);

      // Create a tooltip
      const tooltip = document.createElement('div');
      Object.assign(tooltip.style, {
        display: 'none',
        position: 'absolute',
        pointerEvents: 'none',
        backgroundColor: 'rgba( 0, 0, 0, 0.6 )',
        color: 'lightgrey',
        padding: '8px',
        fontFamily: 'sans-serif',
      });
      container.appendChild(tooltip);

      // Handle tooltip text when it moves
      // WARNING: Arrow function here makes it crash. I dont know why
      const mousemove = function(d) {
        tooltip.innerText = onTooltip
          ? onTooltip(d)
          : d.x + ' - ' + d.y + '\n' + Math.round(d.v * 100) / 100;
      };

      // Handle when a cell is clicked
      const mouseclick = d => {
        if (onClick) onClick(d);
      };

      // Add events to cells
      cells.on('mousemove', mousemove).on('click', mouseclick);

      // Set the tooltip position when it is inside the heatmap
      const handleMouseOver = event => {
        tooltip.style.display = 'inline-block';
        const mpx = event.clientX;
        const mpy = event.clientY;
        const { x, y } = setTooltipPosition(
          container,
          tooltip,
          { x: mpx, y: mpy },
          3,
        );
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
      };

      // Hide the tooltip
      const handleMouseOut = event => {
        //tooltip.style('display', 'none')
        tooltip.style.display = 'none';
      };

      previousCharts.current = [svg, tooltip];

      // Add the handlers for tooltip position
      cellsContainerElement.addEventListener(
        'mouseover',
        handleMouseOver,
        true,
      );
      cellsContainerElement.addEventListener(
        'mouseleave',
        handleMouseOut,
        true,
      );

      // Cleaning function
      return () => {
        cellsContainerElement.removeEventListener(
          'mouseover',
          handleMouseOver,
          true,
        );
        cellsContainerElement.removeEventListener(
          'mouseleave',
          handleMouseOut,
          true,
        );
      };
    }); // This useEffect has no dependencies

    // Finally, render the heatmap
    return (
      <Suspense fallback={<Loading />}>
        <div
          ref={containerRef}
          id={'container'}
          style={{ position: 'relative' }}
        />
      </Suspense>
    );
  },
);

export default D3HeatmapGrid;
