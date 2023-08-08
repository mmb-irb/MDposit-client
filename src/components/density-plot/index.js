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
  line,
  curveCatmullRom,
} from 'd3';

import style from './style.module.css';

const dataPlaceholder = {};

// This graph has been done by adapting the example from https://d3-graph-gallery.com/graph/density_basic.html

// Necessary for axes and axis labels
// WARNING: Note that this is not automatic and it may require manual update when the highest value increases (left margin)
const margin = {
  top: 10,
  right: 30,
  left: 55,
  bottom: 40,
};

// DANI: Actualmente no se usa
// DANI: Funcionar funciona bien, pero el resultado no me gustó porque puede dar lugar a malentendidos
const DensityPlot = forwardRef(({
  // Data containing an object with count of different values
  data,
  // Set the axis labels
  xAxisLabelText,
  yAxisLabelText,
  // Set the color
  color = '#69b3a2',
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

  // ----------------------------------------------------------------------------------------

  // This useEffect must be run only once
  // The graph content is updated through the referenced functions
  useEffect(() => {
    // Set the graph main handlers
    const graph = select(containerRef.current).append('svg');

    // Set axes
    const x = scaleLog();
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

    // Set the graph actual drawing
    const drawing = graph.append("path")
      .attr("opacity", ".8")
      .attr("stroke", "#000")
      .attr("stroke-width", 1)
      .attr("stroke-linejoin", "round");

    // Set a function to update the drawing color and call it right away
    updateColor.current = ({ color }) => {
      drawing.attr("fill", color);
    };
    updateColor.current({ color });

    // --------------------------------------------------------------------------------------------------

    // Set the updating functions
    // These functions are called by specific useEffects declared below when an specific input changes

    // Set a function to update data changes
    updateDataRef.current = ({ data }) => {

      // Create a logarithmic series of ranges of snapshots per simulation
      // Add to each range the sum of number of simulations within that range
      const densities = {};
      Object.entries(data).forEach(([value, count]) => {
        const valueScale = 10**(value.toString().length - 1);
        if (densities[valueScale]) densities[valueScale] += count;
        else densities[valueScale] = count;
      });

      // Find the maximum count among densities
      const maxCount = Object.values(densities).reduce((cv, nv) => {
        return Math.max(cv, nv);
      }, -Infinity);

      // Get some minimum and maximum values to set the x value range
      const minValue = Object.keys(densities).reduce((cv, nv) => {
        return Math.min(cv, nv);
      }, Infinity);
      const maxValue = Object.keys(densities).reduce((cv, nv) => {
        return Math.max(cv, nv);
      }, -Infinity);

      // Set axes
      x.domain([minValue, maxValue]);
      y.domain([0, maxCount]);

      // Now set densities as the path datum expects to find them: arrays of 2 numeric values each
      const adaptedDensities = Object.entries(densities).map(([key, value]) => [+key, value]);

      // Plot the area
      drawing.datum(adaptedDensities);

      // Force a redraw
      updateSizeRef.current();
    }

    // This ref allows to update the graph without having to remake the whole graph
    updateSizeRef.current = () => {
      // Change the graph size according to the container size
      const { clientWidth: width, clientHeight: height } = containerRef.current;
      graph.attr('width', width).attr('height', height);
      // Get size of the graph body after substracting margins
      const actualWidth = width - margin.left - margin.right;
      const actualHeight = height - margin.top - margin.bottom;
      // Set axis positions
      x.range([margin.left, margin.left + actualWidth]);
      xAxis.attr("transform", "translate(0," + (margin.top + actualHeight) + ")").call(axisBottom(x));
      y.range([margin.top + actualHeight, margin.top]);
      yAxis.attr("transform", "translate(" + margin.left + ", 0)").call(axisLeft(y));
      // Set axis label positions
      const xAxisLabelMargin = 5;
      xAxisLabel.attr("x", margin.left + actualWidth / 2).attr("y", height - xAxisLabelMargin);
      const yAxisLabelMargin = 12;
      yAxisLabel.attr("x", yAxisLabelMargin).attr("y", margin.top + actualHeight / 2)
        .attr("transform", `rotate(-90, ${yAxisLabelMargin}, ${margin.top + actualHeight / 2})`);

      // Set the drawing position
      drawing.attr("d", line()
        .curve(curveCatmullRom)
          .x(d => x(d[0]))
          .y(d => y(d[1]))
      );
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

  return (
    <div className={className ? className : style.default}>
      <div className={style['graph-container']} ref={containerRef} />
    </div>
  );
});

export default DensityPlot;
