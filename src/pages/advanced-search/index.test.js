import { getFilters } from '.';

// Shortcuts to build query objects
const field = (name, comparator, value = '', is = true) => ({ field: name, comparator, value, is });
const logic = (name, fields, is = true) => ({ logic: name, fields, is });

describe('getFilters', () => {
  it('translates an AND of fields', () => {
    expect(getFilters(logic('AND', [
      field('PDB title', 'contains', 'spike'),
      field('System atom count', 'greater than', '1000'),
      field('System atom count', 'lower than', '5000', false),
    ]))).toEqual([
      "pdbTitle=ct='spike'",
      'systemAtoms=gt=1000',
      'systemAtoms=ge=5000',
    ]);
  });

  it('ignores empty fields and logics', () => {
    expect(getFilters(logic('OR', [
      field('', ''),
      logic('AND', [field('', '')]),
      field('PDB id', 'equals', '6VXX'),
    ]))).toEqual(["pdbId=eq='6VXX'"]);
  });

  it('translates an OR in a single filter, merging values of the same field', () => {
    expect(getFilters(logic('OR', [
      field('PDB id', 'equals', '6VXX'),
      field('PDB title', 'contains', 'spike'),
      field('PDB id', 'equals', '6VYB'),
    ]))).toEqual(["pdbId=eq='6VXX','6VYB';pdbTitle=ct='spike'"]);
  });

  it('translates negated groups', () => {
    // NOT (A OR B) = NOT A AND NOT B
    expect(getFilters(logic('OR', [
      field('PDB title', 'contains', 'spike'),
      field('PDB id', 'equals', '6VXX'),
    ], false))).toEqual(["pdbTitle=nc='spike'", "pdbId=ne='6VXX'"]);
    // NOT (A AND B) = NOT A OR NOT B
    expect(getFilters(logic('AND', [
      field('PDB title', 'contains', 'spike'),
      field('System atom count', 'greater than', '10'),
    ], false))).toEqual(["pdbTitle=nc='spike';systemAtoms=le=10"]);
  });

  it('distributes an OR of ANDs', () => {
    // (A AND B) OR C = (A OR C) AND (B OR C)
    expect(getFilters(logic('OR', [
      logic('AND', [field('PDB title', 'contains', 'spike'), field('System atom count', 'greater than', '10')]),
      field('PDB id', 'equals', '6VXX'),
    ]))).toEqual([
      "pdbTitle=ct='spike';pdbId=eq='6VXX'",
      "systemAtoms=gt=10;pdbId=eq='6VXX'",
    ]);
  });

  it('rejects queries which are too complex', () => {
    const and = logic('AND', [1, 2, 3, 4, 5].map(n => field('System atom count', 'greater than', String(n))));
    expect(getFilters(logic('OR', [and, and])).error).toBeTruthy();
  });
});
