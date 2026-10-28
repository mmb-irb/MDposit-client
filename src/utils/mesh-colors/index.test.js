import { getMeshColors } from '.';

// Three vertices
const position = [0, 0, 0, 1, 0, 0, 0, 1, 0];

describe('getMeshColors', () => {
  it('takes RGB triplets per vertex as they are', () => {
    const colors = [1, 0, 0, 0, 0.5, 0, 0, 0, 1];
    expect(Array.from(getMeshColors(position, colors))).toEqual(colors);
  });

  it('colors red, green and blue by coordinate offsets in the older format', () => {
    // Red up to the first vertex, green up to the second and blue the third
    expect(Array.from(getMeshColors(position, [2, 5]))).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });
});
