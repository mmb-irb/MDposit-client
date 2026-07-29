// Playback speed mapping shared by both 3D viewer backends (NGL and molstar)
// It lives here, rather than in either viewer, because the 'speed' slider is a single control in
// ViewerWithControls whose value is handed to whichever backend is active. If the two backends
// interpreted it differently then the same slider position would play at different rates depending
// on which viewer you happened to have selected

// Frame rates the slider maps onto, at its two ends
// These are what is *requested*, not a promise: a large system whose per-frame cost exceeds the
// budget will simply play slower than asked. molstar passes the rate as its animation's maxFps,
// NGL reaches it via the per-frame timeout below
export const MINIMUM_PLAYER_FPS = 1;
export const MAXIMUM_PLAYER_FPS = 60;

// The 'speed' slider's own range
const MINIMUM_SPEED = 0;
const MAXIMUM_SPEED = 100;

// Turn a 0-100 slider value into the frame rate it is asking for
// Deliberately linear in frame rate rather than in the timeout below: interpolating the timeout
// instead would bunch every usable frame rate into the last few percent of the slider's travel
// (with a 60 fps maximum, the whole 20-60 range would live above slider 98)
export const speedToFps = currentSpeed => (
  MINIMUM_PLAYER_FPS + (currentSpeed - MINIMUM_SPEED) *
  ((MAXIMUM_PLAYER_FPS - MINIMUM_PLAYER_FPS) / (MAXIMUM_SPEED - MINIMUM_SPEED))
);

// Both backends drive playback off a timeout: the time to wait before advancing a frame, in ms
export const interpolateSpeed = currentSpeed => 1000 / speedToFps(currentSpeed);
