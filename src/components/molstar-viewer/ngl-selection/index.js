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
export const needsNglSelection = selection =>
  !!selection && selection !== 'all' && !isAppSelection(selection);

// Translate an NGL selection string into a flat list of atom indices
// Returns null when the selection targets the whole structure (no filtering needed)
// The selections built by this app are translated with the topology, which is fast:
// the chain/residue-range grammar produced by topology.residueIndices2Ngl, which is what every
// default representation (protein, ligands, membrane/lipids, ions, ...) uses, the atom lists
// produced by topology.atomIndices2Ngl and the selection of a single residue
// Any other selection is evaluated by NGL in the NGL structure, and selects nothing until it is available
// If only a subset of the system atoms is loaded (e.g. the reduced membrane view) then topology atom indices
// do not match the loaded atoms, so every selection is evaluated by NGL in the loaded structure, as in the
// NGL viewer. Atom lists are translated with the subset partial system (see ngl-viewer/partial-system),
// which is null when it is unknown which atoms are loaded (e.g. residue subsets resolved by the server)
export const nglSelectionToAtomIndices = (selection, topologyManager, nglStructure, subset = null) => {
  if (!selection || selection === 'all') return null;
  if (subset || !isAppSelection(selection)) {
    if (!nglStructure) return [];
    const loadedSelection = subset ? toPartialSelection(subset.partialSystem, selection) : selection;
    return Array.from(nglStructure.getAtomIndices(new Selection(loadedSelection)));
  }
  const residueMatch = selection.match(NGL_RESIDUE_SELECTION_REGEX);
  if (residueMatch) {
    const [, chainName, residueNumber, icode = null] = residueMatch;
    try {
      return topologyManager.getResidueByParameters(chainName, Number(residueNumber), icode).atomIndices;
    } catch (error) {
      console.warn('Molstar viewer: could not resolve residue for selection', selection, error);
      return [];
    }
  }
  const atomIndices = [];
  let match;
  NGL_CHAIN_SELECTION_REGEX.lastIndex = 0;
  while ((match = NGL_CHAIN_SELECTION_REGEX.exec(selection))) {
    const [, chainName, ranges] = match;
    for (const residueNumber of rangedSelectionParser(ranges)) {
      try {
        const residue = topologyManager.getResidueByParameters(chainName, residueNumber);
        atomIndices.push(...residue.atomIndices);
      } catch (error) {
        console.warn('Molstar viewer: could not resolve residue for selection', selection, error);
      }
    }
  }
  NGL_ATOMS_SELECTION_REGEX.lastIndex = 0;
  while ((match = NGL_ATOMS_SELECTION_REGEX.exec(selection))) {
    atomIndices.push(...match[1].split(',').map(Number));
  }
  return atomIndices;
};
