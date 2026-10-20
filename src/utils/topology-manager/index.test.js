jest.mock('ngl', () => ({}));

// jsdom lacks Set.prototype.union, which the topology manager uses when it loads
if (!Set.prototype.union) Set.prototype.union = function (other) {
  const union = new Set(this);
  other.forEach(value => union.add(value));
  return union;
};
const { Topology } = require('.');

// A single chain with many residues, as in solvated or membrane systems where one chain holds most atoms
const RESIDUES = 30000;
const ATOMS_PER_RESIDUE = 10;
const ATOMS = RESIDUES * ATOMS_PER_RESIDUE;

const makeTopology = () => new Topology(
  {
    atom_names: Array(ATOMS).fill('OW'),
    atom_elements: Array(ATOMS).fill('O'),
    atom_residue_indices: Array.from({ length: ATOMS }, (_, atomIndex) => Math.floor(atomIndex / ATOMS_PER_RESIDUE)),
    residue_names: Array(RESIDUES).fill('SOL'),
    residue_numbers: Array.from({ length: RESIDUES }, (_, residueIndex) => residueIndex + 1),
    residue_chain_indices: Array(RESIDUES).fill(0),
    chain_names: ['A'],
  },
  {},
  { proteins: [], ligands: [], chains: [], inchikeys: [] },
);

const allAtomIndices = Array.from({ length: ATOMS }, (_, atomIndex) => atomIndex);

// Concatenating residue after residue copied the growing list every time: seconds for big chains
// (16 s for A05PJ, whose topology selections include a chain of 936,065 atoms)
describe('atom indices of large chains', () => {
  it('lists the atoms of a chain in order, fast', () => {
    const chain = makeTopology().getChainByIndex(0);
    const start = Date.now();
    const atomIndices = chain.atomIndices;
    expect(Date.now() - start).toBeLessThan(1000);
    expect(atomIndices).toEqual(allAtomIndices);
  });

  it('converts many residues to atoms in order, fast', () => {
    const topology = makeTopology();
    const residueIndices = Array.from({ length: RESIDUES }, (_, residueIndex) => residueIndex);
    const start = Date.now();
    const atomIndices = topology.residue2atomIndices(residueIndices);
    expect(Date.now() - start).toBeLessThan(1000);
    expect(atomIndices).toEqual(allAtomIndices);
  });
});
