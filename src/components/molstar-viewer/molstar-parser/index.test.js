import { parseCoordinateFrames } from '.';

// Two frames of two atoms, as downloaded: x, y, z of every atom one frame after the other
const DATA = new Float32Array([
  1, 2, 3, 3, 4, 5,
  2, 2, 2, 4, 4, 4,
]).buffer;

const atomCoordinates = (frame, atom) => [frame.x[atom], frame.y[atom], frame.z[atom]];

describe('parseCoordinateFrames', () => {
  it('reads the coordinates of every frame', () => {
    const frames = parseCoordinateFrames(DATA, 2);
    expect(frames).toHaveLength(2);
    expect(atomCoordinates(frames[0], 1)).toEqual([3, 4, 5]);
    expect(atomCoordinates(frames[1], 0)).toEqual([2, 2, 2]);
  });

  // As the NGL viewer does when a 'centering' selection is passed (e.g. the embed target residue)
  it('centers every frame around the given atoms', () => {
    const frames = parseCoordinateFrames(DATA, 2, 0, [0]);
    expect(atomCoordinates(frames[0], 0)).toEqual([0, 0, 0]);
    expect(atomCoordinates(frames[0], 1)).toEqual([2, 2, 2]);
    expect(atomCoordinates(frames[1], 0)).toEqual([0, 0, 0]);
    expect(atomCoordinates(frames[1], 1)).toEqual([2, 2, 2]);
  });
});
