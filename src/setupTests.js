import '@testing-library/jest-dom';

import { TextEncoder, TextDecoder } from 'util';
import { toMatchImageSnapshot } from 'jest-image-snapshot';

expect.extend({ toMatchImageSnapshot });

// jsdom 16 does not implement TextEncoder/TextDecoder, which react-router 7 uses at import time
if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// jsdom does not implement matchMedia
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
  });
}
