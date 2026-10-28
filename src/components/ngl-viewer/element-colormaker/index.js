import { ColormakerRegistry } from 'ngl';

// Improved "element" color scheme for NGL
// ----------------------------------------
// NGL's built-in 'element' color scheme colors known elements using a CPK-like
// table and falls back to plain white for anything it does not recognise. This
// is a problem for coarse-grain simulations, where atoms/beads have a wide range
// of non-standard names (e.g. MARTINI beads such as 'BB', 'SC1', 'Q0', ...): they
// all end up white and become impossible to tell apart.
//
// Instead of white, we fall back to coloring by the first letter of the atom name
// (treated as an element), the way VMD does. So a 'BB' bead is colored as boron,
// 'SC1' as sulfur, 'CA' as carbon, etc.
//
// NGL does not export its ElementColors table as a named export, so rather than
// copying it we reuse it through an instance of the built-in 'element' colormaker:
// its atomColor only reads `.element`, so we can look up the color for any symbol.
const builtinElementScheme = ColormakerRegistry.getScheme({ scheme: 'element' });

// NGL's default color for elements missing from its table (white).
const DEFAULT_ELEMENT_COLOR = 0xffffff;

// Look up the CPK color for an element symbol via NGL's own table.
const elementColor = symbol =>
  builtinElementScheme.atomColor({ element: (symbol || '').toUpperCase() });

// Cache: registering a new scheme on every render would leak schemes into NGL's
// global registry, so we register once and reuse the returned id.
let schemeId;

// Return the id of the improved element color scheme, registering it on first use.
const getElementColorSchemeId = () => {
  if (schemeId !== undefined) return schemeId;
  schemeId = ColormakerRegistry.addScheme(function () {
    this.atomColor = atom => {
      // Make sure the atom has atomType
      // Otherwise trying to get the element will raise a killing error
      // DANI: El misterioso caso de https://mdposit-dev.mddbr.eu/#/embed/mmb-A05KX?resindices=0
      // DANI: No entiendo que átomo causa esto, todos parecen estar bien
      if (!atom.atomType) return DEFAULT_ELEMENT_COLOR;
      // Use the standard CPK color when the atom's element is recognised
      const color = elementColor(atom.element);
      if (color !== DEFAULT_ELEMENT_COLOR) return color;
      // Otherwise (typically a coarse-grain bead) fall back to the first letter
      // of the atom name, like VMD. Note: for hydrogen this still resolves to
      // white, since both the 'H' element and 'H'-starting names map to white.
      const firstLetter = (atom.atomname || '').trim().charAt(0);
      return elementColor(firstLetter);
    };
  }, 'element-cg');
  return schemeId;
};

export default getElementColorSchemeId;
