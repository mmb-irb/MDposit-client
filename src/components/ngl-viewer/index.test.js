import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { Stage } from 'ngl';

import { ProjectCtx } from '../../contexts';
import { installFakeWebGL, installFrameQueue, TEST_PDB } from './test-utils';

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

describe('<NGLViewer /> initial camera', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('frames the initial focus from the first paint', async () => {
    installFakeWebGL();
    const frames = installFrameQueue();
    // Record the center of every camera movement
    const centers = [];
    const addComponentFromObject = Stage.prototype.addComponentFromObject;
    jest.spyOn(Stage.prototype, 'addComponentFromObject').mockImplementation(function () {
      const zoomMove = this.animationControls.zoomMove;
      this.animationControls.zoomMove = function (center) {
        centers.push(center.toArray());
        return zoomMove.apply(this, arguments);
      };
      return addComponentFromObject.apply(this, arguments);
    });
    render(
      <ProjectCtx.Provider value={{ metadata: {}, topology: { atomBonds: null } }}>
        <NGLViewer
          noTrajectory
          components={[{ name: 'main' }]}
          representations={[{ name: 'all', component: 'main', selection: 'all', type: 'ball+stick' }]}
          topologies={[{ url: 'test', urlpath: null, file: TEST_PDB }]}
          trajectories={[]}
          // The ligand, far from the center of the whole structure
          initialFocus={{ sele: ':B' }}
        />
      </ProjectCtx.Provider>,
    );
    await waitFor(() => {
      frames.runFrame();
      expect(centers).not.toHaveLength(0);
    });
    // The camera never frames the whole structure, not even before the focus effect
    centers.forEach(([x, y, z]) => {
      expect(x).toBeCloseTo(11.7);
      expect(y).toBeCloseTo(10.75);
      expect(z).toBeCloseTo(10);
    });
  });
});
