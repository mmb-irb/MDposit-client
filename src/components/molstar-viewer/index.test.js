import React from 'react';
import { render, act, screen } from '@testing-library/react';

import { Camera } from 'molstar/lib/mol-canvas3d/camera';
import { Viewport } from 'molstar/lib/mol-canvas3d/camera/util';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';

import { ProjectCtx } from '../../contexts';

// Replace the Mol* plugin with a fake whose creation the test controls
vi.mock('molstar/lib/mol-plugin-ui/index', () => ({ createPluginUI: vi.fn() }));
vi.mock('molstar/lib/mol-plugin-ui/spec', () => ({ DefaultPluginUISpec: () => ({}) }));
// Representation parameters are made of the given ones, which is what the tests check
vi.mock('molstar/lib/mol-plugin-state/helpers/structure-representation-params', () => ({
  createStructureRepresentationParams: (plugin, structure, params) => params,
}));
// The custom transformers are built with its factory (e.g. mesh)
vi.mock('./molstar-parser', () => ({ CreateTransformer: () => () => ({}) }));
// Molstar loci are not easy to build, so the hovered atoms are given directly
vi.mock('./hovered-atoms', () => ({ getHoveredAtoms: vi.fn(), getHoveredAtomPair: vi.fn() }));
// Tell when the topology is parsed with NGL, which never finishes here
vi.mock('ngl', async importOriginal => ({ ...await importOriginal(), autoLoad: vi.fn(() => new Promise(() => {})) }));
// jsdom has no IntersectionObserver
vi.mock('react-intersection-observer', () => ({ useInView: () => [() => {}, false] }));

const { createPluginUI } = await import('molstar/lib/mol-plugin-ui/index');
const { autoLoad } = await import('ngl');
const { getHoveredAtoms, getHoveredAtomPair } = await import('./hovered-atoms');
const { default: MolstarViewer, getPlaybackMode, getOtherParams } = await import('.');

