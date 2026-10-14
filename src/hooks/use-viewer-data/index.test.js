import React from 'react';
import { EventEmitter } from 'events';
import { renderHook, act } from '@testing-library/react';

import { ProjectCtx } from '../../contexts';
import useViewerData from '.';

// Replace the Node-style http clients with a controllable fake
// Every request stays pending until the test answers it or makes it fail
// As in the real clients, an 'error' event with no listener throws
jest.mock('stream-http', () => ({ request: (...args) => global.fakeRequest(...args) }));
jest.mock('https-browserify', () => ({ request: (...args) => global.fakeRequest(...args) }));

// Pending fake requests, in the order they were sent
let requests;

beforeEach(() => {
  requests = [];
  global.fakeRequest = (options, onResponse) => {
    const request = new EventEmitter();
    request.path = options.path;
    request.onResponse = onResponse;
    request.write = jest.fn();
    request.end = jest.fn();
    request.abort = jest.fn();
    requests.push(request);
    return request;
  };
});

const findRequest = endpoint => requests.find(request => request.path.split('?')[0].endsWith(endpoint));

// Answer a pending fake request with a status and a body and let React process the state updates
const respond = async (request, statusCode, body) => {
  await act(async () => {
    const response = new EventEmitter();
    response.statusCode = statusCode;
    response.headers = { 'content-length': String(body.byteLength) };
    request.onResponse(response);
    response.emit('data', body);
    response.emit('end');
  });
};

// Make a pending fake request fail with a network error and let React process the state updates
const fail = async request => {
  await act(async () => {
    request.emit('error', new TypeError('Failed to fetch'));
  });
};

// A trajectory of 2 atoms and 2 frames: 2 atoms x 2 frames x 3 coordinates x 4 bytes
const ATOMS = 2;
const FRAMES = 2;
const trajectoryBody = () => Buffer.from(new Float32Array(ATOMS * FRAMES * 3).fill(1).buffer);
const textBody = text => Buffer.from(text);

const project = {
  accessionAndMdNumber: 'A0001.1',
  structureData: 'MAIN STRUCTURE',
  fileDescriptors: {
    loading: false,
    payload: [{ filename: 'trajectory.bin', metadata: { frames: FRAMES, atoms: ATOMS } }],
  },
};

// Same default components as the viewer: the structure and the trajectory from the API
const components = [{ topologyURL: '/structure', trajectoryURLs: ['/trajectory'] }];

const renderViewerData = onRender => {
  const wrapper = ({ children }) => (
    <ProjectCtx.Provider value={project}>{children}</ProjectCtx.Provider>
  );
  return renderHook(() => {
    const data = useViewerData(components, FRAMES, () => {});
    if (onRender) onRender(data);
    return data;
  }, { wrapper });
};

describe('useViewerData downloads', () => {
  it('stores the downloaded structure and trajectory', async () => {
    const { result } = renderViewerData();
    await respond(findRequest('/structure'), 200, textBody('ATOM  1'));
    await respond(findRequest('/trajectory'), 200, trajectoryBody());
    expect(result.current.topologies.map(topology => topology.file)).toEqual(['ATOM  1']);
    expect(result.current.trajectories[0].payload.byteLength).toBe(ATOMS * FRAMES * 3 * 4);
    expect(result.current.anyLoadingTopology).toBe(false);
    expect(result.current.anyLoadingTrajectory).toBe(false);
    expect(result.current.downloadError).toBe(null);
  });
});

describe('useViewerData download errors', () => {
  it('stops loading and reports a network error on the structure', async () => {
    const { result } = renderViewerData();
    await fail(findRequest('/structure'));
    expect(result.current.anyLoadingTopology).toBe(false);
    expect(result.current.topologies).toEqual([]);
    expect(result.current.downloadError).toMatch(/structure.*Failed to fetch/);
  });

  it('does not use an HTTP error body as the structure', async () => {
    const { result } = renderViewerData();
    await respond(findRequest('/structure'), 404, textBody('"Project A0001.1 was not found"'));
    expect(result.current.anyLoadingTopology).toBe(false);
    expect(result.current.topologies).toEqual([]);
    expect(result.current.downloadError).toMatch(/structure.*404/);
  });

  it('stops loading and reports a network error on the trajectory', async () => {
    const { result } = renderViewerData();
    await respond(findRequest('/structure'), 200, textBody('ATOM  1'));
    await fail(findRequest('/trajectory'));
    expect(result.current.anyLoadingTrajectory).toBe(false);
    expect(result.current.trajectories).toEqual([]);
    expect(result.current.downloadError).toMatch(/trajectory.*Failed to fetch/);
  });

  it('does not use an HTTP error body as trajectory coordinates', async () => {
    const { result } = renderViewerData();
    await respond(findRequest('/structure'), 200, textBody('ATOM  1'));
    await respond(findRequest('/trajectory'), 500, textBody('Internal Server Error'));
    expect(result.current.anyLoadingTrajectory).toBe(false);
    expect(result.current.trajectories).toEqual([]);
    expect(result.current.downloadError).toMatch(/trajectory.*500/);
    // The structure is still there, so the viewer can show it without the trajectory
    expect(result.current.topologies.map(topology => topology.file)).toEqual(['ATOM  1']);
  });
});

