import { Bond, StructureElement, StructureProperties } from 'molstar/lib/mol-model/structure';
import { OrderedSet } from 'molstar/lib/mol-data/int';
import { ShapeGroup } from 'molstar/lib/mol-model/shape';

import { ATOM_PAIRS_SHAPE } from '../atom-pairs';

// Get an atom of a molstar structure: its index in the loaded topology, its name and its residue name
const hoverLocation = StructureElement.Location.create();
const getLoadedAtom = (structure, unit, element) => {
  StructureElement.Location.set(hoverLocation, structure, unit, element);
  return {
    index: StructureProperties.atom.sourceIndex(hoverLocation),
    name: StructureProperties.atom.label_atom_id(hoverLocation),
    residueName: StructureProperties.atom.label_comp_id(hoverLocation),
  };
};

// Get the atoms under the mouse from a molstar hovered loci: an atom or both atoms of a bond
export const getHoveredAtoms = loci => {
  if (StructureElement.Loci.is(loci) && loci.elements.length > 0) {
    const { unit, indices } = loci.elements[0];
    return [getLoadedAtom(loci.structure, unit, unit.elements[OrderedSet.getAt(indices, 0)])];
  }
  if (Bond.isLoci(loci) && loci.bonds.length > 0) {
    const { aUnit, aIndex, bUnit, bIndex } = loci.bonds[0];
    return [
      getLoadedAtom(loci.structure, aUnit, aUnit.elements[aIndex]),
      getLoadedAtom(loci.structure, bUnit, bUnit.elements[bIndex]),
    ];
  }
  return null;
};

// Get the atoms of a hovered link between two atoms (see createAtomPairsShape) and their distance
export const getHoveredAtomPair = loci => {
  if (!ShapeGroup.isLoci(loci) || loci.shape.name !== ATOM_PAIRS_SHAPE || loci.groups.length === 0) return null;
  // Every link is made of 2 groups, one per half
  const group = OrderedSet.getAt(loci.groups[0].ids, 0);
  const { locations, length } = loci.shape.sourceData.pairs[Math.floor(group / 2)];
  return {
    atoms: locations.map(({ structure, unit, element }) => getLoadedAtom(structure, unit, element)),
    length,
  };
};
