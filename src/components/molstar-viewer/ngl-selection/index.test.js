import { nglSelectionToAtomIndices } from '.';

// Atom indices of each residue, by chain, number and insertion code
const RESIDUE_ATOMS = {
  'A:1': [0, 1],
  'A:2': [2, 3],
  'A:3': [4],
  'A:64:B': [7],
  'B:1': [5, 6],
};
const topologyManager = {
  getResidueByParameters: (chainName, number, icode = null) => {
    const key = [chainName, number, icode].filter(value => value !== null).join(':');
    if (!RESIDUE_ATOMS[key]) throw new Error(`No residue ${key}`);
    return { atomIndices: RESIDUE_ATOMS[key] };
  },
};

describe('NGL selection to atom indices', () => {
  it('selects the whole structure for "all" or no selection', () => {
    expect(nglSelectionToAtomIndices('all', topologyManager)).toBe(null);
    expect(nglSelectionToAtomIndices(undefined, topologyManager)).toBe(null);
  });

  it('understands the residue ranges made by residueIndices2Ngl', () => {
    const selection = '(:A and (1-2)) or (:B and (1))';
    expect(nglSelectionToAtomIndices(selection, topologyManager)).toEqual([0, 1, 2, 3, 5, 6]);
  });

  // This is the selection of a single topology residue (e.g. the embed target residue)
  it('understands a single residue selection', () => {
    expect(nglSelectionToAtomIndices(':A and 3', topologyManager)).toEqual([4]);
    expect(nglSelectionToAtomIndices(':A and 64 ^B', topologyManager)).toEqual([7]);
  });

  // This is the selection made by topology.atomIndices2Ngl (e.g. interacting agents in domains)
  it('understands atom index lists, also among residue ranges', () => {
    expect(nglSelectionToAtomIndices('(@8,10,12)', topologyManager)).toEqual([8, 10, 12]);
    expect(nglSelectionToAtomIndices('(:A and (1)) or (@9)', topologyManager)).toEqual([0, 1, 9]);
  });

  it('selects the whole structure for selections it does not understand', () => {
    expect(nglSelectionToAtomIndices('protein', topologyManager)).toBe(null);
  });
});
