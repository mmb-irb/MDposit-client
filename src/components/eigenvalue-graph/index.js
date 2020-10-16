import React, { useRef, useEffect } from 'react';
import { noop, round } from 'lodash-es';
import {
  select,
  scaleLinear,
  scaleBand,
  line,
  area,
  axisBottom,
  axisLeft,
  axisRight,
  //event, // This is used to know the mouse cursor position
  easeBackOut,
} from 'd3';

import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
} from '@material-ui/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashAlt } from '@fortawesome/free-regular-svg-icons';

import reducedMotion from '../../utils/reduced-motion';

import style from './style.module.css';

const MARGIN = { top: 20, right: 40, bottom: 20, left: 30 };
const MIN_DISPLAY_INDEX = 14; // display at least 14 components
const MIN_DISPLAY_EXPL = 0.8; // display at least components for 80% explanation

const EigenvalueGraph = ({
  data,
  totalEigenvalue,
  projections = [],
  setProjections,
}) => {
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const drawRef = useRef(noop);
  const processedRef = useRef(null);

  // should only be run once
  useEffect(() => {
    const graph = select(containerRef.current).append('svg');
    graph
      .append('defs')
      .append('clipPath')
      .attr('id', 'clip-reveal')
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('height', '100%')
      .attr('width', 0)
      // transition on first display, uncover from left to right
      .transition()
      .duration(reducedMotion() ? 0 : 50 * 43)
      .attr('width', '100%');

    const refs = {
      xAxis: graph.append('g').attr('class', style.axis),
      yExplAxis: graph.append('g').attr('class', style.axis),
      yEigenAxis: graph.append('g').attr('class', style.axis),
      explanationArea: graph.append('g').attr('class', style.explanation),
      visualBars: graph
        .append('g')
        .attr('class', `${style.visual} ${style.bars}`),
      targetBars: graph
        .append('g')
        .attr('class', `${style.target} ${style.bars}`),
    };

    drawRef.current = ({ processed = processedRef.current } = {}) => {
      // container size
      const { clientWidth: width, clientHeight: height } = containerRef.current;
      graph.attr('width', width).attr('height', height);

      // x axis
      const x = scaleBand()
        .domain(processed.map((_, i) => i))
        .range([MARGIN.left, width - MARGIN.right])
        .padding(0.1);

      // visual x axis
      const xAxis = g =>
        g
          .attr('transform', `translate(0, ${height - MARGIN.bottom})`)
          .call(axisBottom(x).tickFormat(d => d + 1));
      refs.xAxis.call(xAxis);

      // explained variance
      // y axis
      const yExpl = scaleLinear()
        .domain([0, 1])
        .range([height - MARGIN.bottom, MARGIN.top])
        .nice();

      // visual y axis
      const yExplAxis = g =>
        g.attr('transform', `translate(${width - MARGIN.right}, 0)`).call(
          axisRight(yExpl)
            .ticks(6)
            .tickFormat(d => `${(typeof d === 'number' ? d : 0) * 100}%`),
        );
      refs.yExplAxis.call(yExplAxis);

      // line
      const lineFn = line()
        .x((_, i) => x(i) + x.bandwidth() / 2)
        .y(yExpl);

      const explLine = refs.explanationArea
        .selectAll(`path.${style['top-line']}`)
        .data([processed]);
      explLine
        .enter()
        .append('path')
        .attr('class', style['top-line'])
        .attr('clip-path', 'url(#clip-reveal)')
        .attr('opacity', 0)
        .merge(explLine)
        .attr('d', d => lineFn(d.map(item => item.cumulativeExplained)))
        .transition()
        .duration(2500)
        .attr('opacity', 1);

      // area
      const areaFn = area()
        .x((_, i) => x(i) + x.bandwidth() / 2)
        .y0(height - MARGIN.bottom)
        .y1(d => yExpl(d));

      const explArea = refs.explanationArea
        .selectAll(`path.${style.area}`)
        .data([processed]);
      explArea
        .enter()
        .append('path')
        .attr('class', style.area)
        .attr('clip-path', 'url(#clip-reveal)')
        .attr('opacity', 0)
        .merge(explArea)
        .attr('d', d => areaFn(d.map(item => item.cumulativeExplained)))
        .transition()
        .duration(2500)
        .attr('opacity', 1);

      // eigenvalue
      // y axis
      const yEigen = scaleLinear()
        .domain([0, data[0].eigenvalue])
        .range([height - MARGIN.bottom, MARGIN.top])
        .nice();

      // visual y axis
      const yEigenAxis = g =>
        g
          .attr('transform', `translate(${MARGIN.left}, 0)`)
          .call(axisLeft(yEigen).ticks(5));
      refs.yEigenAxis.call(yEigenAxis);

      // bars
      const bars = refs.visualBars.selectAll('rect').data(processed);
      bars
        .enter()
        .append('rect')
        .attr('y', yEigen(0))
        .attr('height', 0)
        .merge(bars)
        .attr(
          'class',
          ({ hasProjection, projected }) =>
            `${hasProjection ? style['has-projection'] : ''} ${
              projected ? style.projected : ''
            }`.trim() || null,
        )
        .attr('x', (_, i) => x(i))
        .attr('width', x.bandwidth())
        .transition()
        .ease(easeBackOut.overshoot(5))
        .duration(reducedMotion() ? 0 : 500)
        .delay(reducedMotion() ? 0 : (_, i) => i * 50)
        .attr('y', d => yEigen(d.eigenvalue))
        .attr('height', d => height - MARGIN.bottom - yEigen(d.eigenvalue));
      // full-height bars (for click and hover handlers)
      const clickBars = refs.targetBars.selectAll('rect').data(processed);
      clickBars
        .enter()
        .append('rect')
        .attr('y', 0)
        .attr('height', '100%')
        .on('click', ({ hasProjection }, i) => {
          if (!hasProjection) return;
          setProjections(projections => {
            const set = new Set(projections);
            set[set.has(i) ? 'delete' : 'add'](i);
            return Array.from(set).sort((a, b) => a - b);
          });
        })
        .on('mousemove', (d, i) => {
          tooltipRef.current.innerHTML = `
            <div>
              <p>Principal component ${i + 1}</p>
              <p>Eigenvalue: ${(Math.round(d.eigenvalue * 100) / 100).toFixed(
                2,
              )}</p>
              <p>
                Explained variance: ${(
                  Math.round((d.eigenvalue / totalEigenvalue) * 1000) / 10
                ).toFixed(1)}%
              </p>
              <p>
                Cumulative explained variance: ${(
                  Math.round(d.cumulativeExplained * 1000) / 10
                ).toFixed(1)}%
              </p>
              <p>Projection data is ${
                d.hasProjection ? '' : 'not'
              } available</p>
            </div>
          `;
          // Display the tooltip (this is internally softed)
          tooltipRef.current.style.opacity = 1;
          //const { width, height } = tooltipRef.current.getBoundingClientRect();
          //tooltipRef.current.style.transform = `translate(${event.pageX -
          //  width / 2}px, ${event.pageY - height - 5}px)`;
        })
        // Hide the tooltip (this is internally softed)
        .on('mouseout', () => (tooltipRef.current.style.opacity = 0))
        .merge(clickBars)
        .attr('class', ({ hasProjection }) =>
          hasProjection ? style['has-projection'] : '' || null,
        )
        .attr('x', (_, i) => x(i))
        .attr('width', x.bandwidth());
    };

    window.addEventListener('resize', drawRef.current);

    return () => window.removeEventListener('resize', drawRef.current);
  }, [data, setProjections, totalEigenvalue]);

  // data massaging
  useEffect(() => {
    let acc = 0;
    const processed = [];
    for (const [index, { eigenvalue, data: projectionData }] of Object.values(
      data,
    ).entries()) {
      acc += eigenvalue;
      const cumulativeExplained = acc / totalEigenvalue;
      processed.push({
        cumulativeExplained,
        eigenvalue,
        projected: projections.includes(index),
        hasProjection: !!projectionData,
      });
      if (
        index >= MIN_DISPLAY_INDEX &&
        cumulativeExplained >= MIN_DISPLAY_EXPL
      ) {
        break;
      }
    }

    processedRef.current = processed;

    drawRef.current({ processed });
  }, [data, totalEigenvalue, projections]);

  const components = Object.values(data);

  return (
    <>
      <div className={style['graph-container']} ref={containerRef} />
      <div className={style.tooltip} ref={tooltipRef} />
      {!!projections.length && (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Principal component</TableCell>
                <TableCell>Eigenvalue</TableCell>
                <TableCell>Explained variance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projections.map(p => (
                <TableRow key={p}>
                  <TableCell>{p + 1}</TableCell>
                  <TableCell>{components[p].eigenvalue}</TableCell>
                  <TableCell>
                    {round(
                      (components[p].eigenvalue / totalEigenvalue) * 100,
                      1,
                    )}{' '}
                    %
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button
            variant="contained"
            onClick={() => setProjections([])}
            className={style.delete}
          >
            <FontAwesomeIcon icon={faTrashAlt} />
            &nbsp;
            <span>Clear selection</span>
          </Button>
        </>
      )}
    </>
  );
};

export default EigenvalueGraph;
