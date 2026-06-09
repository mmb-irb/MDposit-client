import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@mui/material/styles';


// Set the size of the axis numbers
const axisNumbersFontSize = "14px";
const axisLabelsFontSize = "24px";

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
  
    // Clear any existing chart and tooltips
    d3.select(svgRef.current).selectAll("*").remove();
    d3.selectAll(".timeline-tooltip").remove();

    // Set dimensions and margins
    const margin = { top: 30, right: 90, bottom: 80, left: 90 };
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

    // Primary Y-axis scale (for projects)
    const y1 = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.totalProjects) * 1.1])
      .range([innerHeight, 0])
      .nice();

    // Secondary Y-axis scale (for MDs)
    const y2 = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.totalMds) * 1.1])
      .range([innerHeight, 0])
      .nice();

    // Create axes — use same tick count; grid lines align with left axis
    const xAxis = d3.axisBottom(x)
      .ticks(12)
      .tickFormat(d3.timeFormat("%b %Y"));

    const tickCount = 8;
    const y1Max = y1.domain()[1];
    const y2Max = y2.domain()[1];
    // Evenly spaced from 0 to niced max — same count guarantees identical pixel positions
    const y1TickValues = d3.range(tickCount + 1).map(i => Math.round(i * y1Max / tickCount));
    const y2TickValues = d3.range(tickCount + 1).map(i => Math.round(i * y2Max / tickCount));

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
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .style("font-size", axisNumbersFontSize)
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-36)");

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
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "timeline-tooltip")
      .style("position", "absolute")
      .style("background", "white")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("padding", "8px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 10);

    // Add tooltip handlers for Projects
    const showTooltipProjects = function(d) {
      const mouseEvent = d3.event;
      tooltip.transition()
        .duration(200)
        .style("opacity", 0.9);
      tooltip.html(`
        <strong>Date:</strong> ${d.date}<br>
        <strong>New Projects:</strong> ${d.newProjects}<br>
        <strong>Total Projects:</strong> ${d.totalProjects}
      `)
        .style("left", (mouseEvent.pageX + 10) + "px")
        .style("top", (mouseEvent.pageY - 28) + "px");
    };

    // Add tooltip handlers for MDs
    const showTooltipMds = function(d) {
      const mouseEvent = d3.event;
      tooltip.transition()
        .duration(200)
        .style("opacity", 0.9);
      tooltip.html(`
        <strong>Date:</strong> ${d.date}<br>
        <strong>New MDs:</strong> ${d.newMds}<br>
        <strong>Total MDs:</strong> ${d.totalMds}
      `)
        .style("left", (mouseEvent.pageX + 10) + "px")
        .style("top", (mouseEvent.pageY - 28) + "px");
    };

    const hideTooltip = () => {
      tooltip.transition()
        .duration(500)
        .style("opacity", 0);
    };

    // Add dots for data points - Projects
    svg.selectAll(".dot-projects")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "dot-projects")
      .attr("cx", d => x(parseDate(d.date)))
      .attr("cy", d => y1(d.totalProjects))
      .attr("r", 4)
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
      .attr("r", 4)
      .attr("fill", primaryColor)
      .style("cursor", "pointer")
      .on("mouseover", showTooltipMds)
      .on("mouseout", hideTooltip);

    // Add axes labels
    svg.append("text")
      .attr("transform", `translate(${innerWidth / 2}, ${innerHeight + 75})`)
      .style("text-anchor", "middle")
      .style("font-size", "20px")
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
      .style("font-size", "14px");

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
      .style("font-size", "14px");

  }, [data, dimensions]);

  // Cleanup function to remove tooltip when component unmounts
  useEffect(() => {
    return () => {
      d3.selectAll(".timeline-tooltip").remove();
    };
  }, []);

  return (
    <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }}>
      <svg ref={svgRef} style={{ display: 'block' }} />
    </div>
  );
};

export default TimelineChart;