import edgeFractions from '.';

// Build an ImageData-like object from a grid of [r, g, b, a] pixels
const image = rows => ({
  width: rows[0].length,
  height: rows.length,
  data: Uint8ClampedArray.from(rows.flat(2)),
});
const T = [0, 0, 0, 0]; // transparent
const K = [0, 0, 0, 255]; // black
const W = [255, 255, 255, 255]; // white
const R = [180, 30, 30, 255]; // dark red, saturated

describe('edgeFractions', () => {
  it('is all dark for black letters on a transparent background', () => {
    expect(edgeFractions(image([[T, T, T], [T, K, T], [T, T, T]]))).toEqual({ dark: 1, light: 0 });
  });

  it('is all light for white letters on a transparent background', () => {
    expect(edgeFractions(image([[T, T, T], [T, W, T], [T, T, T]]))).toEqual({ dark: 0, light: 1 });
  });

  it('does not count saturated colours as dark or light', () => {
    expect(edgeFractions(image([[T, T, T], [T, R, T], [T, T, T]]))).toEqual({ dark: 0, light: 0 });
  });

  it('only looks at the pixels in contact with the transparent background', () => {
    // A white outline around a black core: the core is not in contact with the background
    const value = edgeFractions(image([
      [T, T, T, T, T],
      [T, W, W, W, T],
      [T, W, K, W, T],
      [T, W, W, W, T],
      [T, T, T, T, T],
    ]));
    expect(value).toEqual({ dark: 0, light: 1 });
  });

  it('splits the fractions when there are dark and light pixels', () => {
    expect(edgeFractions(image([[K, W, T]]))).toEqual({ dark: 0.5, light: 0.5 });
  });

  it('counts the pixels in the border of the image', () => {
    expect(edgeFractions(image([[K, T], [T, T]]))).toEqual({ dark: 1, light: 0 });
  });

  it('is null when the image has no transparency', () => {
    expect(edgeFractions(image([[K, K], [K, K]]))).toBeNull();
  });

  it('is null when the image is almost opaque, even with transparent corners', () => {
    // 1 transparent pixel of 25, in a dark image
    const rows = Array.from({ length: 5 }, () => Array(5).fill(K));
    rows[0][0] = T;
    expect(edgeFractions(image(rows))).toBeNull();
  });

  it('is null when the image is fully transparent', () => {
    expect(edgeFractions(image([[T, T], [T, T]]))).toBeNull();
  });
});
