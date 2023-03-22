import React, { useRef, useEffect } from 'react';
import { noop, zip, random, debounce, clamp } from 'lodash-es';
import {
  select,
  scaleLinear,
  axisLeft,
  axisBottom,
  scaleSequential,
  interpolateViridis,
  interpolate,
  event,
  brush,
  rgb,
} from 'd3';
import { Delaunay } from 'd3-delaunay';
import { schedule, sleep, frame } from 'timing-functions';
import cn from 'classnames';

import useToggleState from '../../hooks/use-toggle-state';
import movePoints from './move-points';
import getDrawLegend from './get-draw-legend';
import reducedMotion from '../../utils/reduced-motion';

import { IconButton } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRandom } from '@fortawesome/free-solid-svg-icons';

import style from './style.module.css';

// device pixel ratio (for "retina" screens)
const dPR = window.devicePixelRatio || 1;

// delaunay diagram detection threshold
const THRESHOLD = 20;

const MARGIN = { top: 10, right: 10, bottom: 25, left: 25 };

// animation constants
const MAX_DELAY = 500;
const [MIN_DURATION, MAX_DURATION] = [375, 625];

const colorScale = scaleSequential(interpolateViridis);

// This component renders a graph
// This graph is displayed when user selects 2 pca projections
const Projections = ({
  framestep,
  projectionsData,
  projections,
  datumRange,
  totalFrames,
  setRequestedFrame,
}) => {
  const containerRef = useRef(null);
  const legendRef = useRef(null);
  const drawRef = useRef(noop);
  const dataPointsRef = useRef(null);
  const processedRef = useRef(null);
  const tooltipRef = useRef(null);
  const delaunayDiagramRef = useRef({ find() {} });

  const [switched, toggleSwitched] = useToggleState(false);

  useEffect(() => {
    const canvas = select(containerRef.current).append('canvas');
    const graph = select(containerRef.current).append('svg');

    const context = canvas
      .node()
      .getContext('2d', { alpha: false, desynchronized: true });

    const brushInstance = brush();

    const refs = {
      xScale: scaleLinear(),
      yScale: scaleLinear(),
      xAxis: graph.append('g').attr('class', style.axis),
      yAxis: graph.append('g').attr('class', style.axis),
      xAxisLegend: graph
        .append('text')
        .attr('class', cn(style.axis, style['legend-text'])),
      yAxisLegend: graph
        .append('text')
        .attr('class', cn(style.axis, style['legend-text'])),
      dataPoints: graph.append('g').attr('class', style['data-points']),
      hover: graph.append('circle').attr('fill', 'transparent'),
      legendCanvas: select(legendRef.current).select('canvas'),
      legendCursor: select(legendRef.current).select(`.${style.cursor}`),
      brush: brushInstance,
      brushElement: graph.append('g').attr('class', 'brush'),
    };

    // debounce it to prevent redrawing that too much
    refs.drawLegend = debounce(
      getDrawLegend(refs.legendCanvas.node().getContext('2d', { alpha: true })),
      MAX_DELAY + MAX_DURATION,
    );

    const reset = ({ onlyTooltip } = {}) => {
      tooltipRef.current.style.display = 'none';
      refs.hover.attr('fill', 'transparent');
      if (onlyTooltip) return;
      refs.legendCursor.style('left', '');
      refs.legendCursor.style('opacity', 0);
    };

    // Select the frame to be displayed by the viewer
    const handleClick = ({ datumIndex } = {}) =>
      // This function is a setter from a useState hook in the parent script (pca/index.js)
      setRequestedFrame(requestedFrame => {
        if (!totalFrames) {
          console.error(
            'No number of frames in metadata. Are we missing the main trajectory?',
          );
          return null;
        }
        const target = Math.floor(datumIndex * (totalFrames / datumRange));
        // If the user clicks in the already selected point it is unselected
        return target === requestedFrame ? null : target;
      });

    drawRef.current = async ({
      processed = processedRef.current,
      brushing,
    } = {}) => {
      if (!processed) return;
      await frame();
      if (!containerRef.current.firstChild) return;

      // container size
      const { clientWidth: width, clientHeight: height } = containerRef.current;
      graph.attr('width', width).attr('height', height);
      if (canvas.attr('width') !== `${width * dPR}`) {
        canvas.attr('width', width * dPR);
      }
      if (canvas.attr('height') !== `${height * dPR}`) {
        canvas.attr('height', height * dPR);
      }
      canvas.style('width', `${width}px`).style('height', `${height}px`);

      refs.brushElement.call(refs.brush);

      const isFirstTime = !dataPointsRef.current;

      // x axis
      refs.xScale.range([MARGIN.left, width - MARGIN.right]);
      if (!brushing) refs.xScale.domain(processed.xMinMax);

      // y axis
      refs.yScale.range([height - MARGIN.bottom, MARGIN.top]);
      if (!brushing) refs.yScale.domain(processed.yMinMax);
      // visual x axis
      const xAxis = g =>
        g
          .attr(
            'transform',
            `translate(0, ${clamp(refs.yScale(0), 0, height - 32)})`,
          )
          .call(
            axisBottom(refs.xScale)
              .ticks(Math.round(width / 75))
              .tickFormat(d => (d === 0 ? null : d)),
          );
      refs.xAxis
        .transition()
        .duration(!isFirstTime && !reducedMotion() && MAX_DELAY + MAX_DURATION)
        .call(xAxis);

      refs.xAxisLegend
        .text(`← principal component ${processed.projections[0] + 1} →`)
        .transition()
        .duration(!isFirstTime && !reducedMotion() && MAX_DELAY + MAX_DURATION)
        .attr('transform', `translate(${width / 2}, ${height - 5})`);

      // visual y axis
      const yAxis = g =>
        g
          .attr(
            'transform',
            `translate(${clamp(refs.xScale(0), 30, width - 1)}, 0)`,
          )
          .call(
            axisLeft(refs.yScale)
              .ticks(Math.round(height / 75))
              .tickFormat(d => (d === 0 ? null : d)),
          );
      refs.yAxis
        .transition()
        .duration(!isFirstTime && !reducedMotion() && MAX_DELAY + MAX_DURATION)
        .call(yAxis);

      refs.yAxisLegend
        .text(`← principal component ${processed.projections[1] + 1} →`)
        .transition()
        .duration(!isFirstTime && !reducedMotion() && MAX_DELAY + MAX_DURATION)
        .attr('transform', `translate(5, ${height / 2}) rotate(90)`);

      refs.brush.on('end', () => {
        const { selection } = event;
        if (!selection) return;
        refs.xScale.domain(
          [selection[0][0], selection[1][0]].map(
            refs.xScale.invert,
            refs.xScale,
          ),
        );
        refs.yScale.domain(
          [selection[1][1], selection[0][1]].map(
            refs.yScale.invert,
            refs.yScale,
          ),
        );
        // remove visual brush rectangle
        refs.brushElement.call(refs.brush.move, null);
        drawRef.current({ brushing: true });
      });

      const radiusScale =
        Math.log(
          Math.max(
            (processed.xMinMax[1] - processed.xMinMax[0]) /
              (refs.xScale.domain()[1] - refs.xScale.domain()[0]),
            (processed.yMinMax[1] - processed.yMinMax[0]) /
              (refs.yScale.domain()[1] - refs.yScale.domain()[0]),
          ),
        ) + 1;
      const radius = (dPR * Math.min(width, height) * radiusScale) / 250;
      // hover circle
      refs.hover.attr('r', radius + 5);

      // data points
      let maxTime = 0;
      const currentRadius = isFirstTime
        ? 0
        : dataPointsRef.current.currentRadius;
      dataPointsRef.current = processed.data.map(
        ({ x: xValue, y: yValue, fill }, i, { length }) => {
          const xPoint = refs.xScale(xValue) * dPR;
          const yPoint = refs.yScale(yValue) * dPR;
          const delay = (i * MAX_DELAY * (isFirstTime ? 2 : 1)) / length;
          const duration = reducedMotion()
            ? 0
            : random(MIN_DURATION, MAX_DURATION) * (isFirstTime ? 2 : 1);
          const time = delay + duration;
          // update maxTime if needed
          if (maxTime < time) maxTime = time;
          return {
            currentX: null,
            currentY: null,
            currentRadius: null,
            interpolateX: interpolate(
              isFirstTime
                ? refs.xScale(0) * dPR
                : dataPointsRef.current[i].currentX ||
                    dataPointsRef.current[i].x,
              xPoint,
            ),
            interpolateY: interpolate(
              isFirstTime
                ? refs.yScale(0) * dPR
                : dataPointsRef.current[i].currentY ||
                    dataPointsRef.current[i].y,
              yPoint,
            ),
            delay,
            duration,
            x: xPoint,
            y: yPoint,
            fill,
          };
        },
      );

      // same radius interpolation for all the points, so keep only one
      dataPointsRef.current.interpolateRadius = interpolate(
        currentRadius,
        radius,
      );

      // will trigger a timer animate points
      // Render the graph
      movePoints({
        context,
        dataPoints: dataPointsRef.current,
        width: width * dPR,
        height: height * dPR,
        maxTime,
        isFirstTime,
      });

      const handleHover = ({ datumIndex, datum } = {}) => {
        if (!Number.isInteger(datumIndex) || !datum) return;
        // bottom cursor
        refs.legendCursor.style(
          'left',
          `calc(${(100 * datumIndex) / processed.data.length}% - 4px)`,
        );
        refs.legendCursor.style('opacity', 1);

        // would tooltip be visible?
        const x = refs.xScale(datum.x);
        if (x < 0 || x > width) return reset({ onlyTooltip: true });
        const y = refs.yScale(datum.y);
        if (y < 0 || y > height) return reset({ onlyTooltip: true });
        // yes, then display tooltip
        const { scrollX, scrollY } = window;
        const { left, top } = containerRef.current.getBoundingClientRect();
        tooltipRef.current.innerHTML = `
          <div>
            <p>Frame ${datumIndex * processed.framestep +
              1} (click to open viewer)</p>
            <p>Principal component ${processed.projections[0] + 1}: ${
          datum.x
        }</p>
            <p>Principal component ${processed.projections[1] + 1}: ${
          datum.y
        }</p>
          </div>
        `;
        tooltipRef.current.style.display = 'inline-block';
        const rect = tooltipRef.current.getBoundingClientRect();
        tooltipRef.current.style.transform = `translate(${x +
          left +
          scrollX -
          rect.width / 2}px, ${y + top + scrollY - rect.height - 15}px)`;
        refs.hover
          .attr('cx', x)
          .attr('cy', y)
          .attr('fill', datum.fill.hex);
      };

      const handleGraphEventWith = handler => () => {
        const { scrollX, scrollY } = window;
        const { left, top } = containerRef.current.getBoundingClientRect();
        const { pageX, pageY } = event;
        const mouseX = pageX - left - scrollX;
        const mouseY = pageY - top - scrollY;
        // invert the mouse position with the scale because we only computed the
        // Delaunay graph once on the raw data for optimisation purposes
        const datumIndex = delaunayDiagramRef.current.find(
          refs.xScale.invert(mouseX),
          refs.yScale.invert(mouseY),
        );
        const datum = processed.data[datumIndex];
        if (datum) {
          const datumX = refs.xScale(datum.x);
          const datumY = refs.yScale(datum.y);
          // is within threshold?
          if (
            Math.sqrt(
              Math.abs(datumX - mouseX) ** 2 + Math.abs(datumY - mouseY) ** 2,
            ) <= THRESHOLD
          ) {
            return handler({ datumIndex, datum });
          }
        }
        reset();
        handler();
      };

      graph
        .on('mousemove', handleGraphEventWith(handleHover))
        .on('mouseout', reset)
        .on('click', handleGraphEventWith(handleClick));

      /**
       * @param {(object: object) => void} handler
       */
      const handleLegendEventWith = handler => () => {
        const node = refs.legendCanvas.node();
        if (!(node && 'getBoundingClientRect' in node)) return;
        const { left, width } = node.getBoundingClientRect();
        const { pageX } = event;
        const position = (pageX - left) / width;
        const datumIndex = Math.floor(position * processed.data.length);
        handler({ datumIndex, datum: processed.data[datumIndex] });
      };

      refs.drawLegend(processed.data, refs.xScale, refs.yScale, width, height);

      refs.legendCanvas
        .on('mousemove', handleLegendEventWith(handleHover))
        .on('mouseout', reset)
        .on('click', handleLegendEventWith(handleClick));
    };

    window.addEventListener('resize', drawRef.current);

    return () => {
      // clean up
      refs.drawLegend && refs.drawLegend.cancel();
      window.removeEventListener('resize', drawRef.current);
    };
  }, [projections, setRequestedFrame, datumRange, totalFrames]);

  useEffect(() => {
    const [xProj, yProj] = switched ? [0, 1] : [1, 0];

    const coordinatesCount =
      (projectionsData && projectionsData[0].length) || 0;
    const colorScaleWithDomain = colorScale.domain([0, coordinatesCount]);

    const xProjectionData = projectionsData[projections[xProj]];
    const yProjectionData = projectionsData[projections[yProj]];
    const zipped = zip(xProjectionData, yProjectionData);
    const processed = {
      data: zipped.map(([x, y], i) => {
        const hex = colorScaleWithDomain(i);
        return {
          x,
          y,
          fill: { hex, ...rgb(hex) },
        };
      }),
      xMinMax: [Math.min(...xProjectionData), Math.max(...xProjectionData)],
      yMinMax: [Math.min(...yProjectionData), Math.max(...yProjectionData)],
      framestep,
      projections: [projections[xProj], projections[yProj]],
    };

    processedRef.current = processed;

    drawRef.current({ processed });

    // calculate Delaunay graph to later find points from mouse position
    (async () => {
      // delay a bit, to prioritise drawing
      await sleep(MAX_DELAY + MAX_DURATION);
      await schedule(100);
      delaunayDiagramRef.current = Delaunay.from(zipped);
    })();
  }, [projectionsData, projections, framestep, switched]);

  const coordinatesCount = (projectionsData && projectionsData[0].length) || 0;

  return (
    <>
      <div
        className={style['graph-container']}
        onDoubleClick={drawRef.current}
        ref={containerRef}
      />
      <div className={style.legend}>
        <IconButton
          title="Switch axes"
          className={cn(style.switch, { [style.switched]: switched })}
          onClick={toggleSwitched}
          size="large"
        >
          <FontAwesomeIcon icon={faRandom} />
        </IconButton>
        <p>position in simulation:</p>
        <div className={style['color-scale']}>
          <div>start</div>
          <div ref={legendRef}>
            <canvas height="1" width={coordinatesCount} />
            <div className={style.cursor} />
          </div>
          <div>end</div>
        </div>
      </div>
      <div className={style.tooltip} ref={tooltipRef} />
    </>
  );
};

export default Projections;
