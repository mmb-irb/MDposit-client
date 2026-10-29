import React from 'react';
import { render } from '@testing-library/react';

import ViewerWithControls from '.';

import { ProjectCtx } from '../../contexts';

// Record what the viewer backend receives instead of rendering an actual NGL stage
const viewerProps = [];
vi.mock('../ngl-viewer', async () => {
  const { forwardRef } = await import('react');
  const FakeViewer = forwardRef((props, ref) => {
    viewerProps.push(props);
    return null;
  });
  return { default: FakeViewer };
});
vi.mock('../../hooks/use-viewer-data', () => ({
  default: () => ({ topologies: [], trajectories: [], anyLoadingTopology: false, anyLoadingTrajectory: false }),
}));
vi.mock('../../hooks/use-box-data', () => ({ default: () => null }));
// The fullscreen API is not available in jsdom
vi.mock('screenfull', () => ({ default: { isFullscreen: false, on: () => {}, off: () => {} } }));

// Representations shared by every viewer of the same MD, as cached in the topology
const makeTopology = () => ({
  defaultRepresentations: [
    { name: 'protein', selection: ':A', type: 'cartoon', color: 'chainid', opacity: 1 },
    { name: 'ligand', selection: ':B', type: 'licorice', color: 'element', opacity: 1 },
  ],
});

const renderViewer = (topology, props) => render(
  <ProjectCtx.Provider value={{
    accessionAndMdNumber: 'A0001.1',
    metadata: { mdFrames: 10 },
    topology,
    fileDescriptors: { loading: false, payload: [] },
  }}>
    <ViewerWithControls {...props} />
  </ProjectCtx.Provider>,
);

const lastViewerProps = () => viewerProps[viewerProps.length - 1];

describe('<ViewerWithControls /> representations', () => {
  beforeEach(() => { viewerProps.length = 0 });

  // e.g. visiting Populations and then SASA, whose component has no name
  it('links the representations of a page to its own component after another viewer used the default ones', () => {
    const topology = makeTopology();
    renderViewer(topology, {}).unmount();
    viewerProps.length = 0;
    const startingComponents = [ { trajectoryURLs: [ '/trajectory?frames=1:10:2' ] } ];
    const startingRepresentations = topology.defaultRepresentations.map(representation =>
      ({ ...representation, color: 'red' }));
    renderViewer(topology, { startingComponents, startingRepresentations });
    const { components, representations } = lastViewerProps();
    expect(representations).toHaveLength(2);
    representations.forEach(representation =>
      expect(representation.component).toBe(components[0].name));
  });

  it('does not modify the default representations', () => {
    const topology = makeTopology();
    const original = JSON.parse(JSON.stringify(topology.defaultRepresentations));
    renderViewer(topology, {});
    expect(lastViewerProps().representations[0].component).toBe('Main');
    expect(topology.defaultRepresentations).toEqual(original);
  });
});
