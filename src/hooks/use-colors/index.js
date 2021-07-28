import { useMemo, useRef } from 'react';

// These colors are used to mark different selections
// When all colors are used the next selections are marked in black
const defaultAvailableColors = ['red', 'green', 'blue', 'orange', 'purple'];

// This hook is a special getter of available colors that tracks which colors have been already got
// This way you will not get the same color twice
// In addition 2 more functions are returned to free a specific color or all colors
const useColors = (
  availableColors = defaultAvailableColors,
  overColor = 'black',
) => {
  // Track used colors
  const usedColors = useRef([]);

  // Return a color from the asigned colors list which has not been given yet
  return useMemo(() => {
    const getColor = () => {
      for (const color of availableColors) {
        const index = usedColors.current.indexOf(color);
        if (index === -1) {
          usedColors.current.push(color);
          return color;
        }
      }
      return overColor;
    };
    // Consider the specified color as available to be given again
    const freeColor = color => {
      if (color === overColor) return;
      const index = usedColors.current.indexOf(color);
      if (index === -1) throw new Error(`Color ${color} is not used`);
      usedColors.current.splice(index, 1);
    };

    // Consider all colors as available to be given again
    const freeAllColors = () => {
      usedColors.current = [];
    };
    return [getColor, freeColor, freeAllColors];
  }, [availableColors, overColor]);
};

export default useColors;
