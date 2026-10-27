// NGL behaviours the viewer relies on
// These run the real NGL library, so they flag what breaks when NGL is bumped
import {
  autoLoad,
  Stage,
  Selection,
  Frames,
  MouseActions,
  ColormakerRegistry,
} from 'ngl';

import { PDB_WITH_TOPOLOGY_BONDS } from './pdb-parser-with-topology-bonds';
import getElementColorSchemeId from './element-colormaker';
import {
  installFakeWebGL,
  TEST_PDB,
  TEST_ATOM_COORDINATES,
} from './test-utils';

const loadTestStructure = (ext = 'pdb') =>
  autoLoad(new Blob([TEST_PDB], { type: 'text/plain' }), { ext });

// Count the atoms of a structure matching an NGL selection string
const countSelected = (structure, sele) => {
  let count = 0;
  structure.eachAtom(() => (count += 1), new Selection(sele));
  return count;
};

// List the bonds between atoms of different residues, e.g. '[ALA]1:A.C - [GLY]2:A.N'
const listInterResidueBonds = structure => {
  const bonds = new Set();
  structure.eachBond(bond => {
    if (bond.atom1.residueIndex === bond.atom2.residueIndex) return;
    bonds.add(`${bond.atom1.qualifiedName()} - ${bond.atom2.qualifiedName()}`);
  });
  return [...bonds];
};

const createStage = () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return new Stage(container);
};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('PDB parsing', () => {
  it('parses atoms, residues and chains', async () => {
    const structure = await loadTestStructure();
    expect(structure.atomCount).toBe(15);
    expect(structure.residueStore.count).toBe(5);
    // Every non-polymer residue gets its own chain, so chain B is split in two
    expect(structure.chainStore.count).toBe(4);
  });

  it('skips guessing non-polymer bonds with the topology bonds parser', async () => {
    const stock = await loadTestStructure();
    const structure = await loadTestStructure(PDB_WITH_TOPOLOGY_BONDS);
    expect(structure.atomCount).toBe(stock.atomCount);
    // The bond between both ligand residues is guessed by the stock parser but not by ours
    // The only bond left between residues is the peptide bond
    const peptideBond = '[ALA]1:A.C - [GLY]2:A.N';
    const ligandBond = '[LIG]1:B.O1 - [LIG]2:B.C3';
    expect(listInterResidueBonds(stock)).toEqual([peptideBond, ligandBond]);
    expect(listInterResidueBonds(structure)).toEqual([peptideBond]);
    // Backbone bonds (needed by the cartoon) are still there
    expect(structure.backboneBondStore.count).toBeGreaterThan(0);
    expect(structure.backboneBondStore.count).toBe(stock.backboneBondStore.count);
  });

  it('restores the spatial hash after parsing with the topology bonds parser', async () => {
    const structure = await loadTestStructure(PDB_WITH_TOPOLOGY_BONDS);
    // Atoms within 1 Å of the ion: only the ion itself
    const within = structure.getAtomSetWithinPoint({ x: 20, y: 20, z: 20 }, 1);
    expect(within.getSize()).toBe(1);
  });
});

describe('selections', () => {
  // Selection strings in the forms the client builds them
  it.each([
    ['@0,2', 2],
    ['(:A and (1-2))', 10],
    ['(:A and (1)) or (:B and (1))', 9],
    ['not (:A and (1))', 9],
    ['polymer and not hydrogen ', 9],
    ['protein', 10],
    ['backbone', 9], // Includes the amide hydrogen
    ['.CA', 2],
    ['hydrogen', 1],
    ['ion', 1],
    ['all', 15],
  ])('"%s" selects %i atoms', async (sele, expected) => {
    const structure = await loadTestStructure();
    expect(countSelected(structure, sele)).toBe(expected);
  });
});

describe('colors', () => {
  it('colors known elements with the CPK table in the improved element scheme', async () => {
    const structure = await loadTestStructure();
    const scheme = ColormakerRegistry.getScheme({
      scheme: getElementColorSchemeId(),
      structure,
    });
    const carbon = structure.getAtomProxy(1);
    const oxygen = structure.getAtomProxy(3);
    expect(scheme.atomColor(carbon)).toBe(0x909090);
    expect(scheme.atomColor(oxygen)).toBe(0xff0d0d);
  });
});

describe('stage', () => {
  beforeEach(() => {
    installFakeWebGL();
  });

  it('plays a trajectory built from Frames', async () => {
    const stage = createStage();
    const component = stage.addComponentFromObject(await loadTestStructure());
    // Frame 0 is the structure itself, frame 1 is shifted by 1 Å in x
    const frames = new Frames('Test trajectory', '');
    frames.coordinates = [0, 1].map(shift =>
      Float32Array.from(TEST_ATOM_COORDINATES.flatMap(([x, y, z]) => [x + shift, y, z])),
    );
    const trajectoryElement = component.addTrajectory(frames);
    const { trajectory } = trajectoryElement;
    expect(trajectory.frameCount).toBe(2);
    await new Promise(resolve => {
      trajectory.signals.frameChanged.add(resolve);
      trajectory.setFrame(1);
    });
    expect(component.structure.getAtomProxy(0).x).toBeCloseTo(1);
    expect(typeof trajectory.player.setParameters).toBe('function');
    stage.dispose();
  });

  it('lets the default click and hover actions be replaced', () => {
    const stage = createStage();
    const { mouseControls } = stage;
    // Actions triggered with no modifier key
    const findActions = (type, button) => mouseControls.actionList.filter(action =>
      action.type === type && !action.key && (button === undefined || action.button === button));
    expect(findActions('hoverPick')).not.toHaveLength(0);
    mouseControls.remove('hoverPick');
    expect(findActions('hoverPick')).toHaveLength(0);
    const leftClicks = () => findActions('clickPick', 1).map(action => action.callback);
    expect(leftClicks()).toEqual([MouseActions.movePick]);
    const handleClick = () => {};
    mouseControls.remove('clickPick-left', MouseActions.movePick);
    mouseControls.add('clickPick-left', handleClick);
    expect(leftClicks()).toEqual([handleClick]);
    stage.dispose();
  });

  it('zooms in when scrolling up', () => {
    const stage = createStage();
    const canvas = stage.viewer.renderer.domElement;
    const delta = vi.fn();
    stage.mouseObserver.signals.scrolled.add(delta);
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, deltaMode: 0, bubbles: true }));
    expect(delta).toHaveBeenCalledTimes(1);
    expect(delta.mock.calls[0][0]).toBeGreaterThan(0);
    stage.dispose();
  });
});
