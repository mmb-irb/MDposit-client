// Playback speed mapping shared by both 3D viewer backends (NGL and molstar)
// It lives here, rather than in either viewer, because the 'speed' slider is a single control in
// ViewerWithControls whose value is handed to whichever backend is active. If the two backends
// interpreted it differently then the same slider position would play at different rates depending
// on which viewer you happened to have selected

// Highest frame rate the slider can ask for, at its maximum
// Both backends cap out here: molstar passes it as its animation's maxFps, and NGL reaches it via
// the per-frame timeout below. Note this is a ceiling on what is *requested*, not a promise - a
// large system whose per-frame cost exceeds the budget will simply play slower
export const MAXIMUM_PLAYER_FPS = 60;

// The 'speed' slider's own range
const MINIMUM_SPEED = 0;
const MAXIMUM_SPEED = 100;

// Both backends drive playback off a timeout: the time to wait before advancing a frame, in ms
const SLOWEST_TIMEOUT = 1000; // 1 fps
const FASTEST_TIMEOUT = 1000 / MAXIMUM_PLAYER_FPS;

// Turn a 0-100 slider value into that per-frame timeout
// The interpolation is linear in the timeout, so the frame rate it produces is not linear in the
// slider position: most of the travel covers the slow end, and the high frame rates are bunched up
// near the maximum
export const interpolateSpeed = currentSpeed => (
  SLOWEST_TIMEOUT + (currentSpeed - MINIMUM_SPEED) *
  ((FASTEST_TIMEOUT - SLOWEST_TIMEOUT) / (MAXIMUM_SPEED - MINIMUM_SPEED))
);
