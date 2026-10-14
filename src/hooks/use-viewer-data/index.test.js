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

const renderViewerData = () => {
  const wrapper = ({ children }) => (
    <ProjectCtx.Provider value={project}>{children}</ProjectCtx.Provider>
  );
  return renderHook(() => useViewerData(components, FRAMES, () => {}), { wrapper });
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
