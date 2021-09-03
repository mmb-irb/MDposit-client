import React, { useRef, useEffect } from 'react';
import { select } from 'd3';

import style from './style.module.css';

const LineSample = ({ color, dash, className }) => {
  // Referenced document element where d3 is rendered
  const containerRef = useRef(null);

  // This useEffect must be run only once
  useEffect(() => {
    const graph = select(containerRef.current);
    graph.attr('width', 50).attr('height', 5);
    graph
      .append('line')
      .style('stroke', color)
      .style('stroke-dasharray', dash)
      .style('stroke-width', 3)
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', 50)
      .attr('y2', 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Maybe might need to double-check that and remove the exception

  return (
    <svg ref={containerRef} className={className ? className : style.default} />
  );
};

export default LineSample;
