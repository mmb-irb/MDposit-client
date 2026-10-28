// Set the highlight representations, which are added on top of the regular representations, as in the NGL viewer
// Atoms and residues are given as whole system atom lists, so they are translated to the loaded atoms in subsets
// The highlight marked as 'focus' is to be focused by the camera
export const getHighlights = ({
  topologyManager,
  highlightTypes,
  selectedAtoms,
  selectedResidueIndices,
  snapRepresentations,
}) => {
  if (!topologyManager) return [];
  const highlights = [];
  // Atoms are faded and bigger, so their whole residues are visible inside
  const atoms = selectedAtoms ? Array.from(selectedAtoms) : [];
  if (atoms.length > 0) {
    highlights.push({ selection: '@' + atoms.join(','), type: highlightTypes.atoms, opacity: 0.5, sizeFactor: 1.5 });
    const residueAtoms = new Set(atoms.flatMap(atomIndex =>
      topologyManager.getAtomByIndex(atomIndex).residue.atomIndices));
    highlights.push({ selection: '@' + [...residueAtoms].join(','), type: highlightTypes.residues, focus: true });
  }
  if (selectedResidueIndices && selectedResidueIndices.length > 0) {
    const residueAtoms = selectedResidueIndices.flatMap(residueIndex =>
      topologyManager.getResidueByIndex(residueIndex).atomIndices);
    highlights.push({ selection: '@' + residueAtoms.join(','), type: highlightTypes.residues, focus: true });
  }
  // Snap representations are added as they are
  (snapRepresentations || []).forEach(({ name, selection, type, color, opacity }) => {
    highlights.push({ selection, type, color, opacity, label: name });
  });
  return highlights;
};
