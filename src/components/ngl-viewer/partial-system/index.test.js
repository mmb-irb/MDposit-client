import { ColormakerRegistry } from 'ngl';

import {
  getPartialSystem,
  toPartialAtomIndex,
  toWholeAtomIndex,
  toPartialSelection,
  toPartialAtomGroups,
  toPartialColorScheme,
} from '.';

// A 10 atoms system where only atoms 1, 4, 5 and 8 are loaded
const partialSystem = getPartialSystem([1, 4, 5, 8], 10);

describe('partial system', () => {
  it('is null when the whole system is loaded', () => {
    expect(getPartialSystem(null, 10)).toBe(null);
    expect(getPartialSystem([...Array(10).keys()], 10)).toBe(null);
  });

  it('translates atom indices in both directions', () => {
    expect(toPartialAtomIndex(partialSystem, 5)).toBe(2);
    expect(toPartialAtomIndex(partialSystem, 3)).toBe(null);
    expect(toWholeAtomIndex(partialSystem, 3)).toBe(8);
    expect(() => toPartialAtomIndex(partialSystem, 10)).toThrow();
    expect(() => toWholeAtomIndex(partialSystem, 4)).toThrow();
  });

  it('leaves indices untouched when there is no partial system', () => {
    expect(toPartialAtomIndex(null, 3)).toBe(3);
    expect(toWholeAtomIndex(null, 3)).toBe(3);
    expect(toPartialSelection(null, '@3')).toBe('@3');
  });

  it('translates atom indices in NGL selections', () => {
    expect(toPartialSelection(partialSystem, '@1,3,8')).toBe('@0,3');
    expect(toPartialSelection(partialSystem, '@4 or @5')).toBe('@1 or @2');
    expect(toPartialSelection(partialSystem, '(@0,2) or :A and 10-20')).toBe('(NONE) or :A and 10-20');
    expect(toPartialSelection(partialSystem, ':A and 10-20')).toBe(':A and 10-20');
  });

  it('translates atom groups and drops those with missing atoms', () => {
    expect(toPartialAtomGroups(partialSystem, [[1, 8], [1, 2], ['10:A', '20:A']]))
      .toEqual([[0, 3], ['10:A', '20:A']]);
  });

  it('wraps custom color schemes to receive whole system indices', () => {
    const topology = { atomResidueIndices: [0, 0, 1, 1, 1, 2, 2, 3, 3, 3] };
    const schemeId = ColormakerRegistry.addScheme(function () {
      this.atomColor = atom => atom.index * 100 + atom.residueIndex;
    });
    const wrapperId = toPartialColorScheme(partialSystem, topology, schemeId);
    // Wrappers are reused
    expect(toPartialColorScheme(partialSystem, topology, schemeId)).toBe(wrapperId);
    const colormaker = ColormakerRegistry.getScheme({ scheme: wrapperId });
    // Partial atom 2 is the whole atom 5, which belongs to residue 2
    expect(colormaker.atomColor({ index: 2, residueIndex: 1 })).toBe(502);
  });
});
