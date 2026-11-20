import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@mui/material/styles';
import createChartTooltip from '../../utils/chart-tooltip';


// Set the size of the axis numbers
const axisNumbersFontSize = "12px";
const axisLabelsFontSize = "14px";

const TimelineChart = ({ data, className }) => {
  const containerRef = useRef();
  const svgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  // Get the provided theme
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;
  const secondaryColor = theme.palette.primary.dark;

  // Observe container size changes
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!data || !data.length) return;
    const { width, height } = dimensions;
  
    // Clear any existing chart
    d3.select(svgRef.current).selectAll("*").remove();

    // Set dimensions and margins
    const margin = { top: 30, right: 90, bottom: 56, left: 90 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Parse dates and format for x-axis
    const parseDate = d => {
      const [year, month] = d.split('-');
      return new Date(year, month - 1);
    };
    
    // Create scales
    const x = d3.scaleTime()
      .domain(d3.extent(data, d => parseDate(d.date)))
      .range([0, innerWidth]);

    // Both Y axes get the same number of intervals, so they share the grid lines, each with a round step
    const tickCount = 5;
    const roundStep = max => {
      const rawStep = Math.max(1, max) / tickCount;
      const magnitude = 10 ** Math.floor(Math.log10(rawStep));
      // These are counts, so the step has no decimals
      return [1, 2, 2.5, 5, 10].map(multiple => multiple * magnitude)
        .filter(Number.isInteger).find(step => step >= rawStep);
    };
    const y1Step = roundStep(d3.max(data, d => d.totalProjects));
    const y2Step = roundStep(d3.max(data, d => d.totalMds));

    // Primary Y-axis scale (for projects)
    const y1 = d3.scaleLinear()
      .domain([0, y1Step * tickCount])
      .range([innerHeight, 0]);

    // Secondary Y-axis scale (for MDs)
    const y2 = d3.scaleLinear()
      .domain([0, y2Step * tickCount])
      .range([innerHeight, 0]);

    // Create axes — use same tick count; grid lines align with left axis
    // One tick per year. A growth that crosses no new year gets the year of its first month
    const yearTicks = x.ticks(d3.timeYear.every(1));
    const xAxis = d3.axisBottom(x)
      .tickValues(yearTicks.length > 0 ? yearTicks : [x.domain()[0]])
      .tickFormat(d3.timeFormat("%Y"));

    const y1TickValues = d3.range(tickCount + 1).map(i => i * y1Step);
    const y2TickValues = d3.range(tickCount + 1).map(i => i * y2Step);

    const y1Axis = d3.axisLeft(y1).tickValues(y1TickValues);
    const y2Axis = d3.axisRight(y2).tickValues(y2TickValues);

    // Add horizontal grid lines (using shared y1 tick values)
    svg.append("g")
      .attr("class", "grid")
      .call(
        d3.axisLeft(y1)
          .tickValues(y1TickValues)
          .tickSize(-innerWidth)
          .tickFormat("")
      )
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line")
        .style("stroke", "#e0e0e0")
        .style("stroke-dasharray", "3,3")
      );

    // Add X axis
    svg.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .style("font-size", axisNumbersFontSize)
      .call(xAxis);

    // Add primary Y axis (projects)
    svg.append("g")
      .style("font-size", axisNumbersFontSize)
      .call(y1Axis);

    // Add secondary Y axis (MDs)
    svg.append("g")
      .attr("transform", `translate(${innerWidth}, 0)`)
      .style("font-size", axisNumbersFontSize)
      .call(y2Axis);

    // Create the line generators
    const projectLine = d3.line()
      .x(d => x(parseDate(d.date)))
      .y(d => y1(d.totalProjects))
      .curve(d3.curveMonotoneX);

    const mdLine = d3.line()
      .x(d => x(parseDate(d.date)))
      .y(d => y2(d.totalMds))
      .curve(d3.curveMonotoneX);

    // Add the line paths
    // Projects line
    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", secondaryColor)
      .attr("stroke-width", 3)
      .attr("d", projectLine);

    // MDs line
    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", primaryColor)
      .attr("stroke-width", 3)
      .attr("d", mdLine);

    // Add tooltip functionality
    const tooltip = createChartTooltip();
    // With many months a dot on each one beads the lines, so then a dot shows only under the mouse
    const dotsAlwaysShown = data.length <= 24;
    const dotRadius = dotsAlwaysShown ? 4 : 6;
    const restingDotOpacity = dotsAlwaysShown ? 1 : 0;

    // Add tooltip handlers for Projects
    const showTooltipProjects = function(d) {
      d3.select(this).attr("fill-opacity", 1);
      tooltip.show(`
        <strong>Date:</strong> ${d.date}<br>
        <strong>New Projects:</strong> ${d.newProjects.toLocaleString()}<br>
        <strong>Total Projects:</strong> ${d.totalProjects.toLocaleString()}
      `, d3.event);
    };

    // Add tooltip handlers for MDs
    const showTooltipMds = function(d) {
      d3.select(this).attr("fill-opacity", 1);
      tooltip.show(`
        <strong>Date:</strong> ${d.date}<br>
        <strong>New MDs:</strong> ${d.newMds.toLocaleString()}<br>
        <strong>Total MDs:</strong> ${d.totalMds.toLocaleString()}
      `, d3.event);
    };

    const hideTooltip = function() {
      d3.select(this).attr("fill-opacity", restingDotOpacity);
      tooltip.hide();
    };

    // Add dots for data points - Projects
    svg.selectAll(".dot-projects")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "dot-projects")
      .attr("cx", d => x(parseDate(d.date)))
      .attr("cy", d => y1(d.totalProjects))
      .attr("r", dotRadius)
      .attr("fill-opacity", restingDotOpacity)
      .attr("fill", secondaryColor)
      .style("cursor", "pointer")
      .on("mouseover", showTooltipProjects)
      .on("mouseout", hideTooltip);

    // Add dots for data points - MDs
    svg.selectAll(".dot-mds")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "dot-mds")
      .attr("cx", d => x(parseDate(d.date)))
      .attr("cy", d => y2(d.totalMds))
      .attr("r", dotRadius)
      .attr("fill-opacity", restingDotOpacity)
      .attr("fill", primaryColor)
      .style("cursor", "pointer")
      .on("mouseover", showTooltipMds)
      .on("mouseout", hideTooltip);

    // Add axes labels
    svg.append("text")
      .attr("transform", `translate(${innerWidth / 2}, ${innerHeight + 44})`)
      .style("text-anchor", "middle")
      .style("font-size", axisLabelsFontSize)
      .text("Upload Date");

    // Left Y-axis label (Projects)
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 5)
      .attr("x", -(innerHeight / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", secondaryColor)
      .style("font-size", axisLabelsFontSize)
      .text("Total Projects");

    // Right Y-axis label (MDs)
    svg.append("text")
      .attr("transform", "rotate(90)")
      .attr("y", -innerWidth - margin.right + 0)
      .attr("x", innerHeight / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", primaryColor)
      .style("font-size", axisLabelsFontSize)
      .text("Total MDs");

    // Add legend (inside the plot area, top-center, above grid lines)
    const legendWidth = 160;
    const legendHeight = 22;
    const legendX = innerWidth / 2 - legendWidth / 2;
    const legendY = 10;
    const legend = svg.append("g")
      .attr("transform", `translate(${legendX}, ${legendY})`);

    // White background so text is readable over grid lines
    legend.append("rect")
      .attr("x", -6)
      .attr("y", -4)
      .attr("width", legendWidth + 12)
      .attr("height", legendHeight)
      .attr("fill", "white")
      .attr("opacity", 0.85)
      .attr("rx", 3);

    // Projects legend
    legend.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", secondaryColor);

    legend.append("text")
      .attr("x", 20)
      .attr("y", 12)
      .text("Projects")
      .style("font-size", axisNumbersFontSize);

    // MDs legend
    legend.append("rect")
      .attr("x", 100)
      .attr("y", 0)
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", primaryColor);

    legend.append("text")
      .attr("x", 120)
      .attr("y", 12)
      .text("MDs")
      .style("font-size", axisNumbersFontSize);

    // The tooltip goes away with this drawing of the chart
    return tooltip.remove;
  }, [data, dimensions]);

  return (
    <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }}>
      <svg ref={svgRef} style={{ display: 'block' }} />
    </div>
  );
};

export default TimelineChart;