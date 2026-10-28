import { Selection } from 'ngl';

import { rangedSelectionParser } from '../../../utils/auxiliar-functions';
import { toPartialSelection } from '../../ngl-viewer/partial-system';

// Matches the "(:chain and (ranges))" chunks produced by topology.residueIndices2Ngl
// e.g. "(:A and (1, 3-5)) or (:B and (1))"
const NGL_CHAIN_SELECTION_REGEX = /\(:(\S+) and \(([^)]+)\)\)/g;

// Matches the atom index lists produced by topology.atomIndices2Ngl
// e.g. "@1,2,3"
const NGL_ATOMS_SELECTION_REGEX = /@(\d+(?:,\d+)*)/g;

// Matches the selection of a single topology residue (see Residue.nglSelection in the topology manager)
// e.g. ":A and 64" or ":A and 64 ^B", where B is the insertion code
const NGL_RESIDUE_SELECTION_REGEX = /^:(\S+) and (-?\d+)(?: \^(\S+))?$/;

// Matches what joins the chunks above in a selection made only of them
const NGL_JOINERS_REGEX = /\bor\b|[()\s]/g;

// Tell if a selection is one of those built by this app, which are translated with the topology
// i.e. a single residue or chain ranges and atom lists joined by 'or'
const isAppSelection = selection => {
  if (NGL_RESIDUE_SELECTION_REGEX.test(selection)) return true;
  const rest = selection.replace(NGL_CHAIN_SELECTION_REGEX, '').replace(NGL_ATOMS_SELECTION_REGEX, '');
  if (rest === selection) return false;
  return rest.replace(NGL_JOINERS_REGEX, '') === '';
};

// Tell if a selection needs an NGL structure to be translated (e.g. selections typed by the user)
// If only a subset of the system atoms is loaded, this app's selections are still translated with the
// topology, as long as it is known which atoms are loaded (see the subset in nglSelectionToAtomIndices)
export const needsNglSelection = (selection, subset = null) => {
  if (!selection || selection === 'all') return false;
  if (!isAppSelection(selection)) return true;
  return !!subset && !subset.partialSystem;
};

// Get the atoms of the residues in a chain with any of the given numbers, and the given insertion code if any
// As in NGL, a number alone matches every residue with that number, whatever its insertion code
const getResidueAtoms = (topologyManager, chainName, numbers, icode = null) => {
  const chainIndex = topologyManager.chainNames.indexOf(chainName);
  if (chainIndex === -1) {
    console.warn(`Molstar viewer: there is no chain ${chainName} in the topology`);
    return [];
  }
  const { residueNumbers, residueIcodes, residueAtomIndices } = topologyManager;
  const atomIndices = [];
  for (const residueIndex of topologyManager.chainResidueIndices[chainIndex]) {
    if (!numbers.has(residueNumbers[residueIndex])) continue;
    if (icode !== null && residueIcodes[residueIndex] !== icode) continue;
    for (const atomIndex of residueAtomIndices[residueIndex]) atomIndices.push(atomIndex);
  }
  return atomIndices;
};

// Translate one of the selections built by this app into whole system atom indices, with the topology
const appSelectionToAtomIndices = (selection, topologyManager) => {
  const residueMatch = selection.match(NGL_RESIDUE_SELECTION_REGEX);
  if (residueMatch) {
    const [, chainName, residueNumber, icode = null] = residueMatch;
    return getResidueAtoms(topologyManager, chainName, new Set([Number(residueNumber)]), icode);
  }
  // Atoms are pushed one by one, since spreading lists of many atoms overflows the call stack
  const atomIndices = [];
  for (const [, chainName, ranges] of selection.matchAll(NGL_CHAIN_SELECTION_REGEX)) {
    const numbers = new Set(rangedSelectionParser(ranges));
    for (const atomIndex of getResidueAtoms(topologyManager, chainName, numbers)) atomIndices.push(atomIndex);
  }
  for (const [, atoms] of selection.matchAll(NGL_ATOMS_SELECTION_REGEX)) {
    for (const atomIndex of atoms.split(',')) atomIndices.push(Number(atomIndex));
  }
  return atomIndices;
};

// Translate an NGL selection string into a flat list of atom indices
// Returns null when the selection targets the whole structure (no filtering needed)
// The selections built by this app are translated with the topology, which is fast:
// the chain/residue-range grammar produced by topology.residueIndices2Ngl, which is what every
// default representation (protein, ligands, membrane/lipids, ions, ...) uses, the atom lists
// produced by topology.atomIndices2Ngl and the selection of a single residue
// Any other selection is evaluated by NGL in the NGL structure, and selects nothing until it is available
// If only a subset of the system atoms is loaded (e.g. the reduced membrane view) then topology atom indices
// do not match the loaded atoms. This app's selections are then translated to the loaded atoms with the
// subset partial system (see ngl-viewer/partial-system), and atoms which are not loaded are dropped.
// The partial system is null when it is unknown which atoms are loaded (e.g. residue subsets resolved by the
// server), and then every selection is evaluated by NGL in the loaded structure, as in the NGL viewer
export const nglSelectionToAtomIndices = (selection, topologyManager, nglStructure, subset = null) => {
  if (!selection || selection === 'all') return null;
  if (needsNglSelection(selection, subset)) {
    if (!nglStructure) return [];
    const loadedSelection = subset ? toPartialSelection(subset.partialSystem, selection) : selection;
    return Array.from(nglStructure.getAtomIndices(new Selection(loadedSelection)));
  }
  const atomIndices = appSelectionToAtomIndices(selection, topologyManager);
  if (!subset) return atomIndices;
  const { partialIndices } = subset.partialSystem;
  const loadedAtomIndices = [];
  for (const atomIndex of atomIndices) {
    // Atoms which are not loaded are -1, and atoms out of the system are undefined
    const partialIndex = partialIndices[atomIndex];
    if (partialIndex >= 0) loadedAtomIndices.push(partialIndex);
  }
  return loadedAtomIndices;
};
