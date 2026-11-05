import React from 'react';
import { EventEmitter } from 'events';
import { renderHook, act } from '@testing-library/react';

import { ProjectCtx } from '../../contexts';
import useViewerData from '.';

// Replace the Node-style http clients with a controllable fake
// Every request stays pending until the test answers it or makes it fail
// As in the real clients, an 'error' event with no listener throws
vi.mock('stream-http', () => {
  const request = (...args) => global.fakeRequest(...args);
  return { request, default: { request } };
});
vi.mock('https-browserify', () => {
  const request = (...args) => global.fakeRequest(...args);
  return { request, default: { request } };
});

// Pending fake requests, in the order they were sent
let requests;

beforeEach(() => {
  requests = [];
  global.fakeRequest = (options, onResponse) => {
    const request = new EventEmitter();
    request.path = options.path;
    request.onResponse = onResponse;
    request.write = vi.fn();
    request.end = vi.fn();
    request.abort = vi.fn();
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
  fileDescriptors: {
    loading: false,
    payload: [{ filename: 'trajectory.bin', metadata: { frames: FRAMES, atoms: ATOMS } }],
  },
};

// Same default components as the viewer: the structure and the trajectory from the API
const components = [{ topologyURL: '/structure', trajectoryURLs: ['/trajectory'] }];

const renderViewerData = (onRender, viewerComponents = components) => {
  const wrapper = ({ children }) => (
    <ProjectCtx.Provider value={project}>{children}</ProjectCtx.Provider>
  );
  return renderHook(() => {
    const data = useViewerData(viewerComponents, FRAMES, () => {});
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

describe('useViewerData trajectory format', () => {
  // The API returns xtc by default since v2, which the viewers would read as coordinates
  it('asks the trajectory endpoint for the binary format', () => {
    renderViewerData();
    const query = new URLSearchParams(findRequest('/trajectory').path.split('?')[1]);
    expect(query.get('format')).toBe('bin');
    expect(query.get('frames')).toBe(`1:${FRAMES}:1`);
  });

  // The files endpoint rejects any format argument with a 400 error
  it('does not send a format when requesting a trajectory file', () => {
    const pcaProject = {
      ...project,
      fileDescriptors: {
        loading: false,
        payload: [{ filename: 'pca_trajectory_01.bin', metadata: { frames: FRAMES, atoms: ATOMS } }],
      },
    };
    const wrapper = ({ children }) => (
      <ProjectCtx.Provider value={pcaProject}>{children}</ProjectCtx.Provider>
    );
    const pcaComponents = [{ topologyURL: '/structure', trajectoryURLs: ['/files/pca_trajectory_01.bin'] }];
    renderHook(() => useViewerData(pcaComponents, FRAMES, () => {}), { wrapper });
    expect(findRequest('/files/pca_trajectory_01.bin').path).not.toMatch(/format=/);
  });
});

describe('useViewerData full structure', () => {
  // Reading Project's structureData getter used to start a GET of the full structure (74 MB for A05PJ)
  // that the viewer never used, since it downloads its own structure through the POST
  it('does not read the full project structure', async () => {
    let structureDataRead = false;
    const projectWithGetter = {
      ...project,
      get structureData () {
        structureDataRead = true;
        return 'MAIN STRUCTURE';
      },
    };
    const wrapper = ({ children }) => (
      <ProjectCtx.Provider value={projectWithGetter}>{children}</ProjectCtx.Provider>
    );
    renderHook(() => useViewerData(components, FRAMES, () => {}), { wrapper });
    await respond(findRequest('/structure'), 200, textBody('ATOM  1'));
    expect(structureDataRead).toBe(false);
  });
});

// The POST body sent in a fake request
const requestBody = request => JSON.parse(request.write.mock.calls[0][0]);

// Components sharing the same topology, as the two frames in the RMSD pairwise viewer
const sharedTopologyComponents = (atomIndicesA, atomIndicesB) => [
  { name: 'Frame A', topologyURL: '/structure', trajectoryURLs: ['/trajectory'], frame: 0, atomIndices: atomIndicesA },
  { name: 'Frame B', topologyURL: '/structure', trajectoryURLs: ['/trajectory'], frame: 1, atomIndices: atomIndicesB },
];

describe('useViewerData atom subsets', () => {
  it('requests every trajectory with the atom subset of its topology', async () => {
    renderViewerData(null, sharedTopologyComponents([1, 0], [0, 1]));
    expect(requests.filter(request => request.path.includes('/structure'))).toHaveLength(1);
    expect(requestBody(findRequest('/structure')).atomindices).toEqual([0, 1]);
    const trajectoryRequests = requests.filter(request => request.path.includes('/trajectory'));
    expect(trajectoryRequests.map(request => request.path.split('/').pop()))
      .toEqual(['trajectory?frames=1&format=bin', 'trajectory?frames=2&format=bin']);
    expect(trajectoryRequests.map(request => requestBody(request).atomindices)).toEqual([[0, 1], [0, 1]]);
  });

  it('fails when a component atom subset does not match its topology', () => {
    // Only the first component sets the topology atom subset, so the second would get whole system frames
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderViewerData(null, sharedTopologyComponents([0, 1], undefined)))
      .toThrow('Atom subset of component "Frame B" does not match its topology');
    console.error.mockRestore();
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
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

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
    act(() => { vi.advanceTimersByTime(300); });
    await stream.send(body.subarray(8, 12));
    expect(result.current.trajectories[0].progress).toBe(12 / body.length);
    // Still no whole frame for the viewers
    expect(Math.floor(result.current.trajectories[0].loadedBytes / BYTES_PER_FRAME)).toBe(0);
  });
});

describe('useViewerData framed trajectories', () => {
  // A longer trajectory, so frame ranges which do not start at the first frame make sense
  const longProject = {
    ...project,
    fileDescriptors: {
      loading: false,
      payload: [{ filename: 'trajectory.bin', metadata: { frames: 600, atoms: ATOMS } }],
    },
  };
  // Get the frames the viewer expects for the given framed trajectory urlpath
  const expectedFrames = urlpath => {
    const wrapper = ({ children }) => (
      <ProjectCtx.Provider value={longProject}>{children}</ProjectCtx.Provider>
    );
    // Set the components once, since a new array every render would trigger the download effects endlessly
    const framedComponents = [{ topologyURL: '/structure', trajectoryURLs: [urlpath] }];
    const { result } = renderHook(() => useViewerData(framedComponents, FRAMES, () => {}), { wrapper });
    return respond(findRequest('/trajectory'), 200, trajectoryBody())
      .then(() => result.current.trajectories[0].frames);
  };

  // e.g. a cluster transition, which used to expect 511 frames and thus broke the progress bar
  it('expects the frames in a range which does not start at the first frame', async () => {
    expect(await expectedFrames('/trajectory?frames=501:511:1')).toBe(11);
  });

  it('expects the frames in a stepped range which does not start at the first frame', async () => {
    expect(await expectedFrames('/trajectory?frames=101:200:10')).toBe(10);
  });

  it('expects the frames in a stepped range from the first frame', async () => {
    expect(await expectedFrames('/trajectory?frames=1:600:10')).toBe(60);
  });

  it('expects no frames beyond the end of the trajectory', async () => {
    expect(await expectedFrames('/trajectory?frames=591:700:1')).toBe(10);
  });
});
