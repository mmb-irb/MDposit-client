// Set the most suitable position for a tooltip
// Use the parent element to set the limits where this tooltip may be
// Use the tooltip element to get the suze of the tooltip
// Use the reference position (e.g. mouse position) to place the tooltip
// The offset is the pixels of separation between the reference and the tooltip
// The idea is that the tooltip may be over/under and left/right of the reference position
// It depends on how close to each limit is the reference position
export const setTooltipPosition = (parent, tooltip, reference, offset = 0) => {
  const limits = parent.getBoundingClientRect();
  const size = tooltip.getBoundingClientRect();
  let x = reference.x;
  // If it is more at the right side
  if (Math.abs(limits.left - x) > Math.abs(x - limits.right)) {
    const xSize = size.right - size.left;
    x -= offset + xSize;
  }
  // If it is more at the left side
  else {
    x += offset;
  }
  // After this, apply the parent offset
  x -= limits.left;
  let y = reference.y;
  // If it is more at the bottom side
  if (Math.abs(limits.top - y) > Math.abs(y - limits.bottom)) {
    const ySize = size.bottom - size.top;
    y -= offset + ySize;
  }
  // If it is more at the top side
  else {
    y += offset;
  }
  // After this, apply the parent offset
  y -= limits.top;
  // Return the coordinates
  //return { x, y };
  return { x, y };
};
