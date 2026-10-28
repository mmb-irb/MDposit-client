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

const viewer = props => (
  <ProjectCtx.Provider value={{ metadata: {}, topology: {} }}>
    <MolstarViewer
      noTrajectory
      anyLoadingTopology
      components={[]}
      topologies={[]}
      trajectories={[]}
      {...props}
    />
  </ProjectCtx.Provider>
);
const renderViewer = props => render(viewer(props));

// The speed effect reads the animation state as soon as the plugin is set
const fakePlugin = () => ({
  dispose: vi.fn(),
  managers: { animation: { state: { animationState: 'stopped' } } },
  canvas3d: { setProps: vi.fn() },
});

describe('<MolstarViewer /> plugin lifecycle', () => {
  it('disposes the Mol* plugin when unmounted', async () => {
    const plugin = fakePlugin();
    createPluginUI.mockResolvedValue(plugin);
    const { unmount } = renderViewer();
    // Let the plugin creation resolve
    await act(async () => {});
    unmount();
    expect(plugin.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes a Mol* plugin that finishes creating after unmount', async () => {
    const plugin = fakePlugin();
    let resolvePlugin;
    createPluginUI.mockReturnValue(new Promise(resolve => { resolvePlugin = resolve; }));
    const { unmount } = renderViewer();
    unmount();
    await act(async () => resolvePlugin(plugin));
    expect(plugin.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('<MolstarViewer /> display settings', () => {
  it('creates the plugin with the background, camera and spin already set', async () => {
    createPluginUI.mockResolvedValue(fakePlugin());
    renderViewer({ darkBackground: true, perspective: false, spinning: true });
    await act(async () => {});
    const { canvas3d } = createPluginUI.mock.calls[0][0].spec;
    expect(canvas3d.renderer.backgroundColor).toBe(0x000000);
    expect(canvas3d.camera.mode).toBe('orthographic');
    expect(canvas3d.trackball.animate.name).toBe('spin');
  });

  it('updates the background, camera and spin when the settings change', async () => {
    const plugin = fakePlugin();
    createPluginUI.mockResolvedValue(plugin);
    const { rerender } = renderViewer({ darkBackground: false, perspective: false, spinning: false });
    await act(async () => {});

    rerender(viewer({ darkBackground: true, perspective: true, spinning: true }));
    let props = plugin.canvas3d.setProps.mock.lastCall[0];
    expect(props.renderer.backgroundColor).toBe(0x000000);
    expect(props.camera.mode).toBe('perspective');
    expect(props.trackball.animate.name).toBe('spin');

    rerender(viewer({ darkBackground: false, perspective: false, spinning: false }));
    props = plugin.canvas3d.setProps.mock.lastCall[0];
    expect(props.renderer.backgroundColor).toBe(0xffffff);
    expect(props.camera.mode).toBe('orthographic');
    expect(props.trackball.animate.name).toBe('off');
  });
});
