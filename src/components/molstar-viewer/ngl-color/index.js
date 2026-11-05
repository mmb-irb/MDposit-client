import { Color } from 'molstar/lib/mol-util/color';
import { ColorNames } from 'molstar/lib/mol-util/color/names';
import { ELEMENT_THEME } from '../element-color';

// Map NGL coloring methods (the ones offered in the representations panel) to molstar color themes
const COLOR_THEMES = {
  chainid: 'chain-id',
  resname: 'residue-name',
  // Not molstar's 'element-symbol', which paints coarse-grain beads white and carbons by chain (see element-color)
  element: ELEMENT_THEME,
  // Molstar colors the B factor as 'uncertainty'
  bfactor: 'uncertainty',
  // NGL colors electrostatic by residue charge
  electrostatic: 'residue-charge',
  sstruc: 'secondary-structure',
};
// NGL paints the 'uniform' coloring method in white by default
const NGL_UNIFORM_COLOR = 0xffffff;

// Matches hexadecimal colors, both long and short (e.g. "#e60000" or "#0f0")
const HEX_COLOR_REGEX = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i;

// Get the molstar color theme for one of this app's NGL representation colors
// It may be a coloring method, a color name (any CSS color name, as in NGL) or a hexadecimal color
// Unknown colors are colored by chain
export const nglColorToTheme = color => {
  const themeName = COLOR_THEMES[color];
  if (themeName) return { name: themeName };
  if (color === 'uniform') return { name: 'uniform', params: { value: Color(NGL_UNIFORM_COLOR) } };
  if (typeof color !== 'string') return { name: 'chain-id' };
  // NGL ignores the case of color names
  const namedColor = ColorNames[color.toLowerCase()];
  if (namedColor !== undefined) return { name: 'uniform', params: { value: namedColor } };
  const hexMatch = color.match(HEX_COLOR_REGEX);
  if (hexMatch) {
    // Expand short hexadecimal colors by doubling every digit
    const digits = hexMatch[1].length === 3
      ? hexMatch[1].split('').map(digit => digit + digit).join('')
      : hexMatch[1];
    return { name: 'uniform', params: { value: Color.fromHexStyle(`#${digits}`) } };
  }
  return { name: 'chain-id' };
};
