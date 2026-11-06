import { Color } from 'molstar/lib/mol-util/color';

import { getElementColor, ElementColorThemeProvider } from '.';

// Jmol colors, the same in NGL and molstar
const CARBON = Color(0x909090);
const NITROGEN = Color(0x3050f8);
const PHOSPHORUS = Color(0xff8000);
const BORON = Color(0xffb5b5);
const WHITE = Color(0xffffff);

describe('getElementColor', () => {
  // Molstar's 'element-symbol' would color carbons by chain and make every color lighter
  it('colors known elements as NGL does, carbons in grey', () => {
    expect(getElementColor('C', 'CA')).toBe(CARBON);
    expect(getElementColor('N', 'N')).toBe(NITROGEN);
  });

  it('ignores the case of the element', () => {
    expect(getElementColor('c', 'CA')).toBe(CARBON);
  });

  // e.g. MARTINI beads, whose element is 'CG' in the MDDB topologies
  it('colors coarse-grain beads by the first letter of their name', () => {
    expect(getElementColor('CG', 'BB')).toBe(BORON);
    expect(getElementColor('CG', 'NC3')).toBe(NITROGEN);
    expect(getElementColor('CG', 'PO4')).toBe(PHOSPHORUS);
    expect(getElementColor('CG', ' C1A')).toBe(CARBON);
  });

  it('colors white what no letter can tell', () => {
    expect(getElementColor('CG', 'GL1')).toBe(WHITE);
    expect(getElementColor(undefined, undefined)).toBe(WHITE);
  });
});

describe('ElementColorThemeProvider', () => {
  // An atomic unit of two beads with an unknown element
  const unit = {
    kind: 0,
    model: {
      atomicHierarchy: {
        atoms: {
          type_symbol: { value: () => 'CG' },
          label_atom_id: { value: element => ['NC3', 'PO4'][element] },
        },
      },
    },
    elements: [0, 1],
  };
  const { color } = ElementColorThemeProvider.factory({}, {});

  it('colors atoms', () => {
    expect(color({ kind: 'element-location', unit, element: 1 })).toBe(PHOSPHORUS);
  });

  it('colors bonds as their first atom', () => {
    expect(color({ kind: 'bond-location', aUnit: unit, aIndex: 0, bUnit: unit, bIndex: 1 })).toBe(NITROGEN);
  });
});
