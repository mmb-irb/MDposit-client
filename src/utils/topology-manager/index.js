import { ProjectCtx, PdbCtx } from '../../contexts';
import { range } from 'lodash-es';

// Functions to handle atom/residue/chain numeration conversions
// All these functions are able to read the context topology
// However, it may be better to pass them the topology since the context may be null

// There are 3 different residue numeration types in the client:
// - Absolute: From 0 to 'n'
//   Used in some internal managments
// - Source: The numbers in the original topology file
//   Source numbers may be repeated, have gaps or do not start at 0 or 1.
//   They are the usual numeration in analyses from the database
// - Model: From 1 to 'n' for each chain
//   Usual numeration in data representation for this web

// This function is used by other functions to check whenever the arguments are valid
const check = (chain, residue) => {
  if (typeof chain !== 'string' || chain.length !== 1)
    throw new Error(
      'The "chain" argument must be a single letter (e.g. "A", "B", ...), not ' +
        chain,
    );

  if (typeof residue !== 'number' || residue < 0)
    throw new Error(
      'The "residue" argument must be a real number (e.g. 0, 1, 17, ...), not ' +
        residue,
    );
};

// Transform a ranged selection of residues in complex numeration format to an array
// e.g. "A:1, 3, 5-8 & B:2, 4" => ["A:1", "A:3", "A:5", "A:6", "A:7", "A:8", "B:2", "B:4"]
// DANI: Hay que pensarlo mejor. En principio esto solo hace falta para el custom selection
const numerationSelection = /^([A-Z]):([-0-9, ]*)$/;
export const cnrsParser = selection => {
  const residues = [];
  const numerationSelections = selection.split(' & ');
  numerationSelections.forEach(nSelection => {
    const results = numerationSelection.exec(nSelection);
    const chain = results[1];
    const residuesSelection = results[2];
    const residuesList = rangedSelectionParser(residuesSelection);
    residuesList.forEach(residue => residues.push(chain + ':' + residue));
  });
};

// This function transforms a range selection string into a numeric array
// It handles abbreviated selection syntax to literal selection syntax
// e.g. "1, 3, 5-8" => [1, 3, 5, 6, 7, 8]
const rangedSyntax = /^([0-9]*)-([0-9]*)$/;
export const rangedSelectionParser = selection => {
  // Filter data
  const units = selection.split(', ');
  const curatedSelection = [];
  for (const u of units) {
    // If the ranged syntax is found, get all numbers in between
    if (u.match(rangedSyntax)) {
      const matches = rangedSyntax.exec(u);
      const rangedUnits = range(+matches[1], +matches[2] + 1);
      curatedSelection.push(...rangedUnits);
    } else curatedSelection.push(+u);
  }
  return curatedSelection;
};

// Transform a 'chain:residue' string into the chain letter string and the residue number values
const numerationFormat = /^([A-Z]):([0-9]*)$/;
export const complexNumerationParser = numeration => {
  const result = numerationFormat.exec(numeration);
  if (!result)
    return console.error('No matched numeration value: ' + numeration);
  const chain = result[1];
  const residueNumber = result[2];
  return { chain, residueNumber: +residueNumber };
};

// Return the absolute residue number to whom the specified absolute atom number belongs to
export const getAtomResidue = (atom, topology = PdbCtx._currentValue.file) => {
  const residue = topology.atomStore.residueIndex[atom];
  //console.log(atom + ' => ' + residue);
  return residue;
};

// Get first atom absolute number from resiude absolute number
// DANI: Hay que revisar esos -1 y +1
export const getResidueFirstAtom = (
  residue,
  topology = PdbCtx._currentValue.file,
) => {
  const atom = topology.residueStore.atomOffset[residue - 1] + 1;
  //console.log(residue + ' => ' + atom);
  return atom;
};

// This function finds the residue type (e.g. TYR) from a residue absolute number
export const getResidueType = (
  residue,
  topology = PdbCtx._currentValue.file,
) => {
  const typeId = topology.residueStore.residueTypeId[residue];
  const type = topology.residueMap.get(typeId).resname;
  //console.log(residue + ' => ' + type);
  return type;
};

