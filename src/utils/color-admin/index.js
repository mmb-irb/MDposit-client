// These colors are used to mark different selections
// When all colors are used the next selections are marked in black
const asignedColors = [
  { color: 'red' },
  { color: 'green' },
  { color: 'blue' },
  { color: 'orange' },
  { color: 'purple' },
];

// Check colors untils get an available color
// If no color is available then return black
export const getColor = () => {
  for (const ac of asignedColors) {
    if (ac.used) continue;
    ac.used = true;
    return ac.color;
  }
  return 'black';
};

// Mark the color as not used, so it can be used further
export const freeColor = color => {
  if (color === 'black') return;
  for (const ac of asignedColors) {
    if (ac.color === color) ac.used = false;
  }
};

// Mark all colors as not used
export const freeAllColors = () => {
  for (const ac of asignedColors) {
    ac.used = false;
  }
};
