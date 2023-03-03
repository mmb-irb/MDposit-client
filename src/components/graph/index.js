import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { noop, flatten } from 'lodash-es';
import {
  select,
  scaleLinear,
  scaleLog,
  axisBottom,
  axisLeft,
  extent,
  line,
  mouse,
  zoom,
  event,
} from 'd3';

import { FormControlLabel, Checkbox } from '@material-ui/core';

import { NICE_NAMES } from '../../utils/constants';

import addTextBackground from './add-text-background';
import addMasks from './add-masks';

import { getTextWidth, getTextSizeDOM } from '../../utils/document-measurer';

import { getMean, getMeanAndStdv } from '../../utils/statistics';

import style from './style.module.css';

import LineSample from './line-sample';

// Number of data points to be represented at the same time FOR EACH dataset
// WARNING: The component would support quite more points with good performace
// WARNING: However, more points would make the visualization less 'comfortable'
// This is the minimum number of data points to be shown at maximum zoom (i.e. maximum precision)
// Thus it limits how much the graph can be zoomed
// At the same time, it is the maximum number of points to be shown at minimum zoom
// Thus it limits the precision at minimum zoom
// DANI: Hay algunas escalas del d3 que no llegué a comprender bien
// DANI: Puede que el número no se respete del todo
const NUMBER_OF_DATA_POINTS_ON_SCREEN = 100; // i.e. minimum number of points in screen

// Set the separation between text labels which appear when we hover data points
const HOVER_TEXT_SEPARATION = 25;

// Set a small offset to be added between normal labels and 90 degrees rotated labels
// This offset is added between the y labels (normal) and the y title (rotated)
// This offset is added between the x labels (rotated) and the x title (normal)
const roatatedTextOffset = 9; // In px

// Set a small offset to keep away the axis labels and the axis values
// They are very close to the axis values by default
const axisLabelsOffset = 9; // In px

// Set the default dot radius and thus calculate the default dot area
const DEFAULT_DOT_RADIUS = 3;
const DEFAULT_DOT_AREA = Math.PI * DEFAULT_DOT_RADIUS ** 2;

const dPR = window.devicePixelRatio || 1;

// According to d3 documentation
const defaultD3font = 'normal 10px sans-serif';
// Experimentally verfied
const titlesD3font = 'normal 14px sans-serif';

const yDataPlaceholder = { placeholder: { data: [0] } };
const defaultMargins = { top: 10, right: 10, bottom: 10, left: 10 };

// This function is a workaround to calculate maximum values from an array without spread syntax
// Some browsers (e.g. Chrome) do not support large amount of arguments in a function
// For this reason, Math.max(...values) will fail if the 'values' array is long enough
// The returned error is “RangeError: Maximum call stack size exceeded”
const steppedMax = values => {
  let max = Number.NEGATIVE_INFINITY;
  values.forEach(value => {
    max = Math.max(value, max);
  });
  return max;
};

// Create an object with all specified keys and all values as true
const trueEntries = keys => {
  const object = {};
  keys.forEach(key => (object[key] = true));
  return object;
};

const isCanvasPowered = type => type === 'dash' || type === 'dots';

// The expected input data (y) is:
// {
//    dataset1:{
//      data: [... the main data ...]
//      average: float,
//      color: 'red',
//      dash: "5, 5",
//    }
//    dataset2:{...}
// }

const Graph = forwardRef(({ // The main data
  yData, xAxisValues, step = 1, title, xAxisLabel, yAxisLabel, xScaleFactor = 1, xColors, // Note that this is only compatible with dash/dots types, not line // Thea main data to be represented // Optional x tags // not sure // Graph title // The x axis label text // The y axis label text // The difference beyween x values // Color each different dot in the graph dependeing on its x index
  xWeights, xTooltip, type = 'line', onHover, onSelect, selfLegend = false, displayLegend = false, dataDisplay, setDataDisplay, mean = false, standardDeviation = false, margin = defaultMargins, flippedXAxisValues = false, fullPrecision = false, className, marks }, ref) => { // Define the weights for each x value. This is only compatible with type = 'dots' and makes dots bigger // The function to set what to show on the tooltip based in the x value where the mouse is hovering // Set the type of graph to render. Accepted values: line, dash // Object with each dataset name and a value of true/false to set which data is displayed // dataDisplay setter // Display the mean line in the graph // Display the standard deviation area in the graph // Set an extra margin around the graph // Set if values in x axis is horizontal (false) or vertical (true) // If true, draw all points in the graph no matter how many points are there // Force a classname for the overall component element // Mark x values by displaying a vertical line in their positions
  // -  style: object with all the style names (keys) and their values according to d3
  // -  attr: object with all the attribute names (keys) and their values according to d3
  // -  x: the position of the mark according to the x axis
  // Set a fake dataset to allow the graph to work when no data is passed
  if (!yData || Object.keys(yData).length === 0) yData = yDataPlaceholder;

  // Referenced document element where d3 is rendered
  const containerRef = useRef(null);
  // Referenced function which allows to update the cart without having to remake it
  const drawRef = useRef(noop);
  const onSelectRef = useRef(noop);
  const marksRef = useRef(noop);
  const hoveredRef = useRef(noop);

  // Get each dataset
  const { yEntries, yKeys } = useMemo(() => {
    const yEntries = Object.entries(yData);
    const yKeys = yEntries.map(([key]) => key);
    return { yEntries, yKeys };
  }, [yData]);

  // ----------------------------------------------------------------------------------------

  // OFFSETS: Estimate the space needed for all the labels and titles to not overlap
  // DANI: Toda esta parte no se actualiza en el drawRef en caso de que los valores de las labels cambien
  // DANI: Esto da problemas si queremos cargar un graph sin data para luego ir metiendo data
  // DANI: El graph se creará sin margen para las labels y cuando introduzcamos data habrá un overlap
  const {
    offset,
    labelsHeight,
    requiredBottomOffset,
    yAxisLabelHegiht,
  } = useMemo(() => {
    // Set the yAxisValues by adding all dataset 'data' values
    let yAxisValues = yEntries
      .map(([, dataset]) => dataset.data)
      .reduce((cv, nv) => cv.concat(nv));
    // Round values if they are numeric, since labels just reach x.00
    yAxisValues = yAxisValues.map(v => Math.round(v * 100) / 100);

    // Measure the height of normal and text and labels
    const textHeight = getTextSizeDOM('|', defaultD3font).height;
    const labelsHeight =
      getTextSizeDOM('|', titlesD3font).height + axisLabelsOffset;

    // Get the calculated widths of all y labels and select the maximum
    // In addition, add a small offset between labels and the axis which is added further
    // This offset is only in x axes, which are rotated 90 degrees and end too much close to the axis
    const maxXAxisWidth = xAxisValues
      ? steppedMax(
          xAxisValues.map(label => getTextWidth(label, defaultD3font)),
        ) + roatatedTextOffset
      : 10;
    // Get the calculated widths of all y labels and select the maximum
    const maxYAxisWidth = steppedMax(
      yAxisValues.map(label => getTextWidth(label, defaultD3font)),
    );

    // In addition, add a small offset between labels and the axis which is added further
    // This offset is only in x axes, which are rotated 90 degrees and end too much close to the axis
    const xAxisLabelHegiht = xAxisLabel ? labelsHeight : 0;
    const yAxisLabelHegiht = yAxisLabel ? labelsHeight + roatatedTextOffset : 0;

    // Finally, estimate the space needed by axes, titles, etc.
    const requiredTopOffset = title ? labelsHeight + axisLabelsOffset : 0;
    const requiredBottomOffset = flippedXAxisValues
      ? maxXAxisWidth + xAxisLabelHegiht
      : textHeight + xAxisLabelHegiht;
    const requiredLeftOffset =
      yAxisValues.length === 1 && yData !== yDataPlaceholder
        ? Math.max(maxYAxisWidth, getTextWidth(yAxisLabel, titlesD3font))
        : maxYAxisWidth + yAxisLabelHegiht;

    // Set the dimensions and offsets of the graph
    const offset = {
      top: requiredTopOffset + margin.top,
      right: margin.right,
      bottom: requiredBottomOffset + margin.bottom,
      left: requiredLeftOffset + margin.left,
    };
    return { offset, labelsHeight, requiredBottomOffset, yAxisLabelHegiht };
  }, [
    flippedXAxisValues,
    margin,
    title,
    xAxisLabel,
    xAxisValues,
    yAxisLabel,
    yData,
    yEntries,
  ]);

  // ----------------------------------------------------------------------------------------

  // Object with entries defining which data is displayed (true) or hidden (false)
  // Each entry has the same key that its corresponding dataset
  // First set a defualt internal state for cases where it is not passed with the arguments
  const [internalDataDisplay, setInternalDataDisplay] = useState(
    trueEntries(yKeys),
  );
  // Update the internal data display when data changes
  useEffect(() => {
    setInternalDataDisplay(trueEntries(yKeys));
  }, [yKeys]);

  // If the data display state was passed then use it
  // Otherwise, use the internal state
  const [lab, setLab] = dataDisplay
    ? [dataDisplay, setDataDisplay]
    : [internalDataDisplay, setInternalDataDisplay];

  const previousValues = useRef({
    data: yDataPlaceholder,
    labels: lab,
    currentZoom: { k: 1, x: 0, rescaleX: scale => scale },
    xAxisLabel,
    yAxisLabel,
    xAxisValues,
    onSelect,
    step,
    marks,
  });

  // This useEffect must be run only once
  // The graph content is updated through the 'drawRef' referenced function
  useEffect(() => {
    // Set the d3 base
    // Use canvas to display the dash blocks since d3 is not as efficient
    let canvas;
    let canvasContext;
    if (isCanvasPowered(type)) {
      canvas = select(containerRef.current).append('canvas');
      canvasContext = canvas
        .node()
        .getContext('2d' /*, {desynchronized: true}*/);
    }
    const graph = select(containerRef.current).append('svg');
    // 'defs' is an element used to store graphical data which is not rendered directly
    // Graphics in defs are displayed later by refering them
    const defs = graph.append('defs');
    // text background
    const textBackgroundURL = addTextBackground(defs);

    // mask opacity
    const [startMaskURL, endMaskURL] = addMasks(defs);

    // Set the marks node now, so they are not placed over the graph
    const marksNode = graph.append('g');

    const main = graph.append('g');

    // Set the dots in the graph
    const allDotGroups = main.append('g');

    // order is important, everything before that will be hidden by masks
    // masks
    graph
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', offset.left)
      .attr('height', '100%')
      .style('fill', startMaskURL);
    const maskEnd = graph
      .append('rect')
      .attr('y', 0)
      .attr('height', '100%')
      .style('fill', endMaskURL);

    // axes
    const axes = {
      x: graph.append('g'),
      y: graph.append('g'),
    };

    // This ref allows to update the graph without having to remake the whole graph
    drawRef.current = ({
      data = previousValues.current.data,
      labels = previousValues.current.labels,
      step = previousValues.current.step,
      xAxisLabel = previousValues.current.xAxisLabel,
      yAxisLabel = previousValues.current.yAxisLabel,
      currentZoom = previousValues.current.currentZoom,
      xAxisValues = previousValues.current.xAxisValues,
      onSelect = previousValues.current.onSelect,
      marks = previousValues.current.marks,
      offset = previousValues.current.offset,
      labelsHeight = previousValues.current.labelsHeight,
      requiredBottomOffset = previousValues.current.requiredBottomOffset,
      yAxisLabelHegiht = previousValues.current.yAxisLabelHegiht,
      xColors = previousValues.current.xColors,
      xNormalizedWeights = previousValues.current.xNormalizedWeights,
    } = {}) => {
      // Change the graph size according to the left offset
      graph.attr('width', offset.left);

      // Save a few values for further reference
      // These values must be saved at frist since other noop references read them from the reference
      previousValues.current.step = step;
      previousValues.current.xAxisValues = xAxisValues;

      // container size
      const { clientWidth: width, clientHeight: height } = containerRef.current;

      const dataEntries = Object.entries(data);
      const dataKeys = dataEntries.map(([key]) => key);

      // ----------------------------------------------------------------------------

      // ZOOM

      // The minimum and default zoom value is 1
      const minZoomExtent = 1;

      //   make zoom extent dynamic depending on number of data points
      //   ↳ results in similar precision at maximum zoom regardless of data size
      const maxZoomExtent =
        dataEntries[0][1].data.length / NUMBER_OF_DATA_POINTS_ON_SCREEN;

      // Set the number of points to be represented
      // The maximum precision is always 1
      // i.e. When zoom is at maximum value all points in the window range must be shown
      const precisionScale = scaleLog().range(
        fullPrecision ? [1, 1] : [Math.ceil(maxZoomExtent), minZoomExtent],
      );

      precisionScale.domain([minZoomExtent, maxZoomExtent]);

      // Get the precision to be used according to the zoom value
      // The zoom value is a numeric value which ranges from minZoomExtent (default) to maxZoomExtent
      const getZoomPrecision = k =>
        2 ** Math.floor(Math.log2(precisionScale(k)));

      const graphZoom = zoom().scaleExtent([minZoomExtent, maxZoomExtent]);
      // By default, the zoom in/out event of d3 prevents the verticall scroll on mouse wheel
      // However, when zoom has reached the maximum or minimum limit, the scroll is re-established
      // The 'on wheel' eventdown here prevents that furtive scroll
      graph.call(graphZoom).on('wheel', () => event.preventDefault());
      // Update precision and rescaleX on zoom (i.e. on mouse wheel)
      graphZoom.on('zoom', () => {
        drawRef.current({
          currentZoom: event.transform,
        });
      });

      // Get the the current zoom 'k' value
      // If it is bigger thant the maximum extent then use the maximum extent instead
      // This may happen when the dataset is changed while the zoom is in the maximum
      const k = Math.min(currentZoom.k, maxZoomExtent);
      const zoomPrecision = getZoomPrecision(k);
      const precision = isCanvasPowered(type) ? 1 : zoomPrecision;
      const rescaleX = currentZoom.rescaleX.bind(currentZoom);

      // Save precision for further reference
      previousValues.current.precision = precision;

      // ----------------------------------------------------------------------------

      // DANI: Esto es mio (experimental)
      const bodyWidth = width - offset.left - offset.right;
      const bodyHeight = height - offset.top - offset.bottom;

      graph.attr('width', width).attr('height', height);
      if (canvas) {
        canvas.attr('width', width * dPR).attr('height', height * dPR);
        canvas.style('width', `${width}px`).style('height', `${height}px`);
      }

      maskEnd.attr('x', width - offset.right).attr('width', offset.right);

      // Draw the title over the graph
      if (title) {
        // Remove the previous title
        graph.select('#title').remove();
        axes.title = graph
          .append('text')
          .attr('id', 'title')
          .attr('class', 'title')
          .style('text-anchor', 'middle')
          .attr('x', width / 2)
          .attr('y', margin.top + labelsHeight)
          .text(title);
      }

      // Set the x minimum and maximum limits
      const xMin = 0;
      const xMax = dataEntries[0][1].data.length * step;

      // Save this values to further reference
      previousValues.current.xMin = xMin;
      previousValues.current.xMax = xMax;

      // Set a function which calculates de x position in screen
      // Note that values from this function change when you grab/scroll in the graph
      const x = rescaleX(
        scaleLinear()
          .domain([xMin, xMax])
          .range([offset.left, width - offset.right]),
      );
      previousValues.current.x = x;

      const xAxis = g =>
        g.attr('transform', `translate(0, ${height - offset.bottom})`).call(
          // DANI: Estos ticks los he puesto a mano tras comprobar que quedaban bien
          axisBottom(x)
            .ticks(7, '.2f')
            .tickFormat(d => (xAxisValues ? xAxisValues[d] : d)),
        );
      axes.x.call(xAxis);

      // Set the x axis label
      if (xAxisLabel) {
        // Remove the previous label
        graph.select('#xlab').remove();
        axes.xAxisLabel = graph
          .append('text')
          .attr('id', 'xlab')
          .attr('class', 'x label')
          .attr('text-anchor', 'middle')
          .attr('x', offset.left + bodyWidth / 2)
          .attr('y', offset.top + bodyHeight + requiredBottomOffset)
          .text(xAxisLabel);
      }

      // y axis/axes
      const y = scaleLinear()
        .domain(
          extent(
            flatten(
              dataEntries
                .filter(([key]) => labels[key])
                .map(([, { data }]) => extent(data)),
            ),
          ),
        )
        .nice()
        .range([height - offset.bottom, offset.top]);

      const yAxis = g =>
        g
          .attr('transform', `translate(${offset.left}, 0)`)
          .transition()
          .call(axisLeft(y));
      //.call(axisLeft(y).ticks(8, '.2f')); // Use this to force the number of decimals in labels
      axes.y.call(yAxis);

      // Set the y axis label
      if (yAxisLabel) {
        graph.select('#ylab').remove();
        axes.yAxisLabel = graph
          .append('text')
          .attr('id', 'ylab')
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

      // mean line
      if (mean) {
        // Represent a line with this average value along the whole graph
        const meanLines = main.selectAll('line.mean').data(dataKeys);
        meanLines
          .enter()
          .append('line')
          .attr('class', 'mean')
          .merge(meanLines)
          .attr('stroke', d => (data[d] && data[d].color) || 'black')
          .attr('x1', x(xMin))
          .attr('x2', x(xMax))
          .attr('y1', d => y(getMean(data[d].data)))
          .attr('y2', d => y(getMean(data[d].data)))
          .transition()
          .attr('opacity', d => (labels[d] ? 0.5 : 0));
        meanLines.exit().remove();
      }
      // mean ± 1σ area
      if (standardDeviation) {
        for (const [, dataset] of dataEntries) {
          const data = dataset.data;
          if (!data) continue;
          const sum = data.reduce((pv, cv) => pv + cv, 0);
          const n = data.length;
          const mean = sum / n;
          dataset.stddev = Math.sqrt(
            data.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n,
          );
        }
        const sdRects = main.selectAll('rect.sd').data(dataKeys);
        sdRects
          .enter()
          .append('rect')
          .attr('class', 'sd')
          .merge(sdRects)
          .attr('fill', d => (data[d] && data[d].color) || 'black')
          .attr('x', x(xMin))
          .attr('width', x(xMax) - x(xMin))
          .attr('y', d => {
            const { mean, stdv } = getMeanAndStdv(data[d].data);
            return y(mean + stdv);
          })
          .attr('height', d => {
            const { mean, stdv } = getMeanAndStdv(data[d].data);
            return y(mean - stdv) - y(mean + stdv);
          })
          .transition()
          .attr('opacity', d => (labels[d] ? 0.1 : 0));
        sdRects.exit().remove();
      }
      const minIndex = Math.floor(x.invert(0) / step / precision);
      const maxIndex = Math.ceil(x.invert(width) / step / precision);
      // In case it is a classical line graph
      if (type === 'line') {
        // Define the data line positions
        const lineFn = line()
          .defined((_, i) => i >= minIndex && i <= maxIndex)
          .x((_, i) => x(i * step * precision))
          .y(d => y(d));

        // Draw the data lines
        // First set the lines/data mapping
        const linesData = main.selectAll('path.line').data(dataKeys);
        // Add as many lines as required according to the mapped data
        linesData
          .enter()
          .append('path')
          .attr('class', 'line')
          .attr('fill', 'none')
          // Update existing lines with the mapped data
          .merge(linesData)
          .attr('stroke', d => data[d].color || 'black')
          .style('stroke-dasharray', d =>
            data[d].dash ? data[d].dash : undefined,
          )
          .attr('stroke-linejoin', 'round')
          .attr('stroke-linecap', 'round')
          .attr('d', d =>
            lineFn(data[d].data.filter((_, i) => i % precision === 0)),
          )
          .transition()
          .attr('opacity', d => (labels[d] ? 1 : 0))
          .attr('stroke-width', 1.5);
        // Remove lines which are not required anymore according to the mapped data
        linesData.exit().remove();
        // Save this node for further reference
        previousValues.current.linesData = linesData;
      }
      // NEVER FORGET: We do not use d3 dots since they are way less efficient than canvas
      // In case it is a dash graph
      else if (isCanvasPowered(type) && canvasContext) {
        // For the dash
        const dashWidth = Math.max(1, x(1) - x(0));
        const dashHeight = 5;
        // For the dots
        const startAngle = 0;
        const endAngle = 2 * Math.PI;
        canvasContext.clearRect(0, 0, width, height);
        for (const [key, { data: values, color }] of Object.entries(data)) {
          if (!labels[key]) continue;
          canvasContext.fillStyle = color || '#000000';
          const maxInView = Math.min(values.length - 1, maxIndex);
          // each atom in view
          for (
            let index = Math.max(0, minIndex);
            index <= maxInView;
            index += 1
          ) {
            // Skip the follwoing dot if the zoom precision says so
            if (index % zoomPrecision !== 0) continue;
            // Color the rectangle according to the equivalent atom element
            if (xColors) {
              const atomColor = xColors[index];
              // If the color is white (i.e. it is an hydrogen) then paint it slightly grey
              // The background is white so a white rectangle would be not visible
              canvasContext.fillStyle =
                atomColor === 'white' ? '#eeeeee' : atomColor;
            }
            // Draw a rectangle
            if (type === 'dash') {
              canvasContext.fillRect(
                (x(index * step * precision) - dashWidth / 2) * dPR,
                (y(values[index]) - dashHeight / 2) * dPR,
                dashWidth * dPR,
                dashHeight * dPR,
              );
            }
            // Draw a circle
            if (type === 'dots') {
              // Set the x y positions
              const xPosition =
                (x(index * step * precision) - dashWidth / 2) * dPR;
              const yPosition = (y(values[index]) - dashHeight / 2) * dPR;
              // Set the radius, which may be affected by the x weights, when passed
              let radius = DEFAULT_DOT_RADIUS; // Its 3
              if (xNormalizedWeights) {
                const weight = xNormalizedWeights[index];
                const area = DEFAULT_DOT_AREA * weight;
                radius = Math.sqrt(area / Math.PI);
              }
              // Draw the circle
              canvasContext.beginPath();
              canvasContext.arc(
                xPosition,
                yPosition,
                radius,
                startAngle,
                endAngle,
              );
              canvasContext.fill();
            }
          }
        }
      }

      // Calculate the width of a vertical lines used to highlight specific x values
      const xUnitWidth = Math.max(1, x(zoomPrecision * step) - x(0));
      previousValues.current.xUnitWidth = xUnitWidth;
      // Place vertical lines for specified marks
      marksRef.current({ marks });

      // dots over the selected vertical line
      // Here we just delete previous dots and start again instead of updating them
      allDotGroups.selectAll('g.dot-group').remove();
      const dotGroups = allDotGroups
        .selectAll('g.dot-group')
        .data([...dataKeys, 'x'])
        .enter()
        .append('g')
        .attr('class', 'dot-group')
        .attr('opacity', 0);
      dotGroups
        .append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 5)
        .attr('fill', d => (data[d] && data[d].color) || 'black');
      dotGroups
        .append('text')
        .style('text-anchor', 'middle')
        .style('font-weight', 'bold')
        .style('paint-order', 'stroke')
        .attr('y', '-5px')
        .attr('fill', d => (data[d] && data[d].color) || 'black')
        .attr('stroke', 'rgba(255, 255, 255, 0.5)')
        .attr('stroke-width', 5)
        .attr('filter', textBackgroundURL);

      // mouse move handler
      graph.on('mousemove', (_, index, nodes) => {
        // 'nodes' contain the mouse position data
        // 'index' is apparently always 0
        const [xValue] = mouse(nodes[index]);
        // Get the closest x axis index to the current mouse position
        const closestIndex =
          Math.round(x.invert(xValue) / zoomPrecision / step) * zoomPrecision;
        // Track the implicit position of all hovering dots
        // This is useful to know if dot texts would overlap
        const dotDownOffsets = {};
        allDotGroups
          // Set the x position of the dot
          .attr('transform', `translate(${x(closestIndex * step)}, 0)`)
          // Dots become invisible if the closest index is not between the minimum and the maximum
          .attr(
            'opacity',
            closestIndex * step >= xMin && closestIndex * step < xMax ? 1 : 0,
          );
        allDotGroups
          .selectAll('g.dot-group')
          // Set the y position of the dot
          .attr('transform', d => {
            // The x bottom axis for the x value
            if (d === 'x') return `translate(0, ${height - offset.bottom})`;
            if (!labels[d]) return;
            // Just over the correspondong line for other values
            const offsetDown = (y(data[d].data[closestIndex]) || 0) + 2.5;
            // Record the current offset down
            dotDownOffsets[d] = offsetDown;
            return `translate(0, ${offsetDown})`;
          })
          .attr('opacity', d => (d === 'x' || labels[d] ? 1 : 0))
          .selectAll('text')
          .attr('transform', d => {
            if (d === 'x') return `translate(0, ${-3})`;
            if (!labels[d]) return;
            // Find if an offset is too close to others and then move it to a better place (above)
            let dotDownOffset = dotDownOffsets[d];
            let extra = 0;
            // Sort other offsets from more (below) to less (above)
            const sortedOffsets = [];
            for (const [key, value] of Object.entries(dotDownOffsets)) {
              if (key !== d) sortedOffsets.push(value);
            }
            sortedOffsets.sort((a, b) => b - a);
            // For each other offset, check if we are closer to it than the margin
            // If so, we move our offset over the other as much as the margin needs
            for (const offset of sortedOffsets) {
              const difference = Math.abs(dotDownOffset + extra - offset);
              if (difference > HOVER_TEXT_SEPARATION - 1) continue;
              extra = offset - HOVER_TEXT_SEPARATION - dotDownOffset;
            }
            // In case the new offset is over the top limit we must relocate it below
            if (dotDownOffset + extra < offset.top) {
              extra = offset.top - dotDownOffset;
              sortedOffsets.sort((a, b) => a - b);
              // For each other offset, check if we are closer to it than the margin
              // If so, we move our offset below the other as much as the margin needs
              for (const offset of sortedOffsets) {
                const difference = Math.abs(dotDownOffset + extra - offset);
                if (difference > HOVER_TEXT_SEPARATION - 1) continue;
                extra = offset + HOVER_TEXT_SEPARATION - dotDownOffset;
              }
            }
            dotDownOffsets[d] = dotDownOffset + extra;
            // Add the offset + a small margin
            return `translate(0, ${extra - 3})`;
          })
          // Set the dot text in the x axis
          .text(d => {
            // Dot in x axes
            if (d === 'x') {
              const number = closestIndex * step * xScaleFactor;
              if (number < 0) return;
              return xTooltip(number, closestIndex);
            }
            // Dot over data
            else {
              return Math.round(data[d].data[closestIndex] * 100) / 100;
            }
          });

        if (onHover) {
          onHover(
            closestIndex * step >= xMin && closestIndex * step < xMax
              ? closestIndex
              : null,
          );
        }
      });
      // When click in the graph
      onSelectRef.current({ onSelect });

      graph.on('mouseout', () => {
        allDotGroups.selectAll('g.dot-group').attr('opacity', 0);
        if (onHover) onHover(null);
      });

      // Save current values for further reference
      previousValues.current.data = data;
      previousValues.current.labels = labels;
      previousValues.current.xAxisLabel = xAxisLabel;
      previousValues.current.yAxisLabel = yAxisLabel;
      previousValues.current.currentZoom = currentZoom;
      previousValues.current.offset = offset;
      previousValues.current.labelsHeight = labelsHeight;
      previousValues.current.requiredBottomOffset = requiredBottomOffset;
      previousValues.current.yAxisLabelHegiht = yAxisLabelHegiht;
      previousValues.current.xColors = xColors;
      previousValues.current.xNormalizedWeights = xNormalizedWeights;
    };

    onSelectRef.current = ({ onSelect } = {}) => {
      // Get some reference values
      const x = previousValues.current.x;
      const precision = previousValues.current.precision;
      const step = previousValues.current.step;
      const xMin = previousValues.current.xMin;
      const xMax = previousValues.current.xMax;
      const xAxisValues = previousValues.current.xAxisValues;
      // In case we dont have the previous values yet we stop here
      if (x === undefined) return;
      // If there is no 'onSelect' function then return here
      if (!onSelect) return;
      // When click in the graph
      graph.on('click', (_, index, nodes) => {
        const [xValue] = mouse(nodes[index]);
        // Get the closest x axis index to the current mouse position
        const closestIndex =
          Math.round(x.invert(xValue) / precision / step) * precision;
        if (closestIndex * step < xMin || closestIndex * step >= xMax) {
          return;
        }
        onSelect(closestIndex, xAxisValues ? xAxisValues[closestIndex] : null);
      });
      // Update previous refs
      previousValues.current.onSelect = onSelect;
      previousValues.current.precision = precision;
    };

    // Place marks in the graph
    marksRef.current = ({ marks } = {}) => {
      // Get some reference values
      const x = previousValues.current.x;
      const xUnitWidth = previousValues.current.xUnitWidth;
      const step = previousValues.current.step;
      // In case we dont have all the arguments yet we stop here
      if (x === undefined) return;
      // Remove previous marks
      if (previousValues.current.marks)
        previousValues.current.marks.forEach(prevMark =>
          marksNode.select('#mark' + prevMark.x).remove(),
        );
      // If there are no new marks then return here
      if (!marks) return;
      // Add a vertical band for each mark
      marks.forEach(mark => {
        const markRect = marksNode
          .append('rect')
          .attr('id', 'mark' + mark.x)
          .attr('x', () =>
            Number.isInteger(mark.x) ? x(mark.x * step) - xUnitWidth / 2 : 0,
          )
          .attr('y', 0)
          .attr('height', '100%')
          .attr('width', () => xUnitWidth);
        if (mark.attr)
          Object.entries(mark.attr).forEach(([key, value]) => {
            markRect.attr(key, value);
          });
        if (mark.style)
          Object.entries(mark.style).forEach(([key, value]) => {
            markRect.style(key, value);
          });
      });
      // Update previous refs
      previousValues.current.marks = marks;
    };

    hoveredRef.current = ({ hovered } = {}) => {
      // Get some reference values
      const linesData = previousValues.current.linesData;
      // Change the whole dataset line stroke width
      linesData
        .transition()
        .attr('stroke-width', d => (hovered === d ? 3 : 1.5));
      // Update previous refs
      previousValues.current.hovered = hovered;
    };

    window.addEventListener('resize', drawRef.current);

    return () => window.removeEventListener('resize', drawRef.current);
  }, []); // DANI: eslint ahora se queja, peor antes aquí había esto: // eslint-disable-line react-hooks/exhaustive-deps
  // Maybe might need to double-check that and remove the exception

  // Handle when the 'onSelect' function changes
  useEffect(() => {
    onSelectRef.current({ onSelect });
  }, [onSelect]);

  // Handle when marks change
  useEffect(() => {
    marksRef.current({ marks });
  }, [marks]);

  // Handle when some parameter change requires a whole re-draw of the graph
  useEffect(() => {
    drawRef.current({
      data: yData,
      step,
      xAxisLabel,
      yAxisLabel,
      xAxisValues,
      labels: lab,
      offset,
      labelsHeight,
      requiredBottomOffset,
      yAxisLabelHegiht,
      xColors,
    });
  }, [
    yData,
    step,
    xAxisLabel,
    yAxisLabel,
    xAxisValues,
    lab,
    offset,
    labelsHeight,
    requiredBottomOffset,
    yAxisLabelHegiht,
    xColors,
  ]);

  // Handle when weights change apart, since they must be normalized
  useEffect(() => {
    // Normalize xWeigths, when passed, so that the minimum values are 1
    if (!xWeights) return;
    // Check weights and data to match in the number of values
    const expectedCount = xWeights.length;
    Object.values(yData).forEach(value => {
      const currentCount = value.data.length;
      if (currentCount !== expectedCount)
        throw new Error(
          `Graph data values count (${currentCount}) does not match the weigths values count (${expectedCount})`,
        );
    });
    // Find the minimum and maximum values in the weights array
    // NEVER FORGET: do not use Math.min and Math.max for long arrays
    const minimum = xWeights.reduce((cv, nv) => {
      return Math.min(cv, nv);
    }, Infinity);
    const maximum = xWeights.reduce((cv, nv) => {
      return Math.max(cv, nv);
    }, -Infinity);
    // Set the normalized minimum and maximum radius values
    // This in the graph is equivalent to 'times the default area'
    const normalizedMinimum = 1;
    const normalizedMaximum = 10;
    // Set a function to interpolate values
    const normalizer =
      (normalizedMaximum - normalizedMinimum) / (maximum - minimum);
    const interpolate = weight =>
      normalizedMinimum + (weight - minimum) * normalizer;
    // Recalculate weights using the minimum values (equal to 1) as reference
    const xNormalizedWeights = xWeights.map(weight => interpolate(weight));
    drawRef.current({ xNormalizedWeights });
  }, [xWeights, yData]);

  // Handle when user clicks on legend checkboxes
  const handleChange = useCallback(
    ({
      target: {
        dataset: { key },
      },
    }) => {
      if (!key) return;
      if (!setLab) return;
      setLab(previous => {
        const nextLabels = { ...previous, [key]: !previous[key] };
        // Check if any value is true before returning the labels
        // This way, the user can not uncheck the last active checkbox
        if (Object.values(nextLabels).some(Boolean)) return nextLabels;
        // If all of the values would be false, keep the previous
        return previous;
      });
    },
    [setLab],
  );

  const handleMouseOver = useCallback(
    ({
      target: {
        dataset: { key },
      },
    }) => {
      if (!key || !lab[key] || isCanvasPowered(type)) return;
      hoveredRef.current({ hovered: key });
    },
    [lab, type],
  );

  const handleMouseOut = useCallback(
    ({
      target: {
        dataset: { key },
      },
    }) => {
      if (!key || !lab[key] || isCanvasPowered(type)) return;
      hoveredRef.current({ hovered: null });
    },
    [lab, type],
  );

  // Expose public methods and getters/setters
  useImperativeHandle(
    ref,
    () => ({
      set marks(value) {
        marksRef.current({ marks: value });
      },
    }),
    [],
  );

  return (
    <div className={className ? className : style.default}>
      <div className={style.flexible}>
        <div className={style['graph-container']} ref={containerRef} />
        {selfLegend && (
          <div className={style['graph-legend']}>
            {yEntries.map(([key]) => (
              <FormControlLabel
                data-key={key}
                key={key}
                onChange={handleChange}
                onMouseOver={handleMouseOver}
                onMouseOut={handleMouseOut}
                control={
                  <Checkbox
                    checked={lab[key]}
                    style={{ color: yData[key].color || 'black' }}
                    inputProps={{ 'data-key': key }}
                  />
                }
                label={NICE_NAMES.get(key) || key}
              />
            ))}
          </div>
        )}
        {displayLegend && (
          <div className={style['graph-display-legend']}>
            {yEntries.map(([key, dataset], i) => {
              if (lab[key] === false) return null;
              return (
                <div key={key} className={style['line-sample']}>
                  {key}
                  <LineSample color={dataset.color} dash={dataset.dash} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

export default Graph;
