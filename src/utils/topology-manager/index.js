import { ProjectCtx, PdbCtx } from '../../contexts';
import { range } from 'lodash-es';

// Topology manager
// Many functions to handle atom/residue/chain numeration conversions and more
// All these functions which need the topology are able to read the context topology
// However, it may be better to pass them the topology as an argument since the context may be null

// There are 3 different residue numeration types in the client:
// - Absolute: From 0 to 'n'
//   Used in some internal managments
// - Source: The numbers in the original topology file
//   Source numbers may be repeated, have gaps or do not start at 0 or 1. May include icodes.
//   They are also the usual numeration in analyses from the database
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
  return residues;
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
const numerationFormat = /^([A-Z]):([0-9]*)([A-Z]?)$/;
export const complexNumerationParser = numeration => {
  const result = numerationFormat.exec(numeration);
  if (!result)
    throw new Error('No matched complex numeration value: ' + numeration);
  const chain = result[1];
  const residue = result[2];
  const icode = result[3] || '';
  // Formated selection to select this specific residue in NGL
  const nglSelection = ':' + chain + ' and ' + residue;
  const nglChainSelection = ':' + chain;
  return { chain, residue: +residue, icode, nglSelection, nglChainSelection };
};

// Harvest from a '[residue_type]residue:chain' string the chain letter and the residue number values
const nglFormat = /^\[[0-9a-zA-Z_]*\]([0-9]*)([A-Z]?):([A-Z])$/;
export const nglNumerationParser = numeration => {
  const result = nglFormat.exec(numeration);
  if (!result)
    throw new Error('No matched NGL numeration value: ' + numeration);
  const chain = result[3];
  const residue = result[1];
  const icode = result[2] || ''; // DANI: El icode es de mi huerto. Falta chequear
  // Formated selection to select this specific residue in NGL
  const nglSelection = ':' + chain + ' and ' + residue;
  // Complex numeration
  const complex = chain + ':' + residue + icode;
  return { chain, residue: +residue, icode, nglSelection, complex };
};

// Return residue data whom the specified absolute atom number belongs to
export const getAtomResidue = (atom, topology = PdbCtx._currentValue.file) => {
  const index = topology.atomStore.residueIndex[atom];
  const residueStore = topology.residueStore;
  const atomCount = residueStore.atomCount[index];
  const atomOffset = residueStore.atomOffset[index];
  //console.log(atom + ' => ' + index);
  return { index, atomCount, atomOffset };
};

// Get first atom absolute number from resiude absolute number
// DANI: Hay que revisar esos -1 y +1
// DANI: Creo que esto ya no se usa. Borralo si te apura
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

// Define the residue type letters
const residueLetters = {
  ALA: 'A',
  ARG: 'R',
  ASN: 'N',
  ASP: 'D',
  ASX: 'B',
  CYS: 'C',
  GLU: 'E',
  GLN: 'Q',
  GLX: 'Z',
  GLY: 'G',
  HIS: 'H',
  ILE: 'I',
  LEU: 'L',
  LYS: 'K',
  MET: 'M',
  PHE: 'F',
  PRO: 'P',
  SER: 'S',
  THR: 'T',
  TRP: 'W',
  TYR: 'Y',
  VAL: 'V',
};

export const getResidueLetter = residueType => {
  if (!residueType) return;
  const letter = residueLetters[residueType];
  if (letter) return letter;
  return 'X';
};

// This function returns an array with all chains in topology
// Specifically, it returns the string chain letters
export const getTopologyChains = (topology = PdbCtx._currentValue.file) => {
  const chainCount = topology.chainStore.count;
  const chains = [];
  for (let chain = 0; chain < chainCount; chain++) {
    chains.push(topology.chainStore.getChainname(chain));
  }

  return chains;
};

