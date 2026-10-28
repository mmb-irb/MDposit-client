import { Bond, StructureElement, StructureProperties } from 'molstar/lib/mol-model/structure';
import { OrderedSet } from 'molstar/lib/mol-data/int';

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
