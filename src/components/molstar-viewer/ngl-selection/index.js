import { rangedSelectionParser } from '../../../utils/auxiliar-functions';

// Matches the "(:chain and (ranges))" chunks produced by topology.residueIndices2Ngl
// e.g. "(:A and (1, 3-5)) or (:B and (1))"
const NGL_CHAIN_SELECTION_REGEX = /\(:(\S+) and \(([^)]+)\)\)/g;

// Matches the atom index lists produced by topology.atomIndices2Ngl
// e.g. "@1,2,3"
const NGL_ATOMS_SELECTION_REGEX = /@(\d+(?:,\d+)*)/g;

// Matches the selection of a single topology residue (see Residue.nglSelection in the topology manager)
// e.g. ":A and 64" or ":A and 64 ^B", where B is the insertion code
const NGL_RESIDUE_SELECTION_REGEX = /^:(\S+) and (-?\d+)(?: \^(\S+))?$/;

// Translate one of this app's NGL selection strings into a flat list of atom indices
// Returns null when the selection targets the whole structure (no filtering needed)
// Only understands the chain/residue-range grammar produced by topology.residueIndices2Ngl,
// which is what every default representation (protein, ligands, membrane/lipids, ions, ...) uses,
// the atom lists produced by topology.atomIndices2Ngl and the selection of a single residue
// Arbitrary/custom NGL selections are not supported and fall back to representing the whole structure
export const nglSelectionToAtomIndices = (selection, topologyManager) => {
  if (!selection || selection === 'all') return null;
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
  let matched = false;
  let match;
  NGL_CHAIN_SELECTION_REGEX.lastIndex = 0;
  while ((match = NGL_CHAIN_SELECTION_REGEX.exec(selection))) {
    matched = true;
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
    matched = true;
    atomIndices.push(...match[1].split(',').map(Number));
  }
  if (!matched) return null;
  return atomIndices;
};
