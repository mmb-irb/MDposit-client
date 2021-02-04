import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useContext,
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
import cn from 'classnames';

import { FormControlLabel, Checkbox, Slider } from '@material-ui/core';

import { PdbCtx } from '../../contexts';
import { NICE_NAMES } from '../../utils/constants';

import addTextBackground from './add-text-background';
import addMasks from './add-masks';

import { getTextWidth, getTextSizeDOM } from '../../utils/document-measurer';

import { getMean, getMeanAndStdv } from '../../utils/statistics';

import style from './style.module.css';

const NUMBER_OF_DATA_POINTS_ON_SCREEN_AT_MAX_ZOOM = 100;

const dPR = window.devicePixelRatio || 1;

// According to d3 documentation
const defaultD3font = 'normal 10px sans-serif';
// Experimentally verfied
const titlesD3font = 'normal 14px sans-serif';

const yDataPlaceholder = { placeholder: { data: [0] } };

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
  //
  defaultPrecision = 1,
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
  // Start number of activated keys
  // A value of 'null' stands for all activated
  startKeys = null,
  // React hooks
  onHover,
  selected,
  onSelect,
  selfLegend = false,
  // Object with each dataset name and a value of true/false to set which data is displayed
  show,
  // Set if the precision slider must be shown
  showPrecisionSlider = false,
  // Set if precision may be changed with the mouse wheel or is always the maximum available
  blockMaxPrecision = true,
  // Display the mean line in the graph
  mean = false,
  // Display the standard deviation area in the graph
  standardDeviation = false,
  // Set an extra margin around the graph
  margin = { top: 10, right: 10, bottom: 10, left: 10 },
  // DANI: Todavía no está implementado pero se usa para calcular márgenes
  // Set if values in x axis is horizontal (false) or vertical (true)
  flippedXAxisValues = false,
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
  const yEntries = Object.entries(yData);
  const yKeys = yEntries.map(([key]) => key);

  // Get each dataset name
  //const yKeys = yEntries.map(([key]) => key);
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

  // Set the yAxisValues by adding all dataset 'data' values
  let yAxisValues = yEntries
    .map(([, dataset]) => dataset.data)
    .reduce((cv, nv) => cv.concat(nv));
  // Round values if they are nomeric, since labels just reach x.00
  yAxisValues = yAxisValues.map(v => Math.round(v * 100) / 100);

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
  const maxXAxisWidth = xAxisValues
    ? Math.max(
        ...xAxisValues.map(label => getTextWidth(label, defaultD3font)),
      ) + roatatedTextOffset
    : 10;
  // Get the calculated widths of all y labels and select the maximum
  const maxYAxisWidth = Math.max(
    ...yAxisValues.map(label => getTextWidth(label, defaultD3font)),
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
    yAxisValues.length === 1
      ? Math.max(maxYAxisWidth, getTextWidth(yAxisLabel, titlesD3font))
      : maxYAxisWidth + yAxisLabelHegiht;

  // Set the dimensions and offsets of the graph
  const offset = {
    top: requiredTopOffset + margin.top,
    right: margin.right,
    bottom: requiredBottomOffset + margin.bottom,
    left: requiredLeftOffset + margin.left,
  };

  // ----------------------------------------------------------------------------------------

  // Boolean array defining which data is displayed (true) or hidden (false)
  const [lab, setLab] = useState(() =>
    fromPairs(yKeys.map(key => [key, activateKey()])),
  );

  // if show is not available we set all as true
  if (!show && (!lab.length || lab.length < yKeys.length))
    setLab(Array(yKeys.length).fill(true));
  if (show && lab !== show) setLab(show);

  const [pr, setPrecision] = useState(defaultPrecision);

  const prevLabels = useRef(lab);
  const prevPrecision = useRef(pr);
  const prevRescaleX = useRef(scale => scale);
  const prevStep = useRef(step);
  const prevXAxisLabel = useRef(xAxisLabel);
  const prevYAxisLabel = useRef(yAxisLabel);

  useEffect(() => {
    drawRef.current && pdbData && pdbData.file && drawRef.current();
  }, [pdbData]);

  // Set the number of points to be represented
  const precisionScale = useMemo(
    () => scaleLog().range([NUMBER_OF_DATA_POINTS_ON_SCREEN_AT_MAX_ZOOM, 1]),
    [],
  );

  // This useEffect must be run only once
  // The graph content is updated through the 'drawRef' referenced function
  useEffect(() => {
    // Set the d3 base
    let canvas;
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

    // zoom
    //   make zoom extent dynamic depending on number of data points
    //   ↳ results in similar precision at maximum zoom regardless of data size
    const maxZoomExtent =
      yEntries[0][1].data.length / NUMBER_OF_DATA_POINTS_ON_SCREEN_AT_MAX_ZOOM;

    precisionScale.domain([1, maxZoomExtent]);

    const graphZoom = zoom().scaleExtent([1, maxZoomExtent]);
    graph.call(graphZoom);
    graphZoom.on('zoom', () => {
      allDotGroups.selectAll('g.dot-group').attr('opacity', 0);

      let precision;
      if (
        event.sourceEvent &&
        event.sourceEvent.type === 'wheel' &&
        !blockMaxPrecision
      ) {
        precision =
          2 ** Math.floor(Math.log2(precisionScale(event.transform.k)));
        setPrecision(precision);
      }

      drawRef.current({
        rescaleX: event.transform.rescaleX.bind(event.transform),
        precision,
      });
    });

    // This ref allows to update the graph without having to remake the whole graph
    drawRef.current = ({
      data = dataRef.current,
      hovered,
      precision = prevPrecision.current,
      labels = prevLabels.current,
      rescaleX = prevRescaleX.current,
      selected = selectedRef.current,
      pdbData = pdbDataRef.current,
      step = prevStep.current,
      xAxisLabel = prevXAxisLabel.current,
      yAxisLabel = prevYAxisLabel.current,
    } = {}) => {
      // container size
      const { clientWidth: width, clientHeight: height } = containerRef.current;

      const dataEntries = Object.entries(data);
      const dataKeys = dataEntries.map(([key]) => key);

      //console.log(data);
      //console.log(dataKeys);

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
        allDotGroups
          .attr('transform', `translate(${x(closestIndex * step)}, 0)`)
          .attr(
            'opacity',
            // Dots become invisible if the closest index is not between the minimum and the maximum
            closestIndex * step >= xMin && closestIndex * step < xMax ? 1 : 0,
          );
        allDotGroups
          .selectAll('g.dot-group')
          .attr(
            'transform',
            d =>
              `translate(0, ${
                d === 'x'
                  ? height - offset.bottom
                  : (y(data[d].data[closestIndex]) || 0) + 2.5
              })`,
          )
          .attr('opacity', d => (d === 'x' || labels[d] ? 1 : 0))
          .selectAll('text')
          // Set the dot text in the x axis
          .text(d => {
            // Dot in x axes
            if (d === 'x') {
              const number = closestIndex * step * xScaleFactor;
              if (xUnit === 'ns') return +number.toFixed(2) + ' ns';
              if (xUnit === 'frame') return 'frame ' + +number.toFixed(2);
              if (xUnit === 'atom') {
                if (!pdbData.file) return +number.toFixed(2);
                const atom = pdbData.file.atomMap.get(
                  pdbData.file.atomStore.atomTypeId[number],
                );
                if (!atom) return +number.toFixed(2);
                const residue = pdbData.file.residueMap.get(
                  pdbData.file.atomStore.residueIndex[number],
                );
                if (!residue) return +number.toFixed(2);
                return `${residue.resname} - ${atom.atomname}`;
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

      if (onSelect) {
        graph.on('click', (_, index, nodes) => {
          const [xValue] = mouse(nodes[index]);
          const closestIndex =
            Math.round(x.invert(xValue) / precision / step) * precision;
          if (closestIndex * step < xMin || closestIndex * step >= xMax) {
            return;
          }
          onSelect(
            closestIndex,
            xAxisValues ? xAxisValues[closestIndex] : null,
          );
        });
      }

      graph.on('mouseout', () => {
        allDotGroups.selectAll('g.dot-group').attr('opacity', 0);
        if (onHover) onHover(null);
      });

      dataRef.current = data;
      prevLabels.current = labels;
      prevPrecision.current = precision;
      prevRescaleX.current = rescaleX;
      prevStep.current = step;
      prevXAxisLabel.current = xAxisLabel;
      prevYAxisLabel.current = yAxisLabel;
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
    });
  }, [selected, pdbData, yData, step, xAxisLabel, yAxisLabel]);

  useEffect(() => drawRef.current({ precision: pr, labels: lab }), [pr, lab]);

  // Handle when user clicks on legend checkboxes
  const handleChange = useCallback(({ target: { dataset: { key } } }) => {
    if (!key) return;

    setLab(previous => {
      const nextLabels = { ...previous, [key]: !previous[key] };
      // Check if any value is true before returning the labels
      // This way, the user can not uncheck the last active checkbox
      if (Object.values(nextLabels).some(Boolean)) return nextLabels;
      // If all of the values would be false, keep the previous
      return previous;
    });
  }, []);

  const handleMouseOver = useCallback(
    ({
      target: {
        dataset: { key },
      },
    }) => {
      if (!key || !lab[key]) return;
      drawRef.current({ hovered: key, precision: pr, labels: lab });
    },
    [pr, lab],
  );

  const handleMouseOut = useCallback(
    ({
      target: {
        dataset: { key },
      },
    }) => {
      if (!key || !lab[key]) return;
      drawRef.current({ precision: pr, labels: lab });
    },
    [pr, lab],
  );

  const handlePrecisionChange = useCallback(
    (_, value) => setPrecision(2 ** (9 - value)),
    [setPrecision],
  );

  return (
    <>
      <div className={style['graph-container']} ref={containerRef} />
      <div className={style['graph-legend']}>
        {selfLegend &&
          yEntries.map(([key]) => (
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
      {showPrecisionSlider && defaultPrecision && (
        <div
          className={cn(style['graph-legend'], style['precision'])}
          title={`Showing ${pr === 1 ? 'all' : `1 out of ${pr}`} data points`}
        >
          <span>Precision:</span>
          <Slider
            value={9 - Math.log2(pr)}
            min={0}
            max={9}
            step={1}
            onChange={handlePrecisionChange}
          />
        </div>
      )}
    </>
  );
};

export default Graph2;
