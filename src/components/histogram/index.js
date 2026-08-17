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
  left: 90,
  bottom: 60,
};

// Convert number to superscript 
function formatExponent(exp) {
  const superscripts = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '-': '⁻'
  };

  return exp.toString().split('')
    .map(char => superscripts[char] || char)
    .join('');
}

// Set the size of the axis numbers
const axisNumbersFontSize = "15px";
const axisLabelsFontSize = "20px";

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
  binMethod = 'log', // log, sturges, root, manual, linear
  // Manually set number of bins (optional)
  binCount = 10,
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
    const x = binMethod === 'linear' ? scaleLinear() : scaleLog().base(10);;
    const xAxis = graph.append("g");
    const y = scaleLinear();
    const yGrid = graph.append("g").attr("class", style.grid);
    const yAxis = graph.append("g");

    // Set  axis labels
    const xAxisLabel = graph.append("text")
      .attr("text-anchor", "middle")
      .style("font-size", axisLabelsFontSize);
    const yAxisLabel = graph.append("text")
      .attr("text-anchor", "middle")
      .style("font-size", axisLabelsFontSize);

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
      if (!data || Object.keys(data).length === 0) return;

      // If using automatic logarithmic binning (current approach)
      if (binMethod === 'log') {
        // Create exponential series of ranges of values
        // Add to each range the sum of value counts within that range
        const scaleCounts = {};
        Object.entries(data).forEach(([value, count]) => {
          const valueScale = value.toString().length - 1;
          if (scaleCounts[valueScale]) scaleCounts[valueScale] += count;
          else scaleCounts[valueScale] = count;
        });

        // Get minimum and maximum scales
        const minScale = Object.keys(scaleCounts).reduce((cv, nv) => Math.min(cv, nv), Infinity);
        const maxScale = Object.keys(scaleCounts).reduce((cv, nv) => Math.max(cv, nv), -Infinity);
        // Create the xTicks to be used as x range as well
        // Note that we add 1 to the last scale, so we can plot a histogram bar between the actual last scale and the next
        const xTicks = [];
        for (let scale = minScale; scale <= maxScale + 1; scale++) {
          xTicks.push(10 ** scale);
        }
        // Set data as it is about to be passed to d3
        const columnsData = Object.values(scaleCounts).map((count, i) => {
          return { x0: xTicks[i], x1: xTicks[i + 1], length: count }
        });

        // Find the maximum count among scaleCounts
        const maxCount = Object.values(scaleCounts).reduce((cv, nv) => Math.max(cv, nv), -Infinity);

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
      } else if (binMethod === 'linear') {
        // Linear binning: one bin per integer unit
        const values = Object.keys(data).map(Number);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        // Create bins for every integer between min and max (inclusive)
        const columnsData = [];
        for (let i = minValue; i <= maxValue; i++) {
          columnsData.push({ x0: i, x1: i + 1, length: data[i] || 0 });
        }
        const maxCount = Math.max(...columnsData.map(d => d.length));
        // Use linear scale for x axis
        x.domain([minValue, maxValue + 1]);
        y.domain([0, maxCount]);
        const newColumnsData = graph.selectAll("rect").data(columnsData);
        newColumnsData.exit().remove();
        newColumnsData.enter().append('rect');
        graph.selectAll("rect")
          .attr("fill", color)
          .append("svg:title")
          .text(onHover);
        updateSizeRef.current();
      } else {
        if (binMethod === 'sturges' || binMethod === 'root') {
          const totalDataPoints = Object.values(data).reduce((cv, nv) => cv + nv, 0);
          if (binMethod === 'sturges') {
            binCount = Math.ceil(Math.log2(totalDataPoints) + 1);
          } else if (binMethod === 'root') {
            binCount = Math.ceil(Math.sqrt(totalDataPoints));
          }
        }

        // Manual bin count approach with equal width bins on log scale
        // Find min and max values from data
        const values = Object.keys(data).map(Number);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);

        // For equal bins in log scale, calculate bin edges using exponential distribution
        const logMinValue = Math.log10(minValue > 0 ? minValue : 0.1); // Handle zero/negative values
        const logMaxValue = Math.log10(maxValue);
        const logRange = logMaxValue - logMinValue;
        const logBinWidth = logRange / binCount;

        // Create bins
        const bins = {};
        for (let i = 0; i < binCount; i++) {
          bins[i] = 0;
        }

        // Create xTicks for bin edges in log space
        const xTicks = [];
        for (let i = 0; i <= binCount; i++) {
          xTicks.push(Math.pow(10, logMinValue + i * logBinWidth));
        }

        // Distribute data into bins
        Object.entries(data).forEach(([value, count]) => {
          const numValue = Number(value);
          if (numValue <= 0) return; // Skip non-positive values in log scale

          // Find appropriate bin for this value
          let binIndex = binCount - 1; // Default to last bin
          for (let i = 0; i < binCount; i++) {
            if (numValue >= xTicks[i] && numValue < xTicks[i + 1]) {
              binIndex = i;
              break;
            }
          }
          // Special case for max value
          if (numValue === maxValue) binIndex = binCount - 1;

          bins[binIndex] += count;
        });

        // Set data for d3
        const columnsData = Object.values(bins).map((count, i) => {
          return { x0: xTicks[i], x1: xTicks[i + 1], length: count };
        });

        // Find the maximum count
        const maxCount = Math.max(...Object.values(bins));

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
      if (width <= margin.left + margin.right || height <= margin.top + margin.bottom) return;
      graph.attr('width', width).attr('height', height);
      // Get size of the graph body after substracting margins
      const actualWidth = width - margin.left - margin.right;
      const actualHeight = height - margin.top - margin.bottom;
      // Get all current columns to count them
      const columns = graph.selectAll("rect");
      const columnsCount = columns.nodes().length;
      // Set axis positions
      x.range([margin.left, margin.left + actualWidth]);
      // Custom tick format for linear vs log
      let tickFormatFn;
      if (binMethod === 'linear') {
        // Only show divisibles of 5 and 1
        tickFormatFn = d => (d === 1 || (Number.isInteger(d) && d % 5 === 0)) ? d : '';
      } else {
        tickFormatFn = d => {
          if (d === 0) return '0';
          const exp = Math.log10(d);
          if (Number.isInteger(exp)) {
            if (exp === 0) return '1';
            if (exp === 1) return '10';
            return `10${formatExponent(exp)}`;
          }
          return '';
        };
      }
      xAxis.attr("transform", "translate(0," + (margin.top + actualHeight) + ")")
        .call(axisBottom(x)
          .ticks(columnsCount)
          .tickFormat(tickFormatFn)
        )
        .style("font-size", axisNumbersFontSize);
      y.range([margin.top + actualHeight, margin.top]);
      yGrid.attr("transform", "translate(" + margin.left + ", 0)")
        .call(axisLeft(y).tickSize(-actualWidth).tickFormat(''));
      yAxis.attr("transform", "translate(" + margin.left + ", 0)").call(axisLeft(y))
        .style("font-size", axisNumbersFontSize);
      // Set axis label positions
      const xAxisLabelMargin = 10;
      xAxisLabel.attr("x", margin.left + actualWidth / 2).attr("y", height - xAxisLabelMargin);
      const yAxisLabelMargin = 20;
      yAxisLabel.attr("x", yAxisLabelMargin).attr("y", margin.top + actualHeight / 2)
        .attr("transform", `rotate(-90, ${yAxisLabelMargin}, ${margin.top + actualHeight / 2})`);

      // Get all current columns and place/shape them according to data
      columns
        //.attr("x", 1)
        .attr("transform", d => "translate(" + x(d.x0) + "," + y(d.length) + ")")
        .attr("width", d => x(d.x1) - x(d.x0) - 1)
        .attr("height", d => height - margin.bottom - y(d.length))
    };

    // Redraw when either the window or the graph's own container is resized.
    const resizeGraph = () => updateSizeRef.current();
    window.addEventListener('resize', resizeGraph);
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(resizeGraph);
    resizeObserver?.observe(containerRef.current);

    // Cleanup function
    return () => {
      graph.remove();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resizeGraph);
    }
  }, []);

  // Handle when data changes
  useEffect(() => {
    updateDataRef.current({ data });
  }, [data]);

  // Handle when x axis label text changes
  useEffect(() => {
    updateXAxisLabelText.current({ xAxisLabelText });
  }, [xAxisLabelText]);

  // Handle when y axis label text changes
  useEffect(() => {
    updateYAxisLabelText.current({ yAxisLabelText });
  }, [yAxisLabelText]);

  // Handle when color changes
  useEffect(() => {
    updateColor.current({ color });
  }, [color]);

  // Handle when onHover changes
  useEffect(() => {
    updateOnHover.current({ onHover });
  }, [onHover]);

  return (
    <div className={className ? className : style.default}>
      <div className={style['graph-container']} ref={containerRef} />
    </div>
  );
});

export default Histogram;
