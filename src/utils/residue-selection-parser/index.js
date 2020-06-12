import { range } from 'lodash-es';

const rangedSyntax = /^([0-9]*)-([0-9]*)$/;

// This function transforms a residue selection string into a numeric array
// It handles abbreviated residue selection syntax to literal selection syntax
// e.g. "1, 3, 5-8" => [1, 3, 5, 6, 7, 8]
const residueSelectionParser = selection => {
  // Filter data
  const residues = selection.split(',');
  const curatedSelection = [];
  for (const res of residues) {
    // If the ranged syntax is found, get all numbers in between
    if (res.match(rangedSyntax)) {
      const matches = rangedSyntax.exec(res);
      const rangedResidues = range(+matches[1], +matches[2] + 1);
      curatedSelection.push(...rangedResidues);
    } else curatedSelection.push(+res);
  }
  return curatedSelection;
};

export default residueSelectionParser;
