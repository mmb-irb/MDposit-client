// Pixels with less alpha than this (0-255) are considered the transparent background of the image
const TRANSPARENT_ALPHA = 25;
// Pixels with less perceived brightness than this (0-1) are dark: they are not visible over a dark background
// Colours which are dark but saturated (a dark red, a green) are above it on purpose, they are visible
const DARK_BRIGHTNESS = 0.2;
// Pixels with more perceived brightness than this (0-1) are light: they are not visible over a light background
const LIGHT_BRIGHTNESS = 0.8;

// Images with a smaller fraction of transparent pixels than this are considered opaque
// They bring their own background, even if they have a few transparent pixels (e.g. rounded corners)
const MIN_TRANSPARENT_FRACTION = 0.1;

// Perceived brightness (0-1) of a pixel
const brightness = (data, i) => (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;

// Fractions (0-1) of the pixels in contact with the transparent background of an image which are dark and light, weighted by alpha
// Those are the pixels in contact with the page background, so they decide if the image is visible over it
// The pixels in the border of the image are also in contact with the outside
// Return null if the image is (almost) opaque, since then it brings its own background
// Also return null if the image is fully transparent
// Returns { dark, light }
// imageData: object with the same format as the ImageData of a canvas (data, width, height)
const edgeFractions = ({ data, width, height }) => {
  const isTransparent = (x, y) => data[(y * width + x) * 4 + 3] < TRANSPARENT_ALPHA;
  let darkWeight = 0;
  let lightWeight = 0;
  let weights = 0;
  let transparentCount = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isTransparent(x, y)) { transparentCount++; continue; }
      const touchesOutside = x === 0 || y === 0 || x === width - 1 || y === height - 1
        || isTransparent(x - 1, y) || isTransparent(x + 1, y)
        || isTransparent(x, y - 1) || isTransparent(x, y + 1);
      if (!touchesOutside) continue;
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];
      weights += alpha;
      const value = brightness(data, i);
      if (value < DARK_BRIGHTNESS) darkWeight += alpha;
      if (value > LIGHT_BRIGHTNESS) lightWeight += alpha;
    }
  }
  if (transparentCount / (width * height) < MIN_TRANSPARENT_FRACTION || weights === 0) return null;
  return { dark: darkWeight / weights, light: lightWeight / weights };
};

export default edgeFractions;
