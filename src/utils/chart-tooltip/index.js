import { select } from 'd3';

// The distance in pixels between the mouse and the tooltip
const OFFSET = 12;

// A tooltip that follows the mouse over a chart drawn with d3, with the look of the app's cards
// Every chart creates its own, and removes it when the chart is drawn again or gone
const createChartTooltip = () => {
  const tooltip = select('body').append('div')
    .style('position', 'fixed')
    .style('z-index', 9999)
    .style('pointer-events', 'none')
    .style('padding', '8px')
    .style('border-radius', '4px')
    .style('border', '1px solid var(--mui-palette-divider)')
    .style('background', 'var(--mui-palette-background-paper)')
    .style('color', 'var(--mui-palette-text-primary)')
    .style('font-size', '12px')
    .style('opacity', 0);
  // Place it beside the mouse of the given event, on the side where it fits in the window
  const move = event => {
    const { width, height } = tooltip.node().getBoundingClientRect();
    const fitsRight = event.clientX + OFFSET + width <= window.innerWidth;
    const fitsBelow = event.clientY + OFFSET + height <= window.innerHeight;
    tooltip
      .style('left', `${fitsRight ? event.clientX + OFFSET : event.clientX - OFFSET - width}px`)
      .style('top', `${fitsBelow ? event.clientY + OFFSET : event.clientY - OFFSET - height}px`);
  };
  return {
    show: (html, event) => {
      tooltip.html(html).style('opacity', 1);
      move(event);
    },
    move,
    hide: () => tooltip.style('opacity', 0),
    remove: () => tooltip.remove(),
  };
};

export default createChartTooltip;
