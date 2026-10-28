// Playback speed mapping shared by both 3D viewer backends (NGL and molstar)
// It lives here, rather than in either viewer, because the 'speed' slider is a single control in
// ViewerWithControls whose value is handed to whichever backend is active. If the two backends
// interpreted it differently then the same slider position would play at different rates depending
// on which viewer you happened to have selected

// Frame rates the slider maps onto, at its two ends
// These are what is *requested*, not a promise: a large system whose per-frame cost exceeds the
// budget will simply play slower than asked. molstar passes the rate as its animation's maxFps,
// NGL reaches it via the per-frame timeout below
// The maximum is deliberately above any common display refresh rate: both backends are driven by
// requestAnimationFrame, so asking for more than the screen can show simply means 'as fast as this
// system manages'
export const MINIMUM_PLAYER_FPS = 1;
export const MAXIMUM_PLAYER_FPS = 100;

// The 'speed' slider's own range
const MINIMUM_SPEED = 0;
const MAXIMUM_SPEED = 100;

// Turn a 0-100 slider value into the frame rate it is asking for
// Logarithmic (each step of the slider multiplies the frame rate rather than adding to it), because
// the useful range spans two orders of magnitude and what matters at the slow end is a difference of
// a frame or two per second, while at the fast end it is tens. Interpolating linearly in either the
// frame rate or the timeout leaves most of the travel useless: linear-in-fps gives no fine control
// below ~10 fps, and linear-in-timeout crams everything above 15 fps into the last few percent
// The midpoint of the slider therefore lands on the geometric mean of the two limits - with 1 and
// 100 fps as the ends, slider 50 asks for 10
export const speedToFps = currentSpeed => {
  const fraction = (currentSpeed - MINIMUM_SPEED) / (MAXIMUM_SPEED - MINIMUM_SPEED);
  return MINIMUM_PLAYER_FPS *
    Math.pow(MAXIMUM_PLAYER_FPS / MINIMUM_PLAYER_FPS, fraction);
};

// The NGL viewer drives playback off a timeout: the time to wait before advancing a frame, in ms
export const interpolateSpeed = currentSpeed => 1000 / speedToFps(currentSpeed);
