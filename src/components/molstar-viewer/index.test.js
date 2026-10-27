import React from 'react';
import { render, act } from '@testing-library/react';

import { ProjectCtx } from '../../contexts';

// Replace the Mol* plugin with a fake whose creation the test controls
vi.mock('molstar/lib/mol-plugin-ui/index', () => ({ createPluginUI: vi.fn() }));
vi.mock('molstar/lib/mol-plugin-ui/spec', () => ({ DefaultPluginUISpec: () => ({}) }));
vi.mock('molstar/lib/mol-plugin-state/transforms/model', () => ({}));
vi.mock('molstar/lib/mol-plugin-state/animation/built-in/model-index', () => ({}));
vi.mock('molstar/lib/mol-plugin-state/helpers/structure-representation-params', () => ({}));
vi.mock('molstar/lib/mol-plugin-state/transforms', () => ({}));
vi.mock('./molstar-parser', () => ({}));
// jsdom has no IntersectionObserver
vi.mock('react-intersection-observer', () => ({ useInView: () => [() => {}, false] }));

const { createPluginUI } = await import('molstar/lib/mol-plugin-ui/index');
const MolstarViewer = (await import('.')).default;

const renderViewer = () =>
  render(
    <ProjectCtx.Provider value={{ metadata: {}, topology: {} }}>
      <MolstarViewer
        noTrajectory
        anyLoadingTopology
        components={[]}
        topologies={[]}
        trajectories={[]}
      />
    </ProjectCtx.Provider>,
  );

describe('<MolstarViewer /> plugin lifecycle', () => {
  it('disposes the Mol* plugin when unmounted', async () => {
    const plugin = { dispose: vi.fn() };
    createPluginUI.mockResolvedValue(plugin);
    const { unmount } = renderViewer();
    // Let the plugin creation resolve
    await act(async () => {});
    unmount();
    expect(plugin.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes a Mol* plugin that finishes creating after unmount', async () => {
    const plugin = { dispose: vi.fn() };
    let resolvePlugin;
    createPluginUI.mockReturnValue(new Promise(resolve => { resolvePlugin = resolve; }));
    const { unmount } = renderViewer();
    unmount();
    await act(async () => resolvePlugin(plugin));
    expect(plugin.dispose).toHaveBeenCalledTimes(1);
  });
});