// Start answering a pending fake request and return a function which sends the body chunk by chunk
// Every chunk goes in its own act, as network chunks arrive in different tasks
const startResponse = async (request, totalBytes) => {
  const response = new EventEmitter();
  response.statusCode = 200;
  response.headers = totalBytes === undefined ? {} : { 'content-length': String(totalBytes) };
  await act(async () => request.onResponse(response));
  return {
    send: async chunk => act(async () => { response.emit('data', chunk); }),
    end: async () => act(async () => { response.emit('end'); }),
  };
};

// Trajectory coordinates with a different value each, so the order of the bytes can be checked
const BYTES_PER_FRAME = ATOMS * 3 * 4;
const orderedBody = () => Buffer.from(new Float32Array(ATOMS * FRAMES * 3).map((v, i) => i + 1).buffer);
const chunksOf = (body, size) => {
  const chunks = [];
  for (let start = 0; start < body.length; start += size) chunks.push(body.subarray(start, start + size));
  return chunks;
};

// Bytes the viewers may read from a published trajectory
const loadedData = trajectory => Buffer.from(trajectory.payload, 0, trajectory.loadedBytes);

describe('useViewerData trajectory streaming', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps the coordinates in order when they arrive in many chunks', async () => {
    const { result } = renderViewerData();
    await respond(findRequest('/structure'), 200, textBody('ATOM  1'));
    const body = orderedBody();
    const stream = await startResponse(findRequest('/trajectory'), body.length);
    for (const chunk of chunksOf(body, 5)) await stream.send(chunk);
    await stream.end();
    const [trajectory] = result.current.trajectories;
    expect(trajectory.loadedBytes).toBe(body.length);
    expect(loadedData(trajectory)).toEqual(body);
    expect(trajectory.progress).toBe(1);
    expect(result.current.anyLoadingTrajectory).toBe(false);
  });

  it('keeps the coordinates in order without a Content-Length header', async () => {
    const { result } = renderViewerData();
    await respond(findRequest('/structure'), 200, textBody('ATOM  1'));
    const body = orderedBody();
    const stream = await startResponse(findRequest('/trajectory'), undefined);
    for (const chunk of chunksOf(body, 5)) await stream.send(chunk);
    await stream.end();
    expect(loadedData(result.current.trajectories[0])).toEqual(body);
  });

  it('makes each whole frame available as soon as it arrives', async () => {
    const { result } = renderViewerData();
    await respond(findRequest('/structure'), 200, textBody('ATOM  1'));
    const body = orderedBody();
    const stream = await startResponse(findRequest('/trajectory'), body.length);
    for (const chunk of chunksOf(body.subarray(0, BYTES_PER_FRAME), 5)) await stream.send(chunk);
    // The first frame is complete while the second one is still downloading
    const [trajectory] = result.current.trajectories;
    expect(Math.floor(trajectory.loadedBytes / BYTES_PER_FRAME)).toBe(1);
    expect(loadedData(trajectory).subarray(0, BYTES_PER_FRAME)).toEqual(body.subarray(0, BYTES_PER_FRAME));
  });

  it('publishes the trajectory once per whole frame, not once per chunk', async () => {
    let publications = 0;
    let lastTrajectories;
    const { result } = renderViewerData(data => {
      if (data.trajectories.length > 0 && data.trajectories !== lastTrajectories) publications++;
      lastTrajectories = data.trajectories;
    });
    await respond(findRequest('/structure'), 200, textBody('ATOM  1'));
    const body = orderedBody();
    const stream = await startResponse(findRequest('/trajectory'), body.length);
    // One byte per chunk: 48 chunks
    for (const chunk of chunksOf(body, 1)) await stream.send(chunk);
    await stream.end();
    expect(loadedData(result.current.trajectories[0])).toEqual(body);
    // The empty trajectory, one publication per frame and the final one
    expect(publications).toBeLessThanOrEqual(1 + FRAMES + 1);
  });

  it('updates the progress between frames at most every 250 ms', async () => {
    const { result } = renderViewerData();
    await respond(findRequest('/structure'), 200, textBody('ATOM  1'));
    const body = orderedBody();
    const stream = await startResponse(findRequest('/trajectory'), body.length);
    await stream.send(body.subarray(0, 4));
    await stream.send(body.subarray(4, 8));
    // Less than a frame and no time has passed: the progress may not be published yet
    const earlyProgress = result.current.trajectories[0].progress;
    expect(earlyProgress).toBeLessThan(8 / body.length);
    act(() => { jest.advanceTimersByTime(300); });
    await stream.send(body.subarray(8, 12));
    expect(result.current.trajectories[0].progress).toBe(12 / body.length);
    // Still no whole frame for the viewers
    expect(Math.floor(result.current.trajectories[0].loadedBytes / BYTES_PER_FRAME)).toBe(0);
  });
});
