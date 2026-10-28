import { ColormakerRegistry } from 'ngl';
import { Color } from 'molstar/lib/mol-util/color';
import { StructureElement, StructureProperties, Bond } from 'molstar/lib/mol-model/structure';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';

// Analysis pages color the structure with NGL color schemes (see ColormakerRegistry in NGL)
// Molstar paints them with a color theme which looks up the color of every atom by its index in the topology
// These colors are calculated once with NGL itself, in an NGL structure of the same topology

// The atom colors of every scheme, by an id which is the only parameter of the molstar theme
// This way molstar does not compare big color arrays every time it checks if the theme changed
const schemeColors = new Map();
// Number every NGL structure, since the same scheme gives different colors in different structures
const structureNumbers = new WeakMap();
let structureCount = 0;

// The color of atoms with no color, which should never happen
const MISSING_COLOR = Color(0xffffff);

export const NGL_SCHEME_THEME = 'ngl-scheme';

const location = StructureElement.Location.create();
const getColor = (colors, unit, element) => {
  location.unit = unit;
  location.element = element;
  const color = colors[StructureProperties.atom.sourceIndex(location)];
  return color === undefined ? MISSING_COLOR : Color(color);
};

export const NglSchemeColorThemeProvider = {
  name: NGL_SCHEME_THEME,
  label: 'NGL color scheme',
  category: 'Misc',
  factory: (ctx, props) => {
    const colors = schemeColors.get(props.id) || [];
    const color = target => {
      if (StructureElement.Location.is(target)) return getColor(colors, target.unit, target.element);
      // Bonds are colored as their first atom
      if (Bond.isLocation(target)) return getColor(colors, target.aUnit, target.aUnit.elements[target.aIndex]);
      return MISSING_COLOR;
    };
    return {
      factory: NglSchemeColorThemeProvider.factory,
      granularity: 'group',
      color,
      props,
      description: 'Colors of an NGL color scheme',
    };
  },
  getParams: () => ({ id: PD.Text('') }),
  defaultValues: { id: '' },
  isApplicable: () => true,
};

// Get the molstar color theme of an NGL color scheme in a given NGL structure
// The atoms of the structure must be those of the molstar structure, in the same order
export const nglSchemeToTheme = (nglStructure, schemeId) => {
  if (!structureNumbers.has(nglStructure)) structureNumbers.set(nglStructure, ++structureCount);
  const id = `${schemeId}@${structureNumbers.get(nglStructure)}`;
  if (!schemeColors.has(id)) {
    const colormaker = ColormakerRegistry.getScheme({ scheme: schemeId, structure: nglStructure });
    const colors = new Uint32Array(nglStructure.atomStore.count);
    nglStructure.eachAtom(atom => { colors[atom.index] = colormaker.atomColor(atom) });
    schemeColors.set(id, colors);
  }
  return { name: NGL_SCHEME_THEME, params: { id } };
};
