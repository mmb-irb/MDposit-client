import React, { useRef, useEffect, useState, memo } from 'react';

import { select, scaleBand } from 'd3';

// Set status colors
const activeBondColor = 'blue';
const brokenBondColor = '#f0f0f0';

// Represent a single row of rects according to the status
// The status is an array of true/false values
const BondStatus = memo(({ status, onClick, className }) => {
    // Set the reference to the element where the heatmap will be allocated
    const containerRef = useRef(null);
    // Save the previous chart reference so we can remove it before a new render
    const previousCharts = useRef(null);
    // Use a state as a workaround to force rerenders on window resize
    const [, setCurrentWindow] = useState(null);
    // The chart is assigned to a referenced 'div' which must be rendered first
    // All this process is runned after the render
    useEffect(() => {
        // Reset the chart
        // WARNING: For some reason, if this part is re-render the original render is not gone
        // WARNING: We must reset the element manually or infinite elements are rendered and stacked
        if (previousCharts.current)
            previousCharts.current.forEach(chart => chart.remove());
  
        // Get the current element where all this heatmap is placed
        const container = containerRef.current;
        // The first render, when there is no reference to the current element yet, we skip the process
        const {
            clientWidth: width,
            clientHeight: height,
        } = container.parentElement;

        // Use canvas to display the heatmap blocks since d3 is not as efficient
        // Canvas is set this way so we can access this specific element later
        // WARNING: Using the 'document.getElementById' is risky since there may be more
        // WARNING: e.g. the color legend
        const canvasElement = document.createElement('CANVAS');
        select(container)
            .node()
            .appendChild(canvasElement);
        const canvas = select(canvasElement)
            .attr('id', 'canvas')
            .attr('width', width)
            .attr('height', height)
            .style('position', 'absolute')
            //.style('top', offset.top + 'px')
            //.style('left', offset.left + 'px')
            .style('cursor', onClick ? 'pointer' : undefined);
        const canvasContext = canvas
            .node()
            .getContext('2d' /*, {desynchronized: true}*/);
  
        // append the svg object to the body of the page
        const svg = select(container)
            .append('svg')
            .attr('id', 'svg')
            .attr('viewBox', [0, 0, width, height]);
  
        // Build X scales and axis:
        const x = scaleBand()
            .range([0, width])
            .domain(status.map((s,i) => i))
            .paddingInner(0);
        
        // Get the width of each cell
        const cellWidth = x.bandwidth();
  
        // Display heatmap cells using canvas
        status.forEach((stat, i) => {
            const xPosition = x(i);
            const color = stat ? activeBondColor : brokenBondColor;
            canvasContext.fillStyle = color;
            canvasContext.fillRect(xPosition, 0, cellWidth, height);
        });
  
        // Handle when a cell is clicked
        if (onClick) {
            canvasElement.onmousedown = () => {
                // Call the on click function
                onClick();
            };
        }
  
        // Record all elements which must be removed manually when re-rendering
        previousCharts.current = [svg, canvas];
  
        const handleResize = () => {
            setCurrentWindow({
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
            });
        };
        window.addEventListener('resize', handleResize);
  
        // Cleaning function
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }); // This useEffect has no dependencies

    // Finally, render the horizontal bar
    return (
    // It is important to specify a height value
    // Otherwise canvas and svg may be not coordinated
    <div
        className={className}
        style={className ? undefined : { height: '100px', width: '600px' }}
    >
        <div
            ref={containerRef}
            id={'container'}
            // WARNING: This width 100% may seem redundant, but chrome needs it
            style={{ position: 'relative', width: '100%', height: '100%' }}
        />
    </div>
    );
});

export default BondStatus;