import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useContext,
  useMemo,
} from 'react';
import { fromPairs, noop, flatten } from 'lodash-es';
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

import { FormControlLabel, Checkbox, Button } from '@material-ui/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashAlt } from '@fortawesome/free-regular-svg-icons';

import { PdbCtx } from '../../contexts';
import { NICE_NAMES, COLORS } from '../../utils/constants';

import addTextBackground from './add-text-background';
import addMasks from './add-masks';

import { getTextWidth, getTextSizeDOM } from '../../utils/document-measurer';

import { getMean, getMeanAndStdv } from '../../utils/statistics';

import { ColormakerRegistry } from 'ngl';

import { getAtom, getAtomResidue } from '../../utils/topology-manager';

import style from './style.module.css';

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

const scheme = new ColormakerRegistry.schemes.element({});
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

// The expected input data (y) is:
// {
//    dataset1:{
//      data: [... the main data ...]
//      average: float,
//      color: 'red',
//    }
//    dataset2:{...}
// }

const Graph2 = ({
  // The main data
  yData,
  // Optional x tags
  xAxisValues,
  // The difference beyween x values
  step = 1,
  // Graph title
  title,
  // The x axis label text
  xAxisLabel,
  // The y axis label text
  yAxisLabel,
  //
  xScaleFactor = 1,
  // Define the unit (and also the magnitude implicitly) of the x axis
  // This is used to show the right text when the mouse is over it
  // Accepted values: ns, frame, atom
  xUnit = 'ns',
  // Set the type of grapg to render
  // Accepted values: line, dash
  type = 'line',
  // Start number of activated keys
  // A value of 'null' stands for all activated
  startKeys = null,
  // React hooks
  onHover,
  selected,
  onSelect,
  selfLegend = false,
  // Object with each dataset name and a value of true/false to set which data is displayed
  dataDisplay,
  setDataDisplay,
  // Display the mean line in the graph
  mean = false,
  // Display the standard deviation area in the graph
  standardDeviation = false,
  // Set an extra margin around the graph
  margin = defaultMargins,
  // DANI: Todavía no está implementado pero se usa para calcular márgenes
  // Set if values in x axis is horizontal (false) or vertical (true)
  flippedXAxisValues = false,
  // Force a classname for the overall component element
  className,
}) => {
  // Set a fake dataset to allow the grapgh to work when no data is passed
  if (!yData || Object.keys(yData).length === 0) yData = yDataPlaceholder;

  const pdbData = useContext(PdbCtx);

  // Referenced document element where the ngl is rendered
  const containerRef = useRef(null);
  // Rferenced function which allows to update the cart without having to remake it
  const drawRef = useRef(noop);
  const selectedRef = useRef(new Set());
  const pdbDataRef = useRef({});
  const dataRef = useRef(yDataPlaceholder);

  // Get each dataset
  const { yEntries, yKeys } = useMemo(() => {
    const yEntries = Object.entries(yData);
    const yKeys = yEntries.map(([key]) => key);
    return { yEntries, yKeys };
  }, [yData]);

  let counter = 0;
  const activateKey = () => {
    if (startKeys === null || counter < startKeys) {
      counter += 1;
      return true;
    }
    return false;
  };

  // ----------------------------------------------------------------------------------------

  // OFFSETS: Estimate the space needed for all the labels and titles to not overlap
  // DANI: Toda esta parte no se actualiza en el drawRef en caso de que los valores de las labels cambien
  // DANI: De momento no da problemas pero algún día habrá que arreglarlo
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
    // Round values if they are nomeric, since labels just reach x.00
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
  const [internalDataDisplay, setInternalDataDisplay] = useState(() =>
    fromPairs(yKeys.map(key => [key, activateKey()])),
  );
  // If the data display state was passed then use it
  // Otherwise, use the internal state
  const [lab, setLab] = dataDisplay
    ? [dataDisplay, setDataDisplay]
    : [internalDataDisplay, setInternalDataDisplay];

  const prevLabels = useRef(lab);
  const prevZoom = useRef({ k: 1, x: 0, rescaleX: scale => scale });
  const prevStep = useRef(step);
  const prevXAxisLabel = useRef(xAxisLabel);
  const prevYAxisLabel = useRef(yAxisLabel);
  const prevXAxisValues = useRef(xAxisValues);

  useEffect(() => {
    drawRef.current && pdbData && pdbData.file && drawRef.current();
  }, [pdbData]);

  // This useEffect must be run only once
  // The graph content is updated through the 'drawRef' referenced function
  useEffect(() => {
    // Set the d3 base
    let canvas;
    let canvasContext;
    if (type === 'dash') {
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

    const main = graph.append('g');

    // Set the vertical line that shows up when we select a point in the graph
    const selectedRect =
      selected instanceof Set
        ? null
        : main
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 0)
            .attr('height', '100%')
            .attr('fill', '#c8c8c8');

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
      data = dataRef.current,
      hovered,
      labels = prevLabels.current,
      selected = selectedRef.current,
      pdbData = pdbDataRef.current,
      step = prevStep.current,
      xAxisLabel = prevXAxisLabel.current,
      yAxisLabel = prevYAxisLabel.current,
      currentZoom = prevZoom.current,
      xAxisValues = prevXAxisValues.current,
    } = {}) => {
      // container size
      const { clientWidth: width, clientHeight: height } = containerRef.current;

      const dataEntries = Object.entries(data);
      const dataKeys = dataEntries.map(([key]) => key);

      //console.log(data);
      //console.log(dataKeys);

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
      const precisionScale = scaleLog().range([Math.ceil(maxZoomExtent), 1]);

      precisionScale.domain([1, maxZoomExtent]);

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

      // Get the the urrent zoom 'k' value
      // If it is bigger thant the maximum extent then use the maximum extent instead
      // This may happen when the dataset is changed while the zoom is in the maximum
      const k = Math.min(currentZoom.k, maxZoomExtent);
      const precision = type === 'dash' ? 1 : getZoomPrecision(k);
      const rescaleX = currentZoom.rescaleX.bind(currentZoom);

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

      const xMin = 0;
      const xMax = dataEntries[0][1].data.length * step;

      // x axis
      const x = rescaleX(
        scaleLinear()
          .domain([xMin, xMax])
          .range([offset.left, width - offset.right]),
      );
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
          .call(axisLeft(y).ticks(8, '.2f'));
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
          .attr('stroke-linejoin', 'round')
          .attr('stroke-linecap', 'round')
          .attr('d', d =>
            lineFn(data[d].data.filter((_, i) => i % precision === 0)),
          )
          .transition()
          .attr('opacity', d => (labels[d] ? 1 : 0))
          .attr('stroke-width', d => (hovered === d ? 3 : 1.5));
        // Remove lines which are not required anymore according to the mapped data
        linesData.exit().remove();

        // Place the vertical line in the selected data point position
        if (selectedRect) {
          const width = Math.max(1, x(precision * step) - x(0));
          selectedRect
            .attr('width', () => width)
            .attr('x', () =>
              Number.isInteger(selected) ? x(selected * step) - width / 2 : 0,
            )
            .attr('opacity', selected === null ? 0 : 1);
        }
      }
      // In case it is a dash graph
      else if (type === 'dash' && canvasContext) {
        const dashWidth = Math.max(1, x(1) - x(0));
        const dashHeight = 5;
        canvasContext.clearRect(0, 0, width, height);
        for (const [key, { data }] of yEntries) {
          if (!labels[key]) continue;
          // selected areas
          canvasContext.fillStyle = '#c8c8c8';
          for (const atom of selected || []) {
            // skip the ones not in view
            if (atom < minIndex || atom > maxIndex) continue;
            canvasContext.fillRect(
              (x(atom * step * precision) - dashWidth / 2) * dPR,
              0,
              dashWidth * dPR,
              height * dPR,
            );
          }
          canvasContext.fillStyle = COLORS.get(key) || '#000000';
          const maxInView = Math.min(data.length - 1, maxIndex);
          // each atom in view
          for (
            let index = Math.max(0, minIndex);
            index <= maxInView;
            index += step
          ) {
            if (pdbData && pdbData.file) {
              const atom = pdbData.file.atomMap.get(
                pdbData.file.atomStore.atomTypeId[index],
              );
              if (atom) {
                const color = `#${scheme
                  .atomColor(atom)
                  .toString(16)
                  .padStart(6, '0')}`;
                canvasContext.fillStyle =
                  color === '#ffffff' ? '#eeeeee' : color;
              }
            }

            canvasContext.fillRect(
              (x(index * step * precision) - dashWidth / 2) * dPR,
              (y(data[index]) - dashHeight / 2) * dPR,
              dashWidth * dPR,
              dashHeight * dPR,
            );
          }
        }
      }

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
          Math.round(x.invert(xValue) / precision / step) * precision;
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
            const offsetDown =
              d === 'x'
                ? // The x bottom axis for the x value
                  height - offset.bottom
                : // Just over the correspondong line for other values
                  (y(data[d].data[closestIndex]) || 0) + 2.5;
            // Record the current offset down
            dotDownOffsets[d] = offsetDown;
            return `translate(0, ${offsetDown})`;
          })
          .attr('opacity', d => (d === 'x' || labels[d] ? 1 : 0))
          .selectAll('text')
          .attr('transform', d => {
            if (d === 'x') return `translate(0, ${-3})`;
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
              if (xUnit === 'ns') return +number.toFixed(2) + ' ns';
              if (xUnit === 'frame') return 'frame ' + +number.toFixed(2);
              if (xUnit === 'atom') {
                let tag = 'atom ' + +number.toFixed(2);
                if (!pdbData.file) return tag;
                const atom = getAtom(number, pdbData.file);
                if (!atom) return tag;
                const residue = getAtomResidue(number, pdbData.file);
                if (!residue) return tag + ` (${atom.name})`;
                return tag + ` (${residue.resname} - ${atom.name})`;
              }
              if (xUnit === 'residue')
                return (
                  'residue ' +
                  (xAxisValues ? xAxisValues[closestIndex] : closestIndex)
                );
              return 'Error: Not supported unit';
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
      if (onSelect) {
        graph.on('click', (_, index, nodes) => {
          const [xValue] = mouse(nodes[index]);
          // Get the closest x axis index to the current mouse position
          const closestIndex =
            Math.round(x.invert(xValue) / precision / step) * precision;
          if (closestIndex * step < xMin || closestIndex * step >= xMax) {
            return;
          }
          onSelect(selected => {
            // In case is a multiple selection
            if (selected instanceof Set) {
              const newSet = new Set(selected);
              newSet[newSet.has(closestIndex) ? 'delete' : 'add'](closestIndex);
              return newSet;
            }
            // In case it is a single selection
            return closestIndex === selected ? null : closestIndex;
            //closestIndex,
            //xAxisValues ? xAxisValues[closestIndex] : null,
          });
        });
      }

      graph.on('mouseout', () => {
        allDotGroups.selectAll('g.dot-group').attr('opacity', 0);
        if (onHover) onHover(null);
      });

      dataRef.current = data;
      prevLabels.current = labels;
      prevStep.current = step;
      prevXAxisLabel.current = xAxisLabel;
      prevYAxisLabel.current = yAxisLabel;
      prevZoom.current = currentZoom;
      prevXAxisValues.current = xAxisValues;
    };

    window.addEventListener('resize', drawRef.current);

    return () => window.removeEventListener('resize', drawRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Maybe might need to double-check that and remove the exception

  // Handle when data changes or the selected x unit changes
  useEffect(() => {
    selectedRef.current = selected;
    pdbDataRef.current = pdbData || pdbDataRef.current;
    drawRef.current({
      data: yData,
      selected,
      pdbData,
      step,
      xAxisLabel,
      yAxisLabel,
      xAxisValues,
    });
  }, [selected, pdbData, yData, step, xAxisLabel, yAxisLabel, xAxisValues]);

  useEffect(() => drawRef.current({ labels: lab }), [lab]);

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
      if (!key || !lab[key] || type === 'dash') return;
      drawRef.current({ hovered: key, labels: lab });
    },
    [lab, type],
  );

  const handleMouseOut = useCallback(
    ({
      target: {
        dataset: { key },
      },
    }) => {
      if (!key || !lab[key] || type === 'dash') return;
      drawRef.current({ labels: lab });
    },
    [lab, type],
  );

  const handleClick = useCallback(() => onSelect(new Set()), [onSelect]);

  // Set if the grpah must give a few space for elements below (e.g. the legend)
  const giveSpaceBelow = selfLegend || type === 'dash';

  return (
    <div className={className ? className : style.graph}>
      <div
        className={
          giveSpaceBelow
            ? style['graph-container-partial']
            : style['graph-container']
        }
        ref={containerRef}
      />
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
      {type === 'dash' && (
        <Button
          variant="contained"
          disabled={selected instanceof Set && !selected.size}
          onClick={handleClick}
        >
          <FontAwesomeIcon icon={faTrashAlt} />
          &nbsp;
          <span>Clear selection</span>
        </Button>
      )}
    </div>
  );
};

export default Graph2;
