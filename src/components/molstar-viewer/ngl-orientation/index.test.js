import { nglOrientationToCamera, cameraToNglOrientation, rotateSceneAroundX } from '.';

// Build an orientation the way NGL does (see ViewerControls.getOrientation in NGL)
// The rotation is given by rows, and it is stored column-major with every column scaled by the distance
const nglOrientation = (rotationRows, distance, center) => {
  const elements = new Array(16).fill(0);
  for (let column = 0; column < 3; column++)
    for (let row = 0; row < 3; row++)
      elements[column * 4 + row] = rotationRows[row][column] * distance;
  elements[12] = -center[0];
  elements[13] = -center[1];
  elements[14] = -center[2];
  elements[15] = 1;
  return elements;
};

// 90 degrees around the Y axis
const ROTATION = [
  [0, 0, 1],
  [0, 1, 0],
  [-1, 0, 0],
];

const expectClose = (actual, expected) =>
  expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value));

describe('NGL orientation', () => {
  it('gives the camera target, distance and directions in model coordinates', () => {
    const camera = nglOrientationToCamera(nglOrientation(ROTATION, 80, [10, 20, 30]));
    expectClose(camera.target, [10, 20, 30]);
    expect(camera.distance).toBeCloseTo(80);
    // NGL looks along +Z and Y is up, both rotated back to the model frame
    expectClose(camera.direction, [-1, 0, 0]);
    expectClose(camera.up, [0, 1, 0]);
  });

  it('gives the NGL default view when there is no rotation', () => {
    const identity = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const camera = nglOrientationToCamera(nglOrientation(identity, 50, [0, 0, 0]));
    expectClose(camera.direction, [0, 0, 1]);
    expectClose(camera.up, [0, 1, 0]);
  });

  it('turns a camera back into the same NGL orientation', () => {
    const orientation = nglOrientation(ROTATION, 80, [10, 20, 30]);
    expectClose(cameraToNglOrientation(nglOrientationToCamera(orientation)), orientation);
  });

  // As NGL rotationGroup.rotateX(-1.57), which pages use to have the Z axis from bottom to top
  it('rotates the scene around the X axis', () => {
    const camera = rotateSceneAroundX({ direction: [0, 0, 1], up: [0, 1, 0] }, -Math.PI / 2);
    expectClose(camera.direction, [0, -1, 0]);
    expectClose(camera.up, [0, 0, 1]);
  });

  it('makes the up direction perpendicular to the view direction', () => {
    const orientation = cameraToNglOrientation({
      target: [0, 0, 0],
      direction: [0, 0, 2],
      up: [0, 1, 1],
      distance: 10,
    });
    const camera = nglOrientationToCamera(orientation);
    expectClose(camera.direction, [0, 0, 1]);
    expectClose(camera.up, [0, 1, 0]);
  });
});
