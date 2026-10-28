import { getMembraneReducedComponents } from '.';

const REDUCED = [0, 2, 5];

describe('getMembraneReducedComponents', () => {
  it('reduces every component sharing the main component topology', () => {
    // e.g. the two frames in the RMSD pairwise viewer
    const components = [
      { name: 'Frame A', topologyURL: '/structure', frame: 3 },
      { name: 'Frame B', topologyURL: '/structure', frame: 7 },
    ];
    const reduced = getMembraneReducedComponents(components, REDUCED);
    expect(reduced.map(comp => comp.atomIndices)).toEqual([REDUCED, REDUCED]);
    expect(reduced.map(comp => comp.frame)).toEqual([3, 7]);
  });

  it('leaves components with their own topology as they are', () => {
    const pocket = { name: 'Pocket', topologyURL: '/files/pocket.pdb', onlyTopology: true };
    const components = [{ name: 'Main', topologyURL: '/structure' }, pocket];
    const reduced = getMembraneReducedComponents(components, REDUCED);
    expect(reduced[0].atomIndices).toBe(REDUCED);
    expect(reduced[1]).toBe(pocket);
  });

  it('does not modify the original components', () => {
    const components = [{ name: 'Main', topologyURL: '/structure' }];
    getMembraneReducedComponents(components, REDUCED);
    expect(components[0].atomIndices).toBeUndefined();
  });
});
