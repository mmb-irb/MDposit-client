import React from 'react';
import { render } from '@testing-library/react';

import { ProjectCtx } from '../../contexts';
import { installFakeWebGL, installFrameQueue } from './test-utils';

// jsdom has no IntersectionObserver
jest.mock('react-intersection-observer', () => ({ useInView: () => [() => {}, false] }));

const NGLViewer = require('.').default;

const renderViewer = () =>
  render(
    <ProjectCtx.Provider value={{ metadata: {}, topology: undefined }}>
      <NGLViewer
        noTrajectory
        components={[]}
        topologies={[]}
        trajectories={[]}
      />
    </ProjectCtx.Provider>,
  );

describe('<NGLViewer /> stage lifecycle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stops every animation frame loop when unmounted', () => {
    installFakeWebGL();
    const frames = installFrameQueue();
    const { unmount } = renderViewer();
    frames.runFrame();
    expect(frames.pending).toBeGreaterThan(0);
    unmount();
    // Pending callbacks run once more but must not request new frames
    frames.runFrame();
    frames.runFrame();
    expect(frames.pending).toBe(0);
  });

  it('removes every document listener when unmounted', () => {
    installFakeWebGL();
    installFrameQueue();
    // Track the listeners currently set in the document
    const listeners = [];
    const add = document.addEventListener;
    const remove = document.removeEventListener;
    jest.spyOn(document, 'addEventListener').mockImplementation(function (type, listener) {
      listeners.push([type, listener]);
      return add.apply(this, arguments);
    });
    jest.spyOn(document, 'removeEventListener').mockImplementation(function (type, listener) {
      const index = listeners.findIndex(([t, l]) => t === type && l === listener);
      if (index !== -1) listeners.splice(index, 1);
      return remove.apply(this, arguments);
    });
    const { unmount } = renderViewer();
    expect(listeners).not.toHaveLength(0);
    unmount();
    expect(listeners.map(([type]) => type)).toEqual([]);
  });

  it('releases the WebGL context when unmounted', () => {
    const loseContextExtension = installFakeWebGL();
    installFrameQueue();
    const { unmount } = renderViewer();
    expect(loseContextExtension.loseContext).not.toHaveBeenCalled();
    unmount();
    expect(loseContextExtension.loseContext).toHaveBeenCalledTimes(1);
  });
});
