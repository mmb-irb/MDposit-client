import { register } from './serviceWorker';

// Service workers only register in production
vi.mock('./utils/constants', () => ({ HOST_CONFIG: { production: true } }));

// The registration the fake browser hands back, and the 'sw' events the page sent
let registration;
let swEvents;
const onSw = event => swEvents.push(event.detail);
const originalLocation = window.location;

beforeEach(() => {
  swEvents = [];
  window.addEventListener('sw', onSw);
  // jsdom does not let us spy on location.reload, so replace the whole location
  delete window.location;
  window.location = {
    href: 'http://localhost/',
    origin: 'http://localhost',
    hostname: 'localhost',
    reload: vi.fn(),
    toString: () => 'http://localhost/',
  };
  // Fake browser service worker API
  registration = {};
  navigator.serviceWorker = {
    controller: null,
    register: vi.fn(() => Promise.resolve(registration)),
    ready: new Promise(() => {}),
  };
  // Real browsers have this (deprecated) API, jsdom does not
  Object.defineProperty(window.performance, 'timing', {
    value: { navigationStart: Date.now() - 60000 },
    configurable: true,
  });
  // On localhost, register() first checks that sw.js exists
  global.fetch = vi.fn(() => Promise.resolve({
    status: 200,
    headers: { get: () => 'application/javascript' },
  }));
});

afterEach(() => {
  window.removeEventListener('sw', onSw);
  window.location = originalLocation;
  delete navigator.serviceWorker;
  delete global.fetch;
  delete window.performance.timing;
});

// Register, then let the browser install a new service worker
const registerAndInstall = async config => {
  register(config);
  window.dispatchEvent(new Event('load'));
  // Let the sw.js check and the registration promise resolve
  await new Promise(resolve => setTimeout(resolve, 0));
  registration.installing = { state: 'installing' };
  registration.onupdatefound();
  registration.installing.state = 'installed';
  registration.installing.onstatechange();
};

describe('serviceWorker register', () => {
  it('does not reload the page when a new version is installed', async () => {
    // A controller means an older version is already running this page
    navigator.serviceWorker.controller = {};
    const onUpdate = vi.fn();
    await registerAndInstall({ onUpdate });
    expect(window.location.reload).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith(registration);
    // The new version is picked up on the next reload, with no popup
    expect(swEvents).toEqual([]);
  });

  it('announces the first install as available offline', async () => {
    const onSuccess = vi.fn();
    await registerAndInstall({ onSuccess });
    expect(window.location.reload).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(registration);
    expect(swEvents).toEqual(['install']);
  });
});