const viewer = ({ topology = {}, ...props } = {}) => (
  <ProjectCtx.Provider value={{ metadata: {}, topology }}>
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

// A fake of the molstar BehaviorSubjects (e.g. canvas3d.resized), which give new subscribers the last value
const fakeSubject = value => {
  const callbacks = new Set();
  return {
    subscribe: callback => {
      callbacks.add(callback);
      callback(value);
      return { unsubscribe: () => callbacks.delete(callback) };
    },
    next: newValue => {
      value = newValue;
      callbacks.forEach(callback => callback(value));
    },
  };
};

// The speed effect reads the animation state as soon as the plugin is set
// The play/pause effect stops the animation when there is a trajectory not playing
// The tooltip effect listens to hovered atoms
// The camera focus waits for the viewport to have a size
const fakePlugin = () => ({
  dispose: vi.fn(),
  managers: {
    animation: { state: { animationState: 'stopped' }, stop: vi.fn() },
    interactivity: { setProps: vi.fn() },
  },
  behaviors: { interaction: { hover: { subscribe: () => ({ unsubscribe: vi.fn() }) } } },
  canvas3d: {
    setProps: vi.fn(),
    // Molstar has not sized its viewport yet
    resized: fakeSubject(0),
    camera: { viewport: Viewport.create(0, 0, 300, 150) },
  },
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

describe('<MolstarViewer /> camera', () => {
  // Curators use this output to fill the ORIENTATION metadata field
  it('prints the camera as an NGL orientation', async () => {
    const plugin = fakePlugin();
    plugin.canvas3d.camera.state = { target: [10, 20, 30], position: [10, 20, -50], up: [0, 1, 0] };
    createPluginUI.mockResolvedValue(plugin);
    const ref = React.createRef();
    renderViewer({ ref });
    await act(async () => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    ref.current.displayFocus();
    const orientation = JSON.parse(log.mock.lastCall[0]);
    expect(orientation).toHaveLength(16);
    // Camera 80 Å away looking along +Z, so no rotation
    [80, 0, 0, 0, 0, 80, 0, 0, 0, 0, 80, 0, -10, -20, -30, 1].forEach((value, i) =>
      expect(orientation[i]).toBeCloseTo(value));
  });
});

describe('<MolstarViewer /> tooltip', () => {
  afterEach(() => {
    vi.useRealTimers();
    getHoveredAtoms.mockReset();
    getHoveredAtomPair.mockReset();
  });

  // Render the viewer and hover something at a mouse position in the canvas
  const hoverViewer = async (props, page = [0, 0]) => {
    let hover;
    const plugin = fakePlugin();
    plugin.behaviors.interaction.hover.subscribe = callback => {
      hover = callback;
      return { unsubscribe: vi.fn() };
    };
    plugin.canvas3dContext = { canvas: { getBoundingClientRect: () => ({ left: 63, top: 176 }) } };
    createPluginUI.mockResolvedValue(plugin);
    const residue = { chainName: 'A', chain: {}, number: 7 };
    renderViewer({ topology: { getAtomByIndex: () => ({ residue }) }, ...props });
    await act(async () => {});
    vi.useFakeTimers();
    act(() => {
      hover({ current: { loci: {} }, page });
      vi.advanceTimersByTime(400);
    });
  };

  // Molstar gives the mouse position relative to the canvas, not to the page
  it('shows the hovered atom next to the mouse', async () => {
    getHoveredAtoms.mockReturnValue([{ index: 5, name: 'CA', residueName: 'ALA' }]);
    // The mouse is at 275, 189 in the window
    await hoverViewer({}, [212, 13]);
    const tooltip = screen.getByText(/Atom 5 \(CA\)/);
    // There is no layout in jsdom, so the tooltip is just 3 pixels away from the mouse
    expect([tooltip.style.left, tooltip.style.top]).toEqual(['278px', '192px']);
  });

  // e.g. chemical-shifts adds the shifts of the hovered atom
  it('lets the page change the description of the hovered atom', async () => {
    getHoveredAtoms.mockReturnValue([{ index: 5, name: 'CA', residueName: 'ALA' }]);
    const onHoverDisplay = (atomIndex, original) => <>{original}<div>{`Shift of ${atomIndex}`}</div></>;
    await hoverViewer({ onHoverDisplay });
    screen.getByText(/Atom 5 \(CA\)/);
    screen.getByText('Shift of 5');
  });

  // e.g. allostery describes the hovered link
  it('lets the page describe the hovered link between two atoms', async () => {
    const atoms = [{ index: 5, name: 'CA', residueName: 'ALA' }, { index: 9, name: 'CA', residueName: 'GLY' }];
    getHoveredAtomPair.mockReturnValue({ atoms, length: 3.8 });
    const distanceTooltip = (atom1, atom2) => atom1 === 5 && atom2 === 9 ? <div>Link strength</div> : null;
    await hoverViewer({ distanceTooltip });
    screen.getByText('Link strength');
  });

  it('describes the hovered link by default', async () => {
    const atoms = [{ index: 5, name: 'CA', residueName: 'ALA' }, { index: 9, name: 'CA', residueName: 'GLY' }];
    getHoveredAtomPair.mockReturnValue({ atoms, length: 3.8 });
    await hoverViewer({ distanceTooltip: () => undefined });
    screen.getByText('Distance 5 - 9 (3.80 Å)');
    screen.getByText(/Atom 9 \(CA\)/);
  });
});

// The viewer shows its loading status in its upper left corner, as the NGL viewer does
describe('<MolstarViewer /> loading status', () => {
  const renderStatus = async props => {
    createPluginUI.mockResolvedValue(fakePlugin());
    const { container } = renderViewer(props);
    await act(async () => {});
    return container.querySelector('[data-loading]')?.getAttribute('data-loading');
  };

  it('shows the download error', async () => {
    expect(await renderStatus({ downloadError: 'Could not load the trajectory' }))
      .toBe('Could not load the trajectory');
  });

  it('waits for the main topology', async () => {
    expect(await renderStatus({ topology: null })).toBe('Waiting for the main topology');
  });

  it('tells when there is no trajectory', async () => {
    expect(await renderStatus({ noTrajectory: false })).toBe('No trajectory available');
  });

  it('waits for the structure to be built', async () => {
    expect(await renderStatus({ noTrajectory: false, trajectories: [{}] })).toBe('Waiting for the main component');
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

describe('<MolstarViewer /> playback', () => {
  // e.g. pca projections go back and forth
  it('goes back and forth when bouncing, as NGL does, once every frame is downloaded', () => {
    expect(getPlaybackMode(true, true).name).toBe('palindrome');
    expect(getPlaybackMode(true, false)).toEqual({ name: 'loop', params: { direction: 'forward' } });
    // Frames still downloading are played once, since more are coming
    expect(getPlaybackMode(false, true)).toEqual({ name: 'once', params: { direction: 'forward' } });
  });
});

describe('<MolstarViewer /> other NGL parameters', () => {
  // e.g. pockets
  it('draws contour surfaces as a net', () => {
    expect(getOtherParams('surface', { contour: true })).toEqual({ visuals: ['molecular-surface-wireframe'] });
  });

  // e.g. thickness, whose leaflets are big balls
  it('scales ball and stick with its radius', () => {
    expect(getOtherParams('ball+stick', { radius: 0.75 })).toEqual({ sizeFactor: 0.75 });
    expect(getOtherParams('ball+stick', undefined)).toEqual({});
  });
});

// A fake molstar state, which records the changes of every commit
const fakeState = () => {
  const commits = [];
  let nodeCount = 0;
  const build = () => {
    const changes = [];
    const node = ref => ({
      ref,
      selector: { ref },
      apply: (transformer, params) => {
        const child = node(`node${++nodeCount}`);
        changes.push(['apply', ref, child.ref, params]);
        return child;
      },
      update: params => changes.push(['update', ref, params]),
    });
    return {
      to: target => node(target.ref || target),
      delete: ref => changes.push(['delete', ref]),
      commit: async () => { if (changes.length > 0) commits.push(changes) },
    };
  };
  return { build, commits };
};

// Let molstar and every effect finish
const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 0)));

// Render the viewer with a single component which represents its topology
// Representations select the whole structure, so molstar is not asked to find their atoms
// The structure is a sphere of 10 Å around the origin, which the camera focuses
const renderRepresentations = async (representations, { component, topology, canvas3d, topologyFile = 'ATOM' } = {}) => {
  const plugin = fakePlugin();
  const { build, commits } = fakeState();
  const structure = { ref: 'structure', data: { boundary: { sphere: { center: [0, 0, 0], radius: 10 } } } };
  Object.assign(plugin, {
    build,
    builders: {
      data: { rawData: async () => ({ ref: 'data' }) },
      structure: {
        parseTrajectory: vi.fn(async () => ({ ref: 'trajectory' })),
        createModel: async () => ({ ref: 'model' }),
        createStructure: async () => structure,
      },
    },
  });
  plugin.managers.structure = { measurement: {} };
  plugin.canvas3d.camera = {
    ...plugin.canvas3d.camera,
    state: { target: [0, 0, 0], position: [0, 0, -50], up: [0, 1, 0] },
    getInvariantFocus: () => ({}),
    setState: vi.fn(),
  };
  Object.assign(plugin.canvas3d, canvas3d);
  createPluginUI.mockResolvedValue(plugin);
  const props = {
    anyLoadingTopology: false,
    topologies: [{ urlpath: 'topology', file: topologyFile }],
    components: [{ name: 'main', topologyURL: 'topology', onlyTopology: true, ...component }],
    topology,
  };
  const { rerender } = renderViewer({ ...props, representations });
  for (let tick = 0; tick < 5; tick++) await settle();
  // Change the representations as RepresentationsManager does: in place, then in a new array
  const change = async edit => {
    commits.length = 0;
    edit(representations);
    rerender(viewer({ ...props, representations: [...representations] }));
    await settle();
  };
  return { commits, change, plugin };
};

describe('<MolstarViewer /> camera focus', () => {
  // Distance from which the default perspective camera frames a sphere in a viewport wider than high
  // Molstar adds 4 Å around what it focuses
  const framingDistance = radius => (radius + 4) / Math.sin(Math.PI / 8);
  const cameraDistance = camera => Vec3.distance(camera.state.position, camera.state.target);

  // Render the structure with a real molstar camera
  // Its viewport was last sized by molstar at the given time, or never if 0
  const renderWithCamera = async (viewport, resizeTime) => {
    const camera = new Camera(undefined, viewport);
    const { plugin } = await renderRepresentations([], {
      canvas3d: { camera, resized: fakeSubject(resizeTime) },
    });
    return { camera, plugin };
  };

  // Molstar resizes its viewport, as it does when the size of its container changes
  const resize = async (plugin, width, height) => {
    Viewport.set(plugin.canvas3d.camera.viewport, 0, 0, width, height);
    await act(async () => plugin.canvas3d.resized.next(Date.now()));
  };

  // e.g. a spawned viewer switched to Mol* from its settings panel, which takes the whole width meanwhile
  // Molstar keeps a 1 px wide viewport then, and framing the structure in it would place the camera
  // as many times further as the viewport is high (219 times here)
  it('frames the structure once the viewport has a size', async () => {
    const { camera, plugin } = await renderWithCamera(Viewport.create(0, 0, 1, 219), Date.now());
    // The settings panel is closed
    await resize(plugin, 384, 219);
    expect(cameraDistance(camera)).toBeCloseTo(framingDistance(10));
  });

  // The structure may be built before the first frame, when molstar sizes the viewport
  // The camera is then further in a viewport higher than wide, so the structure fits its width
  it('frames the structure once molstar has sized the viewport', async () => {
    // The default size of a canvas
    const { camera, plugin } = await renderWithCamera(Viewport.create(0, 0, 300, 150), 0);
    await resize(plugin, 219, 384);
    expect(cameraDistance(camera)).toBeCloseTo(framingDistance(10) * 384 / 219);
  });

  // e.g. opening and closing the settings panel again keeps what the user did with the camera
  it('does not move the camera when the viewport gets its size back', async () => {
    const { camera, plugin } = await renderWithCamera(Viewport.create(0, 0, 384, 219), Date.now());
    expect(cameraDistance(camera)).toBeCloseTo(framingDistance(10));
    // The user zooms in
    camera.setState({ ...camera.getSnapshot(), position: Vec3.create(0, 0, -20) }, 0);
    await resize(plugin, 1, 219);
    await resize(plugin, 384, 219);
    expect(cameraDistance(camera)).toBeCloseTo(20);
  });
});

describe('<MolstarViewer /> representations', () => {
  const representations = () => [
    { name: 'Protein', selection: 'all', type: 'cartoon', color: 'chainid', opacity: 1, show: true },
    { name: 'Membrane', selection: 'all', type: 'licorice', color: 'element', opacity: 1, show: true },
  ];

  // The structure endpoint may return either format, without saying which one
  it.each([
    ['pdb', 'ATOM      1  N   ALA A   1       0.000   0.000   0.000\nEND\n'],
    ['mmcif', 'data_structure\n#\nloop_\n_atom_site.group_PDB\n'],
  ])('parses the topology as %s by looking at its content', async (format, topologyFile) => {
    const { plugin } = await renderRepresentations(representations(), { topologyFile });
    const { parseTrajectory } = plugin.builders.structure;
    expect(parseTrajectory).toHaveBeenCalledTimes(1);
    expect(parseTrajectory.mock.calls[0][1]).toBe(format);
  });

  it('builds every representation in a single commit', async () => {
    const { commits } = await renderRepresentations(representations());
    expect(commits).toHaveLength(1);
    expect(commits[0].map(([action, parent, , params]) => [action, parent, params.color])).toEqual([
      ['apply', 'structure', 'chain-id'],
      ['apply', 'structure', 'element-cg'],
    ]);
  });

  // e.g. the membrane of an 80k atom system must not be built again when a ligand is hidden
  it('only deletes a hidden representation', async () => {
    const { commits, change } = await renderRepresentations(representations());
    const membraneNode = commits[0][1][2];
    await change(reps => { reps[1].show = false });
    expect(commits).toEqual([[['delete', membraneNode]]]);
    // Showing it again builds it alone
    await change(reps => { reps[1].show = true });
    expect(commits).toHaveLength(1);
    expect(commits[0].map(([action, parent]) => [action, parent])).toEqual([['apply', 'structure']]);
  });

  // Molstar recolors a representation without building its geometry again, as NGL does
  it('updates the color and opacity of a representation in place', async () => {
    const { commits, change } = await renderRepresentations(representations());
    const proteinNode = commits[0][0][2];
    await change(reps => {
      reps[0].color = 'red';
      reps[0].opacity = 0.5;
    });
    expect(commits).toHaveLength(1);
    expect(commits[0]).toHaveLength(1);
    const [action, node, params] = commits[0][0];
    expect([action, node]).toEqual(['update', proteinNode]);
    expect(params.color).toBe('uniform');
    expect(params.typeParams.alpha).toBe(0.5);
  });

  it('builds again a representation whose drawing method changes', async () => {
    const { commits, change } = await renderRepresentations(representations());
    const proteinNode = commits[0][0][2];
    await change(reps => { reps[0].type = 'spacefill' });
    expect(commits).toHaveLength(1);
    expect(commits[0].map(([action, parent, , params]) => [action, parent, params && params.type])).toEqual([
      ['delete', proteinNode, undefined],
      ['apply', 'structure', 'spacefill'],
    ]);
  });

  // e.g. zooming into a pocket shows the atoms inside it rather than a solid cap
  it('leaves surfaces hollow where the camera cuts them, as NGL does', async () => {
    const { commits } = await renderRepresentations([
      { name: 'Pocket', selection: 'all', type: 'surface', color: 'element', opacity: 1, show: true },
    ]);
    const [, , , params] = commits[0][0];
    expect(params.type).toBe('molecular-surface');
    expect(params.typeParams.solidInterior).toBe(false);
  });

  // e.g. the lipid and water hydrogens of a membrane, which NGL draws
  it('draws hydrogens, as NGL does', async () => {
    const { commits } = await renderRepresentations(['licorice', 'ball+stick', 'spacefill', 'surface'].map(type => (
      { name: type, selection: 'all', type, color: 'element', opacity: 1, show: true }
    )));
    expect(commits[0].map(([, , , params]) => [params.type, Boolean(params.typeParams.ignoreHydrogens)])).toEqual([
      ['line', false],
      ['ball-and-stick', false],
      ['spacefill', false],
      ['molecular-surface', false],
    ]);
  });

  describe('with a subset of atoms', () => {
    afterEach(() => autoLoad.mockClear());

    // e.g. the reduced membrane view, where this app's selections are translated with the topology
    it('does not wait for NGL to parse the topology', async () => {
      const { commits } = await renderRepresentations(representations(), {
        component: { atomIndices: [0, 1, 2] },
        topology: { atomCount: 10 },
      });
      expect(autoLoad).not.toHaveBeenCalled();
      expect(commits).toHaveLength(1);
    });

    it('parses the topology with NGL for selections only NGL understands', async () => {
      const reps = representations();
      reps[1].selection = 'not protein';
      await renderRepresentations(reps, { component: { atomIndices: [0, 1, 2] }, topology: { atomCount: 10 } });
      expect(autoLoad).toHaveBeenCalledTimes(1);
    });
  });
});
