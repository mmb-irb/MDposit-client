// Conversions between NGL orientation matrices and camera directions
// NGL orientations are what the ORIENTATION metadata field stores (see ViewerControls.getOrientation in NGL)
// Their 16 values are a column-major matrix holding:
//   - the scene rotation, with every column scaled by the camera distance
//   - the scene translation, which is the opposite of the point the camera looks at
// NGL rotates the scene instead of the camera, which stays on the -Z axis looking at the origin with Y up

const length = vector => Math.hypot(...vector);
const scale = (vector, factor) => vector.map(value => value * factor);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// Get the camera target, distance and the directions it looks and points up, in model coordinates
// These directions are the view (Z) and up (Y) axes rotated back to the model frame, i.e. rotation rows
export const nglOrientationToCamera = orientation => {
  const distance = length(orientation.slice(0, 3));
  return {
    target: [-orientation[12], -orientation[13], -orientation[14]],
    distance,
    direction: scale([orientation[2], orientation[6], orientation[10]], 1 / distance),
    up: scale([orientation[1], orientation[5], orientation[9]], 1 / distance),
  };
};

// Get the NGL orientation matrix of a camera, the inverse of the function above
export const cameraToNglOrientation = ({ target, distance, direction, up }) => {
  // Make the directions unit vectors, and the up direction perpendicular to the view direction
  const z = scale(direction, 1 / length(direction));
  const upInPlane = up.map((value, i) => value - dot(up, z) * z[i]);
  const y = scale(upInPlane, 1 / length(upInPlane));
  const x = cross(y, z);
  const rows = [x, y, z];
  const orientation = new Array(16).fill(0);
  for (let column = 0; column < 3; column++)
    for (let row = 0; row < 3; row++)
      orientation[column * 4 + row] = rows[row][column] * distance;
  orientation[12] = -target[0];
  orientation[13] = -target[1];
  orientation[14] = -target[2];
  orientation[15] = 1;
  return orientation;
};
