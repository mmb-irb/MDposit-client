import { diffRepresentations, getRepresentationKey } from '.';

// A representation as described by the viewer once built
const snapshotOf = (values = {}) => ({
  key: '0-Protein',
  component: 'main',
  selection: '(:A and (1-100))',
  type: 'cartoon',
  other: undefined,
  nglStructure: null,
  colorTheme: { name: 'chain-id' },
  opacity: 1,
  ...values,
});
// The built representations by their key, with made up nodes
const build = (...snapshots) => new Map(snapshots.map(snapshot =>
  [snapshot.key, { ref: `${snapshot.key}-node`, snapshot }]));
const keys = snapshots => snapshots.map(({ snapshot }) => snapshot.key);

describe('Representations diff', () => {
  // As in the NGL viewer
  it('identifies representations by their position and name', () => {
    expect(getRepresentationKey({ name: 'Membrane' }, 2)).toBe('2-Membrane');
  });

  it('builds every representation the first time', () => {
    const requested = [snapshotOf(), snapshotOf({ key: '1-Membrane' })];
    const { kept, toBuild, toDelete } = diffRepresentations(new Map(), requested);
    expect(toBuild).toEqual(requested);
    expect(kept).toEqual([]);
    expect(toDelete).toEqual([]);
  });

  it('keeps representations which do not change', () => {
    const built = build(snapshotOf(), snapshotOf({ key: '1-Membrane' }));
    const { kept, toUpdate, toBuild, toDelete } = diffRepresentations(
      built, [snapshotOf(), snapshotOf({ key: '1-Membrane' })]);
    expect(keys(kept)).toEqual(['0-Protein', '1-Membrane']);
    expect(toUpdate).toEqual([]);
    expect(toBuild).toEqual([]);
    expect(toDelete).toEqual([]);
  });

  // e.g. toggling the color of a ligand must not build the membrane again
  it('only updates representations whose color or opacity changes', () => {
    const built = build(snapshotOf(), snapshotOf({ key: '1-Membrane' }));
    const recolored = snapshotOf({ colorTheme: { name: 'uniform', params: { value: 0xff0000 } } });
    const faded = snapshotOf({ key: '1-Membrane', opacity: 0.3 });
    const { kept, toUpdate, toBuild, toDelete } = diffRepresentations(built, [recolored, faded]);
    expect(keys(kept)).toEqual(['0-Protein', '1-Membrane']);
    expect(toUpdate.map(({ previous, snapshot }) => [previous.ref, snapshot])).toEqual([
      ['0-Protein-node', recolored],
      ['1-Membrane-node', faded],
    ]);
    expect(toBuild).toEqual([]);
    expect(toDelete).toEqual([]);
  });

  it('builds again representations whose atoms or drawing method change', () => {
    const built = build(snapshotOf(), snapshotOf({ key: '1-Membrane' }), snapshotOf({ key: '2-Ligand' }));
    const requested = [
      snapshotOf({ selection: '(:A and (1-50))' }),
      snapshotOf({ key: '1-Membrane', type: 'spacefill' }),
      snapshotOf({ key: '2-Ligand', other: { radius: 0.75 } }),
    ];
    const { kept, toBuild, toDelete } = diffRepresentations(built, requested);
    expect(kept).toEqual([]);
    expect(toBuild).toEqual(requested);
    expect(toDelete.map(previous => previous.ref)).toEqual(['0-Protein-node', '1-Membrane-node', '2-Ligand-node']);
  });

  it('deletes representations which are removed or hidden', () => {
    const built = build(snapshotOf(), snapshotOf({ key: '1-Membrane' }));
    // Hidden representations are not requested
    const { kept, toBuild, toDelete } = diffRepresentations(built, [snapshotOf()]);
    expect(keys(kept)).toEqual(['0-Protein']);
    expect(toBuild).toEqual([]);
    expect(toDelete.map(previous => previous.ref)).toEqual(['1-Membrane-node']);
  });

  // Their nodes are deleted along with the structure of their component
  it('builds again the representations of rebuilt components', () => {
    const built = build(snapshotOf(), snapshotOf({ key: '1-Pocket', component: 'pocket' }));
    const requested = [snapshotOf(), snapshotOf({ key: '1-Pocket', component: 'pocket' })];
    const { kept, toBuild } = diffRepresentations(built, requested, new Set(['pocket']));
    expect(keys(kept)).toEqual(['0-Protein']);
    expect(toBuild).toEqual([requested[1]]);
  });

  // e.g. a selection typed by the user selects nothing until NGL has parsed the topology
  it('builds again selections which only NGL understands once it is available', () => {
    const nglStructure = {};
    const built = build(snapshotOf({ selection: 'protein' }), snapshotOf({ key: '1-Membrane' }));
    const requested = [snapshotOf({ selection: 'protein', nglStructure }), snapshotOf({ key: '1-Membrane' })];
    const { kept, toBuild } = diffRepresentations(built, requested);
    expect(keys(kept)).toEqual(['1-Membrane']);
    expect(toBuild).toEqual([requested[0]]);
  });

  // e.g. allostery links, which are shapes
  it('builds again distances when anything changes', () => {
    const links = snapshotOf({ key: '0-Links', type: 'distance', other: { atomPair: [[1, 2]] } });
    const built = build(links);
    expect(diffRepresentations(built, [links]).toBuild).toEqual([]);
    const faded = { ...links, opacity: 0.5 };
    const { kept, toBuild } = diffRepresentations(built, [faded]);
    expect(kept).toEqual([]);
    expect(toBuild).toEqual([faded]);
  });
});
