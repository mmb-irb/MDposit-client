import { autoLoad, ColormakerRegistry } from 'ngl';

import { nglSchemeToTheme, NglSchemeColorThemeProvider, isNglScheme } from '.';

// Build a PDB atom line with its fixed width columns
const atomLine = (serial, name, resName, chain, resSeq) =>
  'ATOM  ' + String(serial).padStart(5) + ' ' + name.padEnd(4) + ' ' + resName.padStart(3) + ' ' +
  chain + String(resSeq).padStart(4) + '    ' + (serial * 1.5).toFixed(3).padStart(8) +
  '   0.000   0.000  1.00  0.00           ' + name[0];
// Alanine and glycine in chain A plus a water in chain B: atoms 0-3, 4-7 and 8
const PDB = [
  ...['N', 'CA', 'C', 'O'].map((name, i) => atomLine(i + 1, name, 'ALA', 'A', 1)),
  ...['N', 'CA', 'C', 'O'].map((name, i) => atomLine(i + 5, name, 'GLY', 'A', 2)),
  atomLine(9, 'O', 'HOH', 'B', 3),
  'END',
].join('\n');

// A scheme like those of the analysis pages, which colors every residue
const RESIDUE_COLORS = [0xff0000, 0x00ff00, 0x0000ff];
const schemeId = ColormakerRegistry.addScheme(function () {
  this.atomColor = atom => RESIDUE_COLORS[atom.residueIndex];
});

// A molstar location of an atom in an atomic unit whose atoms are in the topology order
const atomLocation = element => ({
  kind: 'element-location',
  unit: { kind: 0, model: { atomicHierarchy: { atomSourceIndex: { value: e => e } } } },
  element,
});

describe('NGL color schemes in molstar', () => {
  it('colors every atom as the NGL scheme does', async () => {
    const nglStructure = await autoLoad(new Blob([PDB], { type: 'text/plain' }), { ext: 'pdb' });
    const theme = nglSchemeToTheme(nglStructure, schemeId);
    const { color } = NglSchemeColorThemeProvider.factory({}, theme.params);
    expect([0, 3, 4, 7, 8].map(atom => color(atomLocation(atom)))).toEqual([
      0xff0000, 0xff0000, 0x00ff00, 0x00ff00, 0x0000ff,
    ]);
  });

  // Some pages pass the scheme id as the color itself (e.g. lipid-inter), which NGL accepts
  it('tells the schemes registered by pages from other colors', () => {
    expect(isNglScheme(schemeId)).toBe(true);
    expect(isNglScheme('element')).toBe(false);
    expect(isNglScheme('red')).toBe(false);
    expect(isNglScheme(undefined)).toBe(false);
  });

  // e.g. the whole system and the reduced membrane view
  it('keeps apart the colors of different structures', async () => {
    const parse = () => autoLoad(new Blob([PDB], { type: 'text/plain' }), { ext: 'pdb' });
    const first = nglSchemeToTheme(await parse(), schemeId);
    const second = nglSchemeToTheme(await parse(), schemeId);
    expect(first.params.id).not.toBe(second.params.id);
  });
});