// This function returns the chain name from a chain letter (e.g 'A')
export const getMetadataChainname = (
  chain,
  metadata = ProjectCtx._currentValue.metadata,
  topology = PdbCtx._currentValue.file,
) => {
  if (!metadata) throw new Error('There is no metadata');
  if (!topology) throw new Error('There is no topology');
  const metadataChainnames = metadata.CHAINNAMES;
  if (!metadataChainnames) return '';
  // OBSOLETE: Chains were stored as an array of names
  if (Array.isArray(metadataChainnames)) {
    if (!metadataChainnames) return '';
    for (let c = 0; c < metadata.CHAINNAMES.length; c++) {
      const topologyChainname = topology.chainStore.getChainname(c);
      if (topologyChainname === chain) return metadataChainnames[c];
    }
  }
  // Chains are stored as and object (e.g. { 'A': 'ACE2', 'B': 'RBD' })
  else {
    const chainname = metadataChainnames[chain];
    if (chainname) return chainname;
  }

  // "charCodeAt" transforms a string character to int code
  // The 'A' string returns 65, the 'B' returns 66 and so on
  //const name = metadataChainnames[chain.charCodeAt(0) - 65];
  return '';
};

// This function returns the chain names from an array with chain letters (e.g ['A','B'])
// Results are collapsed according to unique chainnames
export const getMetadataChainnames = (
  chains,
  metadata = ProjectCtx._currentValue.metadata,
  topology = PdbCtx._currentValue.file,
) => {
  // Get unique chains
  chains = Array.from(new Set(chains));
  // Get the name of each chain individually
  // Also, compile all chainnames in a single array
  const results = [];
  const chainnames = [];
  for (const c of chains) {
    const chainname = getMetadataChainname(c, metadata, topology);
    results.push({ chain: c, name: chainname });
    chainnames.push(chainname);
  }
  // Collapse the results
  const uniqueChainnames = Array.from(new Set(chainnames));
  const collapsedChains = [];
  const collapsedResults = [];
  for (let u = 0; u < uniqueChainnames.length; u++) {
    const unique = uniqueChainnames[u];
    let collapsed = '';
    for (let c = 0; c < chainnames.length; c++) {
      const name = chainnames[c];
      if (unique === name) if (collapsed) collapsed += ', ';
      collapsed += chains[c];
    }
    collapsedChains[u] = collapsed;
    collapsedResults.push({ name: unique, chains: collapsed });
  }
  // Put it all as a sentence
  let sentence = '';
  for (const cr of collapsedResults) {
    if (sentence) sentence += ', ';
    sentence += cr.name + ' (' + cr.chains + ')';
  }
  return { results, collapsedResults, sentence };
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
  { chain, residue, icode },
  topology = PdbCtx._currentValue.file,
  metadata = ProjectCtx._currentValue.metadata,
) => {
  // Check arguments to be valid
  check(chain, residue);
  const absolute = source2absoluteResidue({ chain, residue, icode }, topology);
  const model = absolute2modelResidue(absolute, topology, metadata);
  //console.log(residue + ' => ' + modelResidue.chainResidue);
  // This object contains the chain, chain name, chain resiude number and residue type
  return model;
};

// This function converts topology residue numbers to absolute residue numbers
export const source2absoluteResidue = (
  { chain, residue, icode },
  topology = PdbCtx._currentValue.file,
) => {
  const chainIndexes = topology.residueStore.chainIndex;
  const resnos = topology.residueStore.resno;
  const inscodes = topology.residueStore.inscode;
  const code = icode.charCodeAt(0);
  //console.log('we need chain: ' + chainIndex + ' res: ' + residue);
  for (const [index, res] of resnos.entries()) {
    //console.log(index + ' -> ' + topology.residueStore.chainIndex[index] + ':' + res);
    if (
      res === residue &&
      topology.chainStore.getChainname(chainIndexes[index]) === chain &&
      (inscodes[index] === code || !icode)
    ) {
      //console.log(chain + ':' + residue + ' => ' + index);
      return index;
    }
  }
  throw new Error(
    'The requested chain (' +
      chain +
      '), residue number (' +
      residue +
      ') and icode (' +
      icode +
      ') did not match any residue',
  );
};

