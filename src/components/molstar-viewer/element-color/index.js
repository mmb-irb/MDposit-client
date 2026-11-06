import { Color } from 'molstar/lib/mol-util/color';
import { StructureElement, Unit, Bond } from 'molstar/lib/mol-model/structure';
import { ElementSymbolColors } from 'molstar/lib/mol-theme/color/element-symbol';

// The molstar version of the improved NGL 'element' color scheme (see ngl-viewer/element-colormaker)
// Molstar's own 'element-symbol' theme differs from it in three ways, which made both viewers look different:
// - Elements it does not know are white, and coarse-grain beads usually have none (e.g. 'CG')
//   Here they take the color of the first letter of the atom name instead, like in VMD and in NGL
// - Carbons take the chain color, while NGL paints them grey
// - Every color is made lighter, while NGL uses the table as it is
// Both viewers use the same Jmol table of element colors

export const ELEMENT_THEME = 'element-cg';

// NGL's color for anything it does not recognise (white)
const DEFAULT_ELEMENT_COLOR = Color(0xffffff);

// Get the color of an element, or nothing if it is not a known element
const knownElementColor = symbol => ElementSymbolColors[(symbol || '').toUpperCase()];

// Get the color of an atom from its element, or from the first letter of its name if the element is unknown
export const getElementColor = (element, atomName) => {
  const color = knownElementColor(element);
  if (color !== undefined) return color;
  const firstLetter = (atomName || '').trim().charAt(0);
  const nameColor = knownElementColor(firstLetter);
  return nameColor === undefined ? DEFAULT_ELEMENT_COLOR : nameColor;
};

const getAtomColor = (unit, element) => {
  if (!Unit.isAtomic(unit)) return DEFAULT_ELEMENT_COLOR;
  const { type_symbol, label_atom_id } = unit.model.atomicHierarchy.atoms;
  return getElementColor(type_symbol.value(element), label_atom_id.value(element));
};

export const ElementColorThemeProvider = {
  name: ELEMENT_THEME,
  label: 'Element (coarse-grain beads by name)',
  category: 'Atom Property',
  factory: (ctx, props) => {
    const color = target => {
      if (StructureElement.Location.is(target)) return getAtomColor(target.unit, target.element);
      // Bonds are colored as their first atom
      if (Bond.isLocation(target)) return getAtomColor(target.aUnit, target.aUnit.elements[target.aIndex]);
      return DEFAULT_ELEMENT_COLOR;
    };
    return {
      factory: ElementColorThemeProvider.factory,
      granularity: 'group',
      preferSmoothing: true,
      color,
      props,
      description: 'Colors atoms by element, and coarse-grain beads by the first letter of their name',
    };
  },
  getParams: () => ({}),
  defaultValues: {},
  isApplicable: ctx => !!ctx.structure,
};
