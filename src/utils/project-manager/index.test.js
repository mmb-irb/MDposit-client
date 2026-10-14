import { renderHook, act } from '@testing-library/react';

import useAPI from '../../hooks/use-api';
import { Project } from '.';

// Replace useAPI with a fake whose response the test sets
jest.mock('../../hooks/use-api', () => ({ __esModule: true, default: jest.fn() }));
// NGL is not needed to check problems and it does not load in jsdom
jest.mock('ngl', () => ({ autoLoad: jest.fn() }));
// The topology manager is not needed either and it uses Set methods missing in jsdom
jest.mock('../topology-manager', () => ({ Topology: jest.fn() }));
// Problems are only checked in the global client
jest.mock('../constants', () => {
  const actual = jest.requireActual('../constants');
  return { ...actual, HOST_CONFIG: { ...actual.HOST_CONFIG, global: true } };
});

const loading = { loading: true };
const answered = { loading: false, payload: { atom_names: [] }, error: null };

// The response every useAPI call returns, changed by the tests
let apiResponse;

beforeEach(() => {
  jest.useFakeTimers();
  apiResponse = loading;
  useAPI.mockReset();
  useAPI.mockImplementation(() => apiResponse);
});

afterEach(() => {
  jest.useRealTimers();
});

const newProject = () => new Project({
  accession: 'TEST1', mds: ['replica 1'], mdNumber: 1, metadata: {}, analyses: [],
});

// Render checkProblems as a hook, the way the accession page uses it
const renderCheck = () => {
  const project = newProject();
  return renderHook(() => project.checkProblems());
};

// Let time pass and let React process the timer updates
const wait = ms => act(() => { jest.advanceTimersByTime(ms); });

describe('Project.checkProblems', () => {
  it('asks for the topology without a timeout, since this request is shared with the real topology loads', () => {
    renderCheck();
    expect(useAPI).toHaveBeenCalled();
    const [url, , timeout] = useAPI.mock.calls[0];
    expect(url).toMatch(/\/projects\/TEST1\.1\/topology$/);
    expect(timeout).toBeFalsy();
  });

  it('reports no problem while the node has been answering for less than 5 seconds', () => {
    const { result } = renderCheck();
    wait(4900);
    expect(result.current).toBeUndefined();
  });

  it('reports the node as not responding when it takes more than 5 seconds', () => {
    const { result } = renderCheck();
    wait(5100);
    expect(result.current).toEqual(expect.objectContaining({ noResponse: true }));
  });

  it('stops reporting the problem when the slow node finally answers', () => {
    const { result, rerender } = renderCheck();
    wait(5100);
    expect(result.current).toEqual(expect.objectContaining({ noResponse: true }));
    apiResponse = answered;
    rerender();
    expect(result.current).toBeUndefined();
  });

  it('reports no problem when the node answers in time', () => {
    const { result, rerender } = renderCheck();
    wait(1000);
    apiResponse = answered;
    rerender();
    wait(10000);
    expect(result.current).toBeUndefined();
  });

  it('reports the error when the node answers with an error', () => {
    const { result, rerender } = renderCheck();
    const error = { message: 'Not found', response: { status: 404, data: 'Not found' } };
    apiResponse = { loading: false, payload: null, error };
    rerender();
    expect(result.current).toBe(error);
  });
});
