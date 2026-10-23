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

// Legacy topology (no selections) with 6 residues of 3 atoms: residues 0-1 are MC3, a synthetic lipid missing in the
// lipid databases, residues 2-3 are POPC, residue 4 is a ligand and residue 5 is water
const MEMBRANE_RESIDUES = ['MC3', 'MC3', 'POPC', 'POPC', 'LIG', 'SOL'];
const NO_LIPID_DATA = { swisslipids: null, lipidmaps: null };
const INCHIKEY_REFERENCES = [
  { inchikey: 'MC3-KEY', ...NO_LIPID_DATA, lipid: { category: 'FA', forced: false } },
  { inchikey: 'POPC-KEY', swisslipids: null, lipidmaps: { name: 'PC(16:0/18:1(9Z))', synonyms: 'POPC' } },
  { inchikey: 'LIG-KEY', ...NO_LIPID_DATA, lipid: null },
];
const makeMembraneTopology = membraneMapping => new Topology(
  {
    atom_names: MEMBRANE_RESIDUES.flatMap(name => name === 'SOL' ? ['OW', 'HW1', 'HW2'] : ['N', 'C1', 'C2']),
    atom_elements: MEMBRANE_RESIDUES.flatMap(name => name === 'SOL' ? ['O', 'H', 'H'] : ['N', 'C', 'C']),
    atom_residue_indices: MEMBRANE_RESIDUES.flatMap((_, residueIndex) => [residueIndex, residueIndex, residueIndex]),
    residue_names: MEMBRANE_RESIDUES,
    residue_numbers: MEMBRANE_RESIDUES.map((_, residueIndex) => residueIndex + 1),
    residue_chain_indices: MEMBRANE_RESIDUES.map(() => 0),
    chain_names: ['A'],
    references: INCHIKEY_REFERENCES.map(reference => reference.inchikey),
    reference_types: INCHIKEY_REFERENCES.map(() => 'inchikey'),
    residue_reference_indices: [0, 0, 1, 1, 2, null],
  },
  {},
  { proteins: [], ligands: [], chains: [], inchikeys: INCHIKEY_REFERENCES },
  membraneMapping,
);
const classifications = topology => MEMBRANE_RESIDUES.map((_, residueIndex) =>
  topology.getResidueByIndex(residueIndex).classification);

// Membrane map 0.3.0 of a lipid nanoparticle in a vesicle: MC3 in a micelle and POPC in the vesicle leaflets
const LNP_MEMBRANE_MAPPING = {
  n_mems: 2,
  mems: {
    0: { type: 'micelle', leaflets: { outer: [0, 1, 2, 3, 4, 5] }, polar_atoms: { outer: [0, 3] } },
    1: {
      type: 'vesicle',
      leaflets: { outer: [6, 7, 8], inner: [9, 10, 11], midplane: [] },
      polar_atoms: { outer: [6], inner: [9], midplane: [] },
    },
  },
  no_mem_lipid: [],
  version: '0.3.0',
};

describe('membranes', () => {
  it('classifies lipids in every leaflet as lipids, even if they are missing in the lipid databases', () => {
    const topology = makeMembraneTopology(LNP_MEMBRANE_MAPPING);
    expect(classifications(topology)).toEqual(['lipid', 'lipid', 'lipid', 'lipid', 'ligand', 'solvent']);
  });

  it('keeps the polar atoms of every leaflet of vesicles and micelles in the reduced membrane view', () => {
    const topology = makeMembraneTopology(LNP_MEMBRANE_MAPPING);
    // Polar atoms of the micelle and the vesicle, then the ligand atoms
    expect(topology.membraneViewerSelection.atomIndices).toEqual([0, 3, 6, 9, 12, 13, 14]);
    expect(topology.membraneViewerSelection.residueIndices).toEqual([0, 1, 2, 3, 4]);
  });

  it('reads old membrane maps, with bilayers only and lipids out of membranes', () => {
    // Membrane map 0.2.0: no aggregate type, and MC3 is out of membranes
    const topology = makeMembraneTopology({
      n_mems: 1,
      mems: { 0: { leaflets: { top: [6, 7, 8], bot: [9, 10, 11] }, polar_atoms: { top: [6], bot: [9] } } },
      no_mem_lipid: [0, 1, 2, 3, 4, 5],
    });
    expect(classifications(topology)).toEqual(['ligand', 'ligand', 'lipid', 'lipid', 'ligand', 'solvent']);
    expect(topology.membraneViewerSelection.atomIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 9, 12, 13, 14]);
  });

  it('does not reduce systems without membrane map', () => {
    const topology = makeMembraneTopology(null);
    expect(topology.membraneViewerSelection).toBeNull();
    // Lipids with lipid database data and no membrane map fall back to their residue names
    expect(classifications(topology)).toEqual(['ligand', 'ligand', 'fatty', 'fatty', 'ligand', 'solvent']);
  });
});
