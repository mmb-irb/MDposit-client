import { renderHook, act } from '@testing-library/react';
import axios from 'axios';

import useAPI from '.';

// Replace axios with a controllable fake
// Every request stays pending until the test resolves it, and cancelling it rejects it like axios does
jest.mock('axios', () => {
  const fakeAxios = jest.fn();
  fakeAxios.CancelToken = { source: jest.fn() };
  fakeAxios.isCancel = error => Boolean(error && error.__CANCEL__);
  return { __esModule: true, default: fakeAxios };
});

// Pending fake requests, in the order they were sent
let requests;

beforeEach(() => {
  requests = [];
  axios.CancelToken.source.mockImplementation(() => {
    const token = {};
    return { token, cancel: jest.fn(() => token.reject && token.reject({ __CANCEL__: true })) };
  });
  axios.mockImplementation((url, options) => new Promise((resolve, reject) => {
    const request = { url, resolve, reject, cancelled: false };
    options.cancelToken.reject = error => {
      request.cancelled = true;
      reject(error);
    };
    requests.push(request);
  }));
});

// The hook keeps a module-level map of shared requests, so every test uses its own URL
let urlCount = 0;
const newUrl = () => `https://api.test/resource/${(urlCount += 1)}`;

// Resolve a pending fake request and let React process the state updates
const respond = async (request, data) => {
  await act(async () => {
    request.resolve({ data, config: { startTime: new Date() } });
  });
};

// Reject a pending fake request the way axios does and let React process the state updates
const fail = async (request, error) => {
  await act(async () => {
    request.reject(error);
  });
};
const networkError = () => ({ message: 'Network Error' });
const timeoutError = () => ({ message: 'timeout of 5000ms exceeded', code: 'ECONNABORTED' });
const httpError = status => ({
  message: `Request failed with status code ${status}`,
  response: { status, data: 'server says no' },
});

describe('useAPI errors', () => {
  it('tells the waiting component about the error', async () => {
    const url = newUrl();
    const { result } = renderHook(() => useAPI(url));
    await fail(requests[0], networkError());
    expect(result.current.loading).toBe(false);
    expect(result.current.error.noResponse).toBe(true);
  });

  it.each([
    ['a network error', networkError],
    ['a timeout', timeoutError],
    ['a 500 server error', () => httpError(500)],
    ['a 503 server error', () => httpError(503)],
  ])('retries the next time the URL is asked for after %s', async (_, makeError) => {
    const url = newUrl();
    const firstVisit = renderHook(() => useAPI(url));
    await fail(requests[0], makeError());
    expect(firstVisit.result.current.error).toBeTruthy();
    firstVisit.unmount();
    const secondVisit = renderHook(() => useAPI(url));
    expect(requests).toHaveLength(2);
    await respond(requests[1], 'recovered');
    expect(secondVisit.result.current).toMatchObject({ loading: false, payload: 'recovered', error: null });
  });

  it('keeps a 404 so it is not requested again by every component', async () => {
    // e.g. mem-map answers 404 for every system without a membrane
    const url = newUrl();
    const first = renderHook(() => useAPI(url));
    await fail(requests[0], httpError(404));
    const second = renderHook(() => useAPI(url));
    expect(requests).toHaveLength(1);
    expect(second.result.current.error.response.status).toBe(404);
  });
});

describe('useAPI', () => {
  it('shares one request between components asking for the same URL', async () => {
    const url = newUrl();
    const first = renderHook(() => useAPI(url));
    const second = renderHook(() => useAPI(url));
    expect(requests).toHaveLength(1);
    await respond(requests[0], 'shared');
    expect(first.result.current.payload).toBe('shared');
    expect(second.result.current.payload).toBe('shared');
  });

  it('still delivers the response when the component that started the request unmounts', async () => {
    const url = newUrl();
    const first = renderHook(() => useAPI(url));
    const second = renderHook(() => useAPI(url));
    first.unmount();
    expect(requests[0].cancelled).toBe(false);
    await respond(requests[0], 'still here');
    expect(second.result.current).toMatchObject({ loading: false, payload: 'still here' });
  });

  it('cancels the request only when the last waiting component unmounts', () => {
    const url = newUrl();
    const first = renderHook(() => useAPI(url));
    const second = renderHook(() => useAPI(url));
    first.unmount();
    expect(requests[0].cancelled).toBe(false);
    second.unmount();
    expect(requests[0].cancelled).toBe(true);
  });

  it('sends a new request when a URL is asked for again after its request was cancelled', async () => {
    // Open an entry, leave before the data arrives, open it again
    const url = newUrl();
    const firstVisit = renderHook(() => useAPI(url));
    firstVisit.unmount();
    const secondVisit = renderHook(() => useAPI(url));
    expect(requests).toHaveLength(2);
    await respond(requests[1], 'fresh');
    expect(secondVisit.result.current).toMatchObject({ loading: false, payload: 'fresh' });
  });

  it('reuses a finished response without sending a new request', async () => {
    const url = newUrl();
    const firstVisit = renderHook(() => useAPI(url));
    await respond(requests[0], 'done');
    firstVisit.unmount();
    const secondVisit = renderHook(() => useAPI(url));
    expect(requests).toHaveLength(1);
    expect(secondVisit.result.current.payload).toBe('done');
  });
});