// Transform an absolute residue number to the model corresponding chain and chain residue
export const absolute2modelResidue = (
  residue,
  topology = PdbCtx._currentValue.file,
  metadata = ProjectCtx._currentValue.metadata,
) => {
  const chainIndex = topology.residueStore.chainIndex[residue];
  const chain = topology.chainStore.getChainname(chainIndex); // e.g. 'A'
  const chainName = getMetadataChainname(chain, metadata, topology); // e.g. 'ACE2'
  const offset = topology.chainStore.residueOffset[chainIndex];
  const chainResidue = residue - offset + 1;
  const type = getResidueType(residue, topology);
  const letter = getResidueLetter(type);
  // Formated string representations used in model labels
  const numeration = chain + ':' + chainResidue;
  const tag = chain + '(' + chainName + '):' + chainResidue + '(' + type + ')';
  // WARNING: This is the ngl standard syntax for residue display (e.g. in the tooltip): [AAA]NN:C
  // However, ngl does not show or read resiudes in 'model' format, but in 'source' format
  const ngl = '[' + type + ']' + chainResidue + ':' + chain;
  //console.log(residue + ' -> ' + chainResidue);
  return { chain, chainName, chainResidue, type, letter, numeration, tag, ngl };
};

// This function converts absolute residue numbers to topology residue numbers
export const absolute2sourceResidue = (
  residue,
  topology = PdbCtx._currentValue.file,
) => {
  //console.log(topology);
  if (!Number.isInteger(residue))
    throw new Error(
      `The residue value must be an integer. ${residue} is not valid`,
    );
  const count = topology.residueStore.count;
  if (residue >= count)
    throw new Error(
      `The residue index ${residue} is out of range. There are ${count} residues in the topology`,
    );
  const residueNumber = topology.residueStore.resno[residue];
  const chainIndex = topology.residueStore.chainIndex[residue];
  const chain = topology.chainStore.getChainname(chainIndex); // e.g. 'A'
  const charIcode = topology.residueStore.inscode[residue];
  const icode = charIcode ? String.fromCharCode(charIcode) : '';
  // Formated selection to select this specific residue in NGL
  const numeration = chain + ':' + residueNumber + icode;
  const nglSelection = ':' + chain + ' and ' + residueNumber;
  //console.log(residue + ' => ' + relativeresidue);
  return { chain, residueNumber, icode, numeration, nglSelection };
};

// This function converts model residue numbers to absolute residue numbers
export const model2absoluteResidue = (
  { chain, residue },
  topology = PdbCtx._currentValue.file,
) => {
  //console.log(topology);
  const chainIndex = getChainIndex(chain, topology);
  const residueOffest = topology.chainStore.residueOffset[chainIndex];
  // Make sure residue is a number and not an string
  const residueNumber = residueOffest + +residue - 1;
  //console.log(chain + ':' + residue + ' -> ' + residueNumber);
  return residueNumber;
};

// This function converts model residue numbers to source residue numbers
export const model2sourceResidue = (
  { chain, residue },
  topology = PdbCtx._currentValue.file,
) => {
  const absolute = model2absoluteResidue({ chain, residue }, topology);
  const source = absolute2sourceResidue(absolute, topology);
  return source;
};

// Get atom data from atom index
export const getAtom = (index, topology = PdbCtx._currentValue.file) => {
  // Get the atom number according to the topology. It usually ranges from 1 to n
  const serial = topology.atomStore.serial[index];
  // Absolute index (0-n)
  const residue = topology.atomStore.residueIndex[index];
  // Atom properties
  const typeId = topology.atomStore.atomTypeId[index];
  const {
    number: residueAtomNumber,
    atomname: name,
    element,
  } = topology.atomMap.get(typeId);
  return { serial, residue, residueAtomNumber, name, element };
};
/*
// Align the topology with a toporef residues sequence
// If the align is successful then return a map to get equivalent residues
// The align is successfull when the percent of matching residues is over the cutoff
// - Some topologies may be mutated regarding the original reference
const alignCutoff = 0.95;
// WARNING: The sequences may have different length and be correct anyway
// NEVER FORGET:
// Topology sequence may be smaller than toporef sequence:
// - It is usual that simulated proteins do not start at the first residue
// Topology sequence may be bigger than toporef sequence:
// - There are some topologies with the hydrogens at the end in repeated residues
// - There are some topologies with repeated chains
export const getToporefMap = (toporef, topology = PdbCtx._currentValue.file) => {
  // Get the toporef residue sequence
  const sequence1 = toporef.sequence;
  // Get the topology residue sequence
  let sequence2 = '';
  const store = topology.residueStore;
  for (let r = 0; r < store.count; r++) {
    const residueLetter = getResidueLetter(getResidueType(r));
    sequence2 += residueLetter;
  }
  console.log(sequence1);
  console.log(sequence2);
};
*/
