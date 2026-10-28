import { autoLoad } from 'ngl';

import { getPartialSystem } from '../../ngl-viewer/partial-system';
import { Topology } from '../../../utils/topology-manager';
import { nglSelectionToAtomIndices, needsNglSelection } from '.';

// Build a PDB atom line with its fixed width columns
const atomLine = (serial, name, resName, chain, resSeq) =>
  'ATOM  ' + String(serial).padStart(5) + ' ' + name.padEnd(4) + ' ' + resName.padStart(3) + ' ' +
  chain + String(resSeq).padStart(4) + '    ' + (serial * 1.5).toFixed(3).padStart(8) +
  '   0.000   0.000  1.00  0.00           ' + name[0];
// Alanine and glycine in chain A plus a water in chain B: atoms 0-3, 4-7 and 8
const PDB = [
  ...['N', 'CA', 'C', 'O'].map((name, i) => atomLine(i + 1, name, 'ALA', 'A', 1)),
  ...['N', 'CA', 'C', 'O'].map((name, i) => atomLine(i + 5, name, 'GLY', 'A', 2)),
  atomLine(9, 'O', 'HOH', 'B', 3),
  'END',
].join('\n');
const parseNglStructure = () =>
  autoLoad(new Blob([PDB], { type: 'text/plain' }), { ext: 'pdb' });

// Residues A:1 (atoms 0-1), A:2 (2-3), A:3 (4), B:1 (5-6), A:64 with insertion code B (7) and A:64 (8)
// The insertion code makes every other residue have an empty one, as in topologies from PDB files
const topologyManager = new Topology(
  {
    atom_names: ['N', 'CA', 'N', 'CA', 'CA', 'N', 'CA', 'CA', 'CA'],
    atom_elements: ['N', 'C', 'N', 'C', 'C', 'N', 'C', 'C', 'C'],
    atom_residue_indices: [0, 0, 1, 1, 2, 3, 3, 4, 5],
    residue_names: ['ALA', 'GLY', 'SER', 'ALA', 'THR', 'VAL'],
    residue_numbers: [1, 2, 3, 1, 64, 64],
    residue_icodes: { 4: 'B' },
    residue_chain_indices: [0, 0, 0, 1, 0, 0],
    chain_names: ['A', 'B'],
  },
  {},
  { proteins: [], ligands: [], chains: [], inchikeys: [] },
);

describe('NGL selection to atom indices', () => {
  it('selects the whole structure for "all" or no selection', () => {
    expect(nglSelectionToAtomIndices('all', topologyManager)).toBe(null);
    expect(nglSelectionToAtomIndices(undefined, topologyManager)).toBe(null);
  });

  it('understands the residue ranges made by residueIndices2Ngl', () => {
    const selection = '(:A and (1-2)) or (:B and (1))';
    expect(nglSelectionToAtomIndices(selection, topologyManager)).toEqual([0, 1, 2, 3, 5, 6]);
  });

  // As in NGL, a number selects every residue with that number, whatever its insertion code
  it('selects every residue with the numbers in a range', () => {
    expect(nglSelectionToAtomIndices('(:A and (3, 64))', topologyManager)).toEqual([4, 7, 8]);
  });

  // This is the selection of a single topology residue (e.g. the embed target residue)
  it('understands a single residue selection', () => {
    expect(nglSelectionToAtomIndices(':A and 3', topologyManager)).toEqual([4]);
    expect(nglSelectionToAtomIndices(':A and 64 ^B', topologyManager)).toEqual([7]);
  });

  it('selects nothing in chains which are not in the topology', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(nglSelectionToAtomIndices('(:Z and (1))', topologyManager)).toEqual([]);
  });

  // This is the selection made by topology.atomIndices2Ngl (e.g. interacting agents in domains)
  it('understands atom index lists, also among residue ranges', () => {
    expect(nglSelectionToAtomIndices('(@8,10,12)', topologyManager)).toEqual([8, 10, 12]);
    expect(nglSelectionToAtomIndices('(:A and (1)) or (@9)', topologyManager)).toEqual([0, 1, 9]);
  });

  // Any other selection (e.g. typed by the user) is evaluated by NGL itself
  it('tells which selections need NGL', () => {
    expect(needsNglSelection('all')).toBe(false);
    expect(needsNglSelection(undefined)).toBe(false);
    expect(needsNglSelection('(:A and (1-2)) or (:B and (1))')).toBe(false);
    expect(needsNglSelection('((@8,10)) or ((:A and (1)))')).toBe(false);
    expect(needsNglSelection(':A and 64 ^B')).toBe(false);
    expect(needsNglSelection(':A and 1-20')).toBe(true);
    expect(needsNglSelection('not protein')).toBe(true);
    // Our own selections combined with something else are not ours anymore
    expect(needsNglSelection('(:A and (1-2)) and .CA')).toBe(true);
  });

  it('evaluates any other selection with NGL', async () => {
    const nglStructure = await parseNglStructure();
    const select = selection => nglSelectionToAtomIndices(selection, topologyManager, nglStructure);
    expect(select(':A and 1-2')).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(select('.CA')).toEqual([1, 5]);
    expect(select('not protein')).toEqual([8]);
    expect(select('None')).toEqual([]);
  });

  it('selects nothing while NGL is not available yet', () => {
    expect(nglSelectionToAtomIndices('protein', topologyManager)).toEqual([]);
  });

  // e.g. the reduced membrane view, where topology atom indices do not match the loaded atoms
  it('evaluates every selection with NGL when only a subset of atoms is loaded', async () => {
    const nglStructure = await parseNglStructure();
    // The loaded atoms are whole system atoms 10 to 18
    const subset = { partialSystem: getPartialSystem([10, 11, 12, 13, 14, 15, 16, 17, 18], 20) };
    const select = selection => nglSelectionToAtomIndices(selection, topologyManager, nglStructure, subset);
    expect(select('(:A and (2))')).toEqual([4, 5, 6, 7]);
    // Atom lists are translated to the loaded atoms, and atoms which are not loaded are dropped
    expect(select('@12,19')).toEqual([2]);
    expect(select('@19')).toEqual([]);
    expect(select('all')).toBe(null);
    expect(nglSelectionToAtomIndices('(:A and (2))', topologyManager, null, subset)).toEqual([]);
  });

  it('evaluates selections with NGL also when the loaded atoms are unknown', async () => {
    const nglStructure = await parseNglStructure();
    // e.g. residue subsets, where the server resolves which atoms are loaded
    const subset = { partialSystem: null };
    expect(nglSelectionToAtomIndices(':A and 1', topologyManager, nglStructure, subset)).toEqual([0, 1, 2, 3]);
  });
});
