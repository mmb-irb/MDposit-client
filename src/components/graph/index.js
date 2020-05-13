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
import { ColormakerRegistry } from 'ngl';
import cn from 'classnames';

import { FormControlLabel, Checkbox, Button, Slider } from '@material-ui/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashAlt } from '@fortawesome/free-regular-svg-icons';

import { PdbCtx } from '../../contexts';
import { NICE_NAMES, COLORS } from '../../utils/constants';

import addTextBackground from './add-text-background';
import addMasks from './add-masks';

import style from './style.module.css';

const MARGIN = { top: 20, right: 30, bottom: 40, left: 50 };
const NUMBER_OF_DATA_POINTS_ON_SCREEN_AT_MAX_ZOOM = 100;

const scheme = new ColormakerRegistry.schemes.element({});
const dPR = window.devicePixelRatio || 1;

const Graph = ({
  // The main data
  y: yData,
  //start = 0,
  // The difference beyween x values
  step = 1,
  // Set if the x origin is not 0, but 1. This is for the fluctuation analysis
  startsAtOne = false,
  //
  defaultPrecision,
  // The y axis label text
  yLabel,
  //
  xScaleFactor = 1,
  // The x axis label text
  xLabel,
  // Define the unit (and also the magnitude implicitly) of the x axis
  // This is used to show the right text when the mouse is over it
  // Accepted values: ns, frame, atom
  xUnit = 'ns',
  // Set the type of grapg to render
  // Accepted values: line, dash
  type = 'line',
  // Display the mean line in the graph
  mean = true,
  // Display the standard deviation area in the graph
  standardDeviation = true,
  // Start number of activated keys
  // A value of 'null' stands for all activated
  startKeys = null,
  // React hooks
  onHover,
  selected,
  onSelect,
}) => {
  const pdbData = useContext(PdbCtx);

  const containerRef = useRef(null);
  const drawRef = useRef(noop);
  const selectedRef = useRef(new Set());
  const pdbDataRef = useRef({});

  const yEntries = Object.entries(yData);
  const yKeys = yEntries.map(([key]) => key);
  let counter = 0;
  const activateKey = () => {
    if (startKeys === null || counter < startKeys) {
      counter += 1;
      return true;
    }
    return false;
  };
  const [lab, setLabels] = useState(() =>
    fromPairs(yKeys.map(key => [key, activateKey()])),
  );
  const [pr, setPrecision] = useState(defaultPrecision || 1);

  const prevLabels = useRef(lab);
  const prevPrecision = useRef(pr);
  const prevRescaleX = useRef(scale => scale);

  useEffect(() => {
    drawRef.current && pdbData && pdbData.file && drawRef.current();
  }, [pdbData]);

  const precisionScale = useMemo(
    () => scaleLog().range([NUMBER_OF_DATA_POINTS_ON_SCREEN_AT_MAX_ZOOM, 1]),
    [],
  );

  // should only be run once
  useEffect(() => {
    let canvas;
    let canvasContext;
    if (type === 'dash') {
      canvas = select(containerRef.current).append('canvas');
      canvasContext = canvas
        .node()
        .getContext('2d' /*, {desynchronized: true}*/);
    }
    const graph = select(containerRef.current).append('svg');
    const defs = graph.append('defs');
    // text background
    const textBackgroundURL = addTextBackground(defs);

    // mask opacity
    const [startMaskURL, endMaskURL] = addMasks(defs);

    const main = graph.append('g');

    // selected
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

    const allDotGroups = main.append('g');

    // order is important, everything before that will be hidden by masks
    // masks
    graph
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', MARGIN.left)
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
      if (type === 'line') {
        if (event.sourceEvent.type === 'wheel') {
          precision =
            2 ** Math.floor(Math.log2(precisionScale(event.transform.k)));

          setPrecision(precision);
        }
      }

      drawRef.current({
        rescaleX: event.transform.rescaleX.bind(event.transform),
        precision,
      });
    });

    // labels
    if (yLabel) {
      axes.yLabel = graph
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .text(yLabel);
    }
    if (xLabel) {
      axes.xLabel = graph
        .append('text')
        .style('text-anchor', 'middle')
        .text(xLabel);
    }

    drawRef.current = ({
      hovered,
      precision = prevPrecision.current,
      labels = prevLabels.current,
      rescaleX = prevRescaleX.current,
      selected = selectedRef.current,
      pdbData = pdbDataRef.current,
    } = {}) => {
      // container size
      const { clientWidth: width, clientHeight: height } = containerRef.current;
      graph.attr('width', width).attr('height', height);
      if (canvas) {
        canvas.attr('width', width * dPR).attr('height', height * dPR);
        canvas.style('width', `${width}px`).style('height', `${height}px`);
      }

      maskEnd.attr('x', width - MARGIN.right).attr('width', MARGIN.right);

      const xMin = 0;
      const xMax = yEntries[0][1].data.length * step - (startsAtOne ? step : 0);
      // x axis
      const x = rescaleX(
        scaleLinear()
          .domain([xMin, xMax])
          .range([MARGIN.left, width - MARGIN.right]),
      );
      const xAxis = g =>
        g.attr('transform', `translate(0, ${height - MARGIN.bottom})`).call(
          axisBottom(x)
            .ticks(width / 100)
            .tickSizeOuter(0)
            .tickFormat(d => {
              const tickValue = (d + (startsAtOne ? step : 0)) * xScaleFactor;
              if (tickValue >= xMin && tickValue <= xMax) {
                // The 'toFixed' function converts the number to a string decimal
                return +tickValue.toFixed(2);
              }
            }),
        );
      axes.x.call(xAxis);
      if (axes.xLabel) {
        axes.xLabel.attr('transform', `translate(${width / 2}, ${height - 5})`);
      }

      // y axis/axes
      const y = scaleLinear()
        .domain(
          extent(
            flatten(
              yEntries
                .filter(([key]) => labels[key])
                .map(([, { data }]) => extent(data)),
            ),
          ),
        )
        .nice()
        .range([height - MARGIN.bottom, MARGIN.top]);

      const yAxis = g =>
        g
          .attr('transform', `translate(${MARGIN.left}, 0)`)
          .transition()
          .call(axisLeft(y).ticks(8, '.2f'));
      axes.y.call(yAxis);
      if (axes.yLabel) {
        axes.yLabel.attr('y', 0).attr('x', 0 - height / 2);
      }

      // mean line
      if (mean) {
        const meanLines = main.selectAll('line.mean').data(yKeys);
        meanLines
          .enter()
          .append('line')
          .attr('class', 'mean')
          .attr('stroke', d => COLORS.get(d) || '#000000')
          .merge(meanLines)
          .attr('x1', x(xMin))
          .attr('x2', x(xMax))
          .attr('y1', d => y(yData[d].average))
          .attr('y2', d => y(yData[d].average))
          .transition()
          .attr('opacity', d => (labels[d] ? 0.5 : 0));
      }
      // mean ± 1σ area
      if (standardDeviation) {
        const sdRects = main.selectAll('rect.sd').data(yKeys);
        sdRects
          .enter()
          .append('rect')
          .attr('class', 'sd')
          .attr('fill', d => COLORS.get(d) || '#000000')
          .merge(sdRects)
          .attr('x', x(xMin))
          .attr('width', x(xMax) - x(xMin))
          .attr('y', d => y(yData[d].average + yData[d].stddev))
          .attr(
            'height',
            d =>
              y(yData[d].average - yData[d].stddev) -
              y(yData[d].average + yData[d].stddev),
          )
          .transition()
          .attr('opacity', d => (labels[d] ? 0.1 : 0));
      }

      const minIndex = Math.floor(x.invert(0) / step / precision);
      const maxIndex = Math.ceil(x.invert(width) / step / precision);
      // if type of graph is line
      if (type === 'line') {
        // Define the data line positions
        const lineFn = line()
          .defined((_, i) => i >= minIndex && i <= maxIndex)
          .x((_, i) => x(i * step * precision))
          .y(d => y(d));

        // Draw the data lines
        const lines = main.selectAll('path.line').data(yKeys);
        lines
          .enter()
          .append('path')
          .attr('class', 'line')
          .attr('fill', 'none')
          .attr('stroke', d => COLORS.get(d) || '#000000')
          .attr('stroke-linejoin', 'round')
          .attr('stroke-linecap', 'round')
          .merge(lines)
          .attr('d', d =>
            lineFn(yData[d].data.filter((_, i) => i % precision === 0)),
          )
          .transition()
          .attr('opacity', d => (labels[d] ? 1 : 0))
          .attr('stroke-width', d => (hovered === d ? 3 : 1.5));

        // selected
        if (selectedRect) {
          const width = Math.max(1, x(precision * step) - x(0));
          selectedRect
            .attr('width', () => width)
            .attr('x', () =>
              Number.isInteger(selected) ? x(selected * step) - width / 2 : 0,
            )
            .attr('opacity', selected === null ? 0 : 1);
        }
        // if type of graph is dash
      } else if (type === 'dash' && canvasContext) {
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
              (x(atom * step * precision - (startsAtOne ? step : 0)) -
                dashWidth / 2) *
                dPR,
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

      // dots
      const dotGroups = allDotGroups
        .selectAll('g.dot-group')
        .data([...yKeys, 'x'])
        .enter()
        .append('g')
        .attr('class', 'dot-group')
        .attr('opacity', 0);
      dotGroups
        .append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 5)
        .attr('fill', d => COLORS.get(d) || '#000000');
      dotGroups
        .append('text')
        .style('text-anchor', 'middle')
        .style('font-weight', 'bold')
        .style('paint-order', 'stroke')
        .attr('y', '-5px')
        .attr('fill', d => COLORS.get(d) || '#000000')
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
            closestIndex * step >= xMin && closestIndex * step <= xMax ? 1 : 0,
          );
        allDotGroups
          .selectAll('g.dot-group')
          .attr(
            'transform',
            d =>
              `translate(0, ${
                d === 'x'
                  ? height - MARGIN.bottom
                  : (y(yData[d].data[closestIndex]) || 0) + 2.5
              })`,
          )
          .attr('opacity', d => (d === 'x' || labels[d] ? 1 : 0))
          .selectAll('text')
          // Set the dot text in the x axis
          .text(d => {
            if (d === 'x') {
              const number =
                closestIndex * step * xScaleFactor + (startsAtOne ? step : 0);
              if (xUnit === 'ns') return +number.toFixed(2) + ' ns';
              if (xUnit === 'frame') return 'frame ' + +number.toFixed(2);
              if (xUnit === 'atom') {
                if (!pdbDataRef.current.file) return +number.toFixed(2);
                const atom = pdbDataRef.current.file.atomMap.get(
                  pdbDataRef.current.file.atomStore.atomTypeId[
                    number - (startsAtOne ? step : 0)
                  ],
                );
                if (!atom) return +number.toFixed(2);
                const residue = pdbDataRef.current.file.residueMap.get(
                  pdbDataRef.current.file.atomStore.residueIndex[
                    number - (startsAtOne ? step : 0)
                  ],
                );
                if (!residue) return +number.toFixed(2);
                return `${residue.resname} - ${atom.atomname}`;
              }
              return 'Error: Not supported unit';
            } else {
              return yData[d].data[closestIndex];
            }
          });
        if (onHover) {
          onHover(
            closestIndex * step >= xMin && closestIndex * step <= xMax
              ? closestIndex + (startsAtOne ? step : 0)
              : null,
          );
        }
      });

      if (onSelect) {
        graph.on('click', (_, index, nodes) => {
          const [xValue] = mouse(nodes[index]);
          const closestIndex =
            Math.round(x.invert(xValue) / precision / step) * precision +
            (startsAtOne ? step : 0);
          if (closestIndex * step < xMin || closestIndex * step > xMax) {
            return;
          }
          onSelect(selected => {
            if (!(selected instanceof Set)) {
              return closestIndex === selected ? null : closestIndex;
            }
            const newSet = new Set(selected);
            newSet[newSet.has(closestIndex) ? 'delete' : 'add'](closestIndex);
            return newSet;
          });
        });
      }

      graph.on('mouseout', () => {
        allDotGroups.selectAll('g.dot-group').attr('opacity', 0);
        if (onHover) onHover(null);
      });

      prevLabels.current = labels;
      prevPrecision.current = precision;
      prevRescaleX.current = rescaleX;
    };

    window.addEventListener('resize', drawRef.current);

    return () => window.removeEventListener('resize', drawRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Maybe might need to double-check that and remove the exception

  useEffect(() => {
    selectedRef.current = selected;
    pdbDataRef.current = pdbData || pdbDataRef.current;
    drawRef.current({ selected, pdbData });
  }, [selected, pdbData]);

  useEffect(() => drawRef.current({ precision: pr, labels: lab }), [pr, lab]);

  const handleChange = useCallback(({ target: { dataset: { key } } }) => {
    if (!key) return;
    setLabels(labels => {
      const nextLabels = { ...labels, [key]: !labels[key] };
      if (Object.values(nextLabels).some(Boolean)) return nextLabels;
      // If all of the values would be false, keep the previous
      return labels;
    });
  }, []);

  const handleMouseOver = useCallback(
    ({
      target: {
        dataset: { key },
      },
    }) => {
      if (!key || type === 'dash' || !lab[key]) return;
      drawRef.current({ hovered: key, precision: pr, labels: lab });
    },
    [pr, lab, type],
  );

  const handleMouseOut = useCallback(
    ({
      target: {
        dataset: { key },
      },
    }) => {
      if (!key || type === 'dash' || !lab[key]) return;
      drawRef.current({ precision: pr, labels: lab });
    },
    [pr, lab, type],
  );

  const handleClick = useCallback(() => onSelect(new Set()), [onSelect]);

  const handlePrecisionChange = useCallback(
    (_, value) => setPrecision(2 ** (9 - value)),
    [setPrecision],
  );

  return (
    <>
      <div className={style['graph-container']} ref={containerRef} />
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
                style={{ color: COLORS.get(key) || '#000000' }}
                inputProps={{ 'data-key': key }}
              />
            }
            label={NICE_NAMES.get(key) || key}
          />
        ))}
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
      {defaultPrecision && (
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
      <details className={style['graph-legend']}>
        <summary>Graph information</summary>
        <span>
          Displaying observed data (more opaque lines), alongside corresponding
          mean value (light horizontal lines), and mean ± 1σ (lighter horizontal
          bands)
        </span>
      </details>
    </>
  );
};

export default Graph;
