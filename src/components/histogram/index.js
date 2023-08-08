import React, {
  useRef,
  useEffect,
  forwardRef,
} from 'react';
import { noop } from 'lodash-es';
import {
  select,
  scaleLinear,
  scaleLog,
  axisBottom,
  axisLeft,
} from 'd3';

import style from './style.module.css';

const dataPlaceholder = {};

// This graph has been done by adapting the example from https://d3-graph-gallery.com/graph/histogram_basic.html

// Necessary for axes and axis labels
// WARNING: Note that this is not automatic and it may require manual update when the highest value increases (left margin)
const margin = {
  top: 10,
  right: 30,
  left: 55,
  bottom: 40,
};

const Histogram = forwardRef(({
  // Data containing an object with count of different values
  data,
  // Set the axis labels
  xAxisLabelText,
  yAxisLabelText,
  // Set the color
  color = '#69b3a2',
  // Set the onHover function
  onHover,
  // Force a classname for the overall component element
  className,
}, ref) => {
  // Set a fake dataset to allow the graph to work when no data is passed
  if (!data) data = dataPlaceholder;

  // Referenced document element where d3 is rendered
  const containerRef = useRef(null);
  // Referenced function which allows to update the cart without having to remake it
  const updateDataRef = useRef(noop);
  const updateSizeRef = useRef(noop);
  const updateXAxisLabelText = useRef(noop);
  const updateYAxisLabelText = useRef(noop);
  const updateColor = useRef(noop);
  const updateOnHover = useRef(noop);

  // ----------------------------------------------------------------------------------------

  // This useEffect must be run only once
  // The graph content is updated through the referenced functions
  useEffect(() => {
    // Set the graph main handlers
    const graph = select(containerRef.current).append('svg');

    // Set axes
    const x = scaleLog().base(10);
    const xAxis = graph.append("g");
    const y = scaleLinear();
    const yAxis = graph.append("g");

    // Set  axis labels
    const xAxisLabel = graph.append("text")
      .attr("text-anchor", "middle");
    const yAxisLabel = graph.append("text")
      .attr("text-anchor", "middle")

    // Set functions to update axis label texts when their specific input changes
    // Also call them now for this first time
    updateXAxisLabelText.current = ({ xAxisLabelText }) => {
      xAxisLabel.text(xAxisLabelText);
    };
    updateYAxisLabelText.current = ({ yAxisLabelText }) => {
      yAxisLabel.text(yAxisLabelText);
    };
    updateXAxisLabelText.current({ xAxisLabelText });
    updateYAxisLabelText.current({ yAxisLabelText });

    // --------------------------------------------------------------------------------------------------

    // Set the updating functions
    // These functions are called by specific useEffects declared below when an specific input changes

    // Set a function to update data changes
    updateDataRef.current = ({ data }) => {

      // Create exponential series of ranges of values
      // Add to each range the sum of value counts within that range
      const scaleCounts = {};
      Object.entries(data).forEach(([value, count]) => {
        const valueScale = value.toString().length - 1;
        if (scaleCounts[valueScale]) scaleCounts[valueScale] += count;
        else scaleCounts[valueScale] = count;
      });

      // Get minimum and maximum scales
      const minScale = Object.keys(scaleCounts).reduce((cv, nv) => {
        return Math.min(cv, nv);
      }, Infinity);
      const maxScale = Object.keys(scaleCounts).reduce((cv, nv) => {
        return Math.max(cv, nv);
      }, -Infinity);
      // Create the xTicks to be used as x range as well
      // Note that we add 1 to the last scale, so we can plot a histogram bar between the actual last scale and the next
      const xTicks = [];
      for (let scale = minScale; scale <= maxScale + 1; scale++) {
        xTicks.push(10**scale);
      }
      // Set data as it is about to be passed to d3
      const columnsData = Object.values(scaleCounts).map((count, i) => {
        return { x0: xTicks[i], x1: xTicks[i+1], length: count }
      });

      // Find the maximum count among scaleCounts
      const maxCount = Object.values(scaleCounts).reduce((cv, nv) => {
        return Math.max(cv, nv);
      }, -Infinity);

      // Set axes
      x.domain([xTicks[0], xTicks[xTicks.length - 1]]);
      y.domain([0, maxCount]);

      // Load new data in columns
      const newColumnsData = graph.selectAll("rect").data(columnsData);

      // Remove columns which are no longer necessary
      newColumnsData.exit().remove();

      // Add new columns which are now necessary according to new data
      newColumnsData.enter().append('rect');

      // Edit the final columns now that we have added and removed some
      graph.selectAll("rect")
        .attr("fill", color)
        .append("svg:title")
          .text(onHover);

      // Force a redraw
      updateSizeRef.current();
    }

    // Set a function to update columns color
    updateColor.current = ({ color }) => {
      graph.selectAll("rect").attr("fill", color);
    };

    // Set a function to update onHover
    updateOnHover.current = ({ onHover }) => {
      graph.selectAll("rect").append("svg:title").text(onHover);
    };

    // This ref allows to update the graph without having to remake the whole graph
    updateSizeRef.current = () => {
      // Change the graph size according to the container size
      const { clientWidth: width, clientHeight: height } = containerRef.current;
      graph.attr('width', width).attr('height', height);
      // Get size of the graph body after substracting margins
      const actualWidth = width - margin.left - margin.right;
      const actualHeight = height - margin.top - margin.bottom;
      // Get all current columns to count them
      const columns = graph.selectAll("rect");
      const columnsCount = columns.nodes().length;
      // Set axis positions
      x.range([margin.left, margin.left + actualWidth]);
      xAxis.attr("transform", "translate(0," + (margin.top + actualHeight) + ")")
        .call(axisBottom(x).ticks(columnsCount));
      y.range([margin.top + actualHeight, margin.top]);
      yAxis.attr("transform", "translate(" + margin.left + ", 0)").call(axisLeft(y));
      // Set axis label positions
      const xAxisLabelMargin = 5;
      xAxisLabel.attr("x", margin.left + actualWidth / 2).attr("y", height - xAxisLabelMargin);
      const yAxisLabelMargin = 12;
      yAxisLabel.attr("x", yAxisLabelMargin).attr("y", margin.top + actualHeight / 2)
        .attr("transform", `rotate(-90, ${yAxisLabelMargin}, ${margin.top + actualHeight / 2})`);

      // Get all current columns and place/shape them according to data
      columns
        //.attr("x", 1)
        .attr("transform", d => "translate(" + x(d.x0) + "," + y(d.length) + ")")
        .attr("width", d => x(d.x1) - x(d.x0) -1)
        .attr("height", d => height - margin.bottom - y(d.length))
    };

    // Set the redraw logic to be run every time the graph container is resized
    window.addEventListener('resize', updateSizeRef.current);

    // Cleanup function
    return () => {
      graph.remove();
      window.removeEventListener('resize', updateSizeRef.current);
    }
  }, []);

  // Handle when data changes
  useEffect(() => {
    updateDataRef.current({data});
  }, [data]);

  // Handle when x axis label text changes
  useEffect(() => {
    updateXAxisLabelText.current({xAxisLabelText});
  }, [xAxisLabelText]);

  // Handle when y axis label text changes
  useEffect(() => {
    updateYAxisLabelText.current({yAxisLabelText});
  }, [yAxisLabelText]);

  // Handle when color changes
  useEffect(() => {
    updateColor.current({color});
  }, [color]);

  // Handle when onHover changes
  useEffect(() => {
    updateOnHover.current({onHover});
  }, [onHover]);

  return (
    <div className={className ? className : style.default}>
      <div className={style['graph-container']} ref={containerRef} />
    </div>
  );
});

export default Histogram;
