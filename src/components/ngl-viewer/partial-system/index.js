import { ColormakerRegistry } from 'ngl';

// Tools to work with NGL components which contain only a subset of the system atoms
// e.g. the reduced membrane view or PCA projections
// NGL numbers the loaded atoms from 0, so its atom indices (and its residue indices) do not match the
// whole system indices anymore. Atom indices passed to the viewer (selections, highlights, distances,
// etc.) are always whole system indices, so they must be translated before reaching NGL.
// Similarly, atoms coming from NGL (e.g. hovered atoms) must be translated back to whole system indices.

// Set the partial system of a component from its atom indices
// Return null if the component contains the whole system
export const getPartialSystem = (atomIndices, atomCount) => {
  if (!atomIndices || atomIndices.length >= atomCount) return null;
  // Whole system atom index -> partial system atom index (-1 when the atom is not loaded)
  const partialIndices = new Int32Array(atomCount).fill(-1);
  atomIndices.forEach((wholeIndex, partialIndex) => { partialIndices[wholeIndex] = partialIndex });
  return { wholeIndices: atomIndices, partialIndices };
};

// Get the partial system index of a whole system atom index
// Return null if the atom is not loaded
export const toPartialAtomIndex = (partialSystem, wholeIndex) => {
  if (!partialSystem) return wholeIndex;
  const partialIndex = partialSystem.partialIndices[wholeIndex];
  if (partialIndex === undefined)
    throw new Error(`Atom index ${wholeIndex} is out of the system`);
  return partialIndex === -1 ? null : partialIndex;
};

// Get the whole system index of a partial system atom index
export const toWholeAtomIndex = (partialSystem, partialIndex) => {
  if (!partialSystem) return partialIndex;
  const wholeIndex = partialSystem.wholeIndices[partialIndex];
  if (wholeIndex === undefined)
    throw new Error(`Atom index ${partialIndex} is out of the partial system`);
  return wholeIndex;
};

// Translate the atom indices in an NGL selection (e.g. '@1,2,3') to the partial system
// Atoms which are not loaded are dropped and an atom list with no loaded atoms becomes 'NONE'
export const toPartialSelection = (partialSystem, selection) => {
  if (!partialSystem || typeof selection !== 'string') return selection;
  return selection.replace(/@([\d,]+)/g, (match, atomList) => {
    const partialAtoms = atomList.split(',')
      .map(atomIndex => toPartialAtomIndex(partialSystem, +atomIndex))
      .filter(partialIndex => partialIndex !== null);
    return partialAtoms.length > 0 ? '@' + partialAtoms.join(',') : 'NONE';
  });
};

// Translate groups of atom indices (e.g. distance pairs or angle triples) to the partial system
// Groups with any atom which is not loaded are dropped
// Groups which are not made of atom indices (e.g. residue selections) are left as they are
export const toPartialAtomGroups = (partialSystem, groups) => {
  if (!partialSystem || !groups) return groups;
  return groups
    .map(group => group.map(item => typeof item === 'number'
      ? toPartialAtomIndex(partialSystem, item)
      : item))
    .filter(group => group.every(item => item !== null));
};

// Wrap an NGL atom to show whole system atom and residue indices
// Note that the rest of atom properties are read from the original NGL atom
const toWholeAtom = (partialSystem, topology, atom) => new Proxy(atom, {
  get: (target, property) => {
    if (property === 'index') return toWholeAtomIndex(partialSystem, target.index);
    if (property === 'residueIndex')
      return topology.atomResidueIndices[toWholeAtomIndex(partialSystem, target.index)];
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

// Wrap a custom color scheme so it receives atoms with whole system atom and residue indices
// Custom color schemes are made to color the whole system (e.g. a color per residue index)
// Wrappers are cached in the partial system to avoid registering a new scheme in NGL every time
export const toPartialColorScheme = (partialSystem, topology, schemeId) => {
  if (!partialSystem) return schemeId;
  if (!partialSystem.colorSchemes) partialSystem.colorSchemes = {};
  const cached = partialSystem.colorSchemes[schemeId];
  if (cached) return cached;
  const wrapperId = ColormakerRegistry.addScheme(function (params) {
    const colormaker = ColormakerRegistry.getScheme({ ...params, scheme: schemeId });
    this.atomColor = atom => colormaker.atomColor(toWholeAtom(partialSystem, topology, atom));
  }, 'partial system');
  partialSystem.colorSchemes[schemeId] = wrapperId;
  return wrapperId;
};
