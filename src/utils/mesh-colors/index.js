// Get the RGB color of every vertex of a mesh, from 0 to 1, as a flat array like the vertex coordinates
// Colors may be given as RGB triplets per vertex, or as two coordinate indices in an older format:
// Coordinates up to the first index are red, then green up to the second index, and blue the rest
export const getMeshColors = (position, colorData) => {
  // RGB triplets per vertex
  if (Array.isArray(colorData) && colorData.length === position.length)
    return new Float32Array(colorData);
  // Backward-compatible path for previous color offset input
  const colorOffset = Array.isArray(colorData) ? colorData : [0, 0];
  return new Float32Array(position.length).map((v, i) => {
    if (i > colorOffset[1] && i % 3 === 2) {
      return 1.0;
    } else if (i > colorOffset[0] && i <= colorOffset[1] && i % 3 === 1) {
      return 1.0;
    } else if (i <= colorOffset[0] && i % 3 === 0) {
      return 1.0;
    }
    return 0.0;
  });
};