// This function returns the chain name from a chain letter (e.g 'A')
export const getChainName = (
  chain,
  metadata = ProjectCtx._currentValue.metadata,
) => {
  if (!metadata) return console.error('There is no metadata');
  const chainnames = metadata.CHAINNAMES;
  if (!chainnames) return '';
  // "charCodeAt" transforms a string character to int code
  // The 'A' string returns 65, the 'B' returns 66 and so on
  const name = chainnames[chain.charCodeAt(0) - 65];
  return name;
};

// This function returns the chain index from a chain letter (e.g 'A')
// Return -1 when the chain letter si not found
export const getChainIndex = (chain, topology = PdbCtx._currentValue.file) => {
  const chainCount = topology.chainStore.count;
  for (let i = 0; i < chainCount; i++)
    if (topology.chainStore.getChainname(i) === chain) return i;
  return -1;
};

// This function converts topology residue numbers to the model chain name and chain residue numeration
export const source2modelResidue = (
  chain,
  residue,
  topology = PdbCtx._currentValue.file,
  metadata = ProjectCtx._currentValue.metadata,
) => {
  // Check arguments to be valid
  check(chain, residue);
  const absolute = source2absoluteResidue(chain, residue, topology);
  const model = absolute2modelResidue(absolute, topology, metadata);
  //console.log(residue + ' => ' + modelResidue.chainResidue);
  // This object contains the chain, chain name, chain resiude number and residue type
  return model;
};

// This is the old method, which does not require chain
// However, it only works asuming there are no repeated residue numbers in the source
// This function converts topology residue numbers to the model chain name and chain residue numeration
export const OLDsource2modelResidue = (
  residue,
  topology = PdbCtx._currentValue.file,
  metadata = ProjectCtx._currentValue.metadata,
) => {
  // Check that arguments are valid
  check('0', residue);
  const absolute = OLDsource2absoluteResidue(residue, topology);
  const model = absolute2modelResidue(absolute, topology, metadata);
  //console.log(residue + ' => ' + modelResidue.chainResidue);
  // This object contains the chain, chain name, chain resiude number and residue type
  return model;
};

// This function converts topology residue numbers to absolute residue numbers
export const source2absoluteResidue = (
  chain,
  residue,
  topology = PdbCtx._currentValue.file,
) => {
  const chainIndex = getChainIndex(chain, topology);
  const resnos = topology.residueStore.resno;
  for (const [index, res] of resnos.entries())
    if (
      res === residue &&
      topology.residueStore.chainIndex[index] === chainIndex
    ) {
      //console.log(chain + ':' + residue + ' => ' + index);
      return index;
    }
};

// This is the old method, which does not require chain
// However, it only works asuming there are no repeated residue numbers in the source
// This function converts topology residue numbers to absolute residue numbers
export const OLDsource2absoluteResidue = (
  residue,
  topology = PdbCtx._currentValue.file,
) => {
  const absoluteResidue = topology.residueStore.resno.indexOf(residue);
  //console.log(residue + ' => ' + absoluteResidue);
  return absoluteResidue;
};

// Transform an absolute residue number to the model corresponding chain and chain residue
export const absolute2modelResidue = (
  residue,
  topology = PdbCtx._currentValue.file,
  metadata = ProjectCtx._currentValue.metadata,
) => {
  const chainIndex = topology.residueStore.chainIndex[residue];
  const offset = topology.chainStore.residueOffset[chainIndex];
  const chain = topology.chainStore.getChainname(chainIndex); // e.g. 'A'
  const chainName = getChainName(chain, metadata); // e.g. 'ACE2'
  const chainResidue = residue - offset + 1;
  const residueType = getResidueType(residue, topology);
  //console.log(residue + ' -> ' + chainResidue);
  return { chain, chainName, chainResidue, residueType };
};

// This function converts absolute residue numbers to topology residue numbers
export const absolute2sourceResidue = (
  residue,
  topology = PdbCtx._currentValue.file,
) => {
  //console.log(topology);
  const residueNumber = topology.residueStore.resno[residue];
  const chainIndex = topology.residueStore.chainIndex[residue];
  const chain = topology.chainStore.getChainname(chainIndex);
  //console.log(residue + ' => ' + relativeresidue);
  return { chain, residueNumber };
};

// This function converts topology residue numbers to absolute residue numbers
/*
export const model2absoluteResidue = (residue, topology = PdbCtx._currentValue.file) => {
  const absoluteResidue = topology.residueStore.resno.indexOf(residue);
  //console.log(residue + ' => ' + absoluteResidue);
  return absoluteResidue;
};
*/
