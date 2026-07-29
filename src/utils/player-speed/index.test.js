import {
  MAXIMUM_PLAYER_FPS,
  MINIMUM_PLAYER_FPS,
  interpolateSpeed,
  speedToFps,
} from '.';

describe('speedToFps', () => {
  it('should map the slider ends onto the frame rate limits', () => {
    expect(speedToFps(0)).toBe(MINIMUM_PLAYER_FPS);
    expect(speedToFps(100)).toBe(MAXIMUM_PLAYER_FPS);
  });

  // The point of being linear in frame rate: the middle of the slider is the middle of the range,
  // rather than the ~2 fps that interpolating the timeout would give
  it('should put the middle of the range at the middle of the slider', () => {
    expect(speedToFps(50)).toBeCloseTo((MINIMUM_PLAYER_FPS + MAXIMUM_PLAYER_FPS) / 2);
  });

  it('should increase monotonically across the slider', () => {
    for (let speed = 1; speed <= 100; speed++) {
      expect(speedToFps(speed)).toBeGreaterThan(speedToFps(speed - 1));
    }
  });
});

describe('interpolateSpeed', () => {
  it('should give the per-frame timeout, in milliseconds, for that frame rate', () => {
    expect(interpolateSpeed(0)).toBeCloseTo(1000);
    expect(interpolateSpeed(100)).toBeCloseTo(1000 / MAXIMUM_PLAYER_FPS);
  });

  // Faster playback means a shorter wait, so this runs opposite to speedToFps
  it('should decrease monotonically across the slider', () => {
    for (let speed = 1; speed <= 100; speed++) {
      expect(interpolateSpeed(speed)).toBeLessThan(interpolateSpeed(speed - 1));
    }
  });
});
