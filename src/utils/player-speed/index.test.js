import {
  MAXIMUM_PLAYER_FPS,
  MINIMUM_PLAYER_FPS,
  interpolateSpeed,
  speedToFps,
} from '.';

describe('speedToFps', () => {
  it('should map the slider ends onto the frame rate limits', () => {
    expect(speedToFps(0)).toBeCloseTo(MINIMUM_PLAYER_FPS);
    expect(speedToFps(100)).toBeCloseTo(MAXIMUM_PLAYER_FPS);
  });

  // The defining property of the logarithmic mapping: the middle of the slider lands on the
  // geometric mean rather than the arithmetic one, i.e. 10 fps between 1 and 100 rather than 50
  it('should put the geometric mean of the limits at the middle of the slider', () => {
    expect(speedToFps(50)).toBeCloseTo(
      Math.sqrt(MINIMUM_PLAYER_FPS * MAXIMUM_PLAYER_FPS),
    );
    expect(speedToFps(50)).toBeCloseTo(10);
  });

  // Equal steps of the slider multiply the frame rate by an equal factor
  it('should scale by a constant factor per equal slider step', () => {
    const factor = speedToFps(25) / speedToFps(0);
    for (const speed of [25, 50, 75]) {
      expect(speedToFps(speed + 25) / speedToFps(speed)).toBeCloseTo(factor);
    }
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
    expect(interpolateSpeed(50)).toBeCloseTo(100);
    expect(interpolateSpeed(100)).toBeCloseTo(1000 / MAXIMUM_PLAYER_FPS);
  });

  // Faster playback means a shorter wait, so this runs opposite to speedToFps
  it('should decrease monotonically across the slider', () => {
    for (let speed = 1; speed <= 100; speed++) {
      expect(interpolateSpeed(speed)).toBeLessThan(interpolateSpeed(speed - 1));
    }
  });
});
