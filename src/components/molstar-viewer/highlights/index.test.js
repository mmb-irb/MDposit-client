import { getHighlights } from '.';

// Residue 0 has atoms 0-2 and residue 1 atoms 3-4
const RESIDUES = [{ atomIndices: [0, 1, 2] }, { atomIndices: [3, 4] }];
const topologyManager = {
  getResidueByIndex: index => RESIDUES[index],
  getAtomByIndex: index => ({ residue: RESIDUES[index < 3 ? 0 : 1] }),
};
const highlightTypes = { atoms: 'spacefill', residues: 'ball+stick' };

describe('highlights', () => {
  it('highlights nothing by default', () => {
    expect(getHighlights({ topologyManager, highlightTypes })).toEqual([]);
  });

  // As the NGL viewer: the atoms, faded and bigger, and their whole residues, which are focused
  it('highlights the selected atoms and their residues', () => {
    const highlights = getHighlights({ topologyManager, highlightTypes, selectedAtoms: new Set([1, 4]) });
    expect(highlights).toEqual([
      { selection: '@1,4', type: 'spacefill', opacity: 0.5, sizeFactor: 1.5 },
      { selection: '@0,1,2,3,4', type: 'ball+stick', focus: true },
    ]);
  });

  it('highlights the selected residues and focuses them', () => {
    const highlights = getHighlights({ topologyManager, highlightTypes, selectedResidueIndices: [1] });
    expect(highlights).toEqual([{ selection: '@3,4', type: 'ball+stick', focus: true }]);
  });

  it('adds the snap representations as they are', () => {
    const snap = { name: 'Epitope', selection: ':A and 5', type: 'spacefill', color: 'red', opacity: 0.15 };
    expect(getHighlights({ topologyManager, highlightTypes, snapRepresentations: [snap] })).toEqual([
      { selection: ':A and 5', type: 'spacefill', color: 'red', opacity: 0.15, label: 'Epitope' },
    ]);
  });
});
