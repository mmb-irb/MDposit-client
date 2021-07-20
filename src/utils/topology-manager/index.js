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
  const parsedSelection = [];
  for (const u of units) {
    // If the ranged syntax is found, get all numbers in between
    if (u.match(rangedSyntax)) {
      const matches = rangedSyntax.exec(u);
      const rangedUnits = range(+matches[1], +matches[2] + 1);
      parsedSelection.push(...rangedUnits);
    } else parsedSelection.push(+u);
  }
  return parsedSelection;
};

// Do the opposite that the previous function
// e.g. [1, 3, 5, 6, 7, 8] => "1, 3, 5-8"
// In addition track the minimum serie length
// Return 'small' = true when there are series of 3 residues or less
// These small residue selections will be not represented in cartoon due to an NGL bug
// https://github.com/nglviewer/ngl/issues/223
export const parsedSelectionRanger = selection => {
  let rangedSelection = '';
  let minimumSerieLength = Number.POSITIVE_INFINITY;
  selection.sort((a, b) => a - b); // Sort numbers numerically
  const selectionLength = selection.length;
  // When the selection is a single value
  if (selectionLength === 1) {
    return { rangedSelection: selection[0].toString(), small: true };
  }
  for (let i = 0; i < selectionLength; i++) {
    const num = selection[i];
    rangedSelection += ', ' + num;
    for (let j = i + 1; j < selectionLength; j++) {
      const nextNum = selection[j];
      let length = j - i; // The serie length
      if (nextNum - num !== length) {
        // End of the serie
        // The length here is the length which broke the serie
        // i.e. if the length here is 2 the actual serie length is 1
        length -= 1;
        minimumSerieLength = Math.min(length, minimumSerieLength);
        // If the length of the serie is <= 1 then no worth making a range here
        if (length > 1) {
          const prevNum = selection[j - 1];
          rangedSelection += '-' + prevNum;
          i = j - 1;
        }
        break;
      }
      if (j === selectionLength - 1) {
        // End of the selection
        minimumSerieLength = Math.min(length, minimumSerieLength);
        if (length > 1) {
          rangedSelection += '-' + nextNum;
          i = j;
        }
      }
    }
  }
  const small = minimumSerieLength <= 3;
  rangedSelection = rangedSelection.substring(2); // Remove the first ', '
  return { rangedSelection, small };
};

// Do the same that the previous function but for complex selection residues
// e.g. ['A:1', 'A:3', 'A:4', 'A:5', 'B:1'] => nglSelection = "(A: and 1, 3-5) or (B: and 1)"
// In addition track if there is any small serie (i.e. 3 residues or less)
export const complexSelectionRanger = selection => {
  let small = false;
  let rangedSelection = '';
  // Parse each residue in complex notation
  const parsedResidues = selection.map(residue =>
    complexNumerationParser(residue),
  );
  // Get unique chains
  const chains = parsedResidues
    .map(r => r.chain)
    .filter((v, i, a) => a.indexOf(v) === i);
  // For each chain, get all residues and "range" them
  chains.forEach(chain => {
    const chainResidues = parsedResidues
      .filter(v => v.chain === chain)
      .map(r => r.residue);
    const {
      rangedSelection: ranged,
      small: smallChain,
    } = parsedSelectionRanger(chainResidues);
    rangedSelection += ' or (:' + chain + ' and (' + ranged + '))'; // Al parenthesis are mandatory
    if (smallChain) small = true; // If any chain small is true then the overall small is true
  });
  rangedSelection = rangedSelection.substring(4); // Remove the first ' or '
  return { rangedSelection, small };
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

// Get atom data from atom index
export const getAtom = (index, topology = PdbCtx._currentValue.file) => {
  const atomStore = topology.atomStore;
  // Get the atom number according to the topology. It usually ranges from 1 to n
  const serial = atomStore.serial[index];
  // Absolute index (0-n)
  const residue = atomStore.residueIndex[index];
  // Atom properties
  const typeId = atomStore.atomTypeId[index];
  const data = topology.atomMap.get(typeId);
  const { number: residueAtomNumber, atomname: name, element } = data;
  return { serial, residue, residueAtomNumber, name, element };
};

// Return residue data whom the specified absolute atom number belongs to
export const getAtomResidue = (atom, topology = PdbCtx._currentValue.file) => {
  const index = topology.atomStore.residueIndex[atom];
  const residueStore = topology.residueStore;
  const atomCount = residueStore.atomCount[index];
  const atomOffset = residueStore.atomOffset[index];
  const typeId = residueStore.residueTypeId[index];
  const data = topology.residueMap.get(typeId);
  const { resname } = data;
  //console.log(atom + ' => ' + index);
  return { index, atomCount, atomOffset, resname };
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

// Return all atom absolute numbers from resiude absolute number
export const getResidueAtoms = (
  residue,
  topology = PdbCtx._currentValue.file,
) => {
  const firstAtom = topology.residueStore.atomOffset[residue];
  const atomCount = topology.residueStore.atomCount[residue];
  const atoms = [];
  for (let a = 0; a < atomCount; a++) atoms.push(firstAtom + a);
  //console.log(residue + ' => ' + atoms);
  return atoms;
};

export const residueHasCAlpha = (
  residue,
  topology = PdbCtx._currentValue.file,
) => {
  const atoms = getResidueAtoms(residue, topology);
  for (const atom of atoms) {
    const name = getAtom(atom, topology).name;
    //console.log(residue + ' => ' + name);
    if (name === 'CA') return true;
  }
  return false;
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
  ALAN: 'A',
  ALAC: 'A',
  ARG: 'R',
  ARGN: 'R',
  ARGC: 'R',
  ASN: 'N',
  ASNN: 'N',
  ASNC: 'N',
  ASP: 'D',
  ASPN: 'D',
  ASPC: 'D',
  CYS: 'C',
  CYSN: 'C',
  CYSC: 'C',
  CYH: 'C',
  CSH: 'C',
  CSS: 'C',
  CYX: 'C',
  CYP: 'C',
  GLN: 'Q',
  GLNN: 'Q',
  GLNC: 'Q',
  GLU: 'E',
  GLUN: 'E',
  GLUC: 'E',
  GLY: 'G',
  GLYN: 'G',
  GLYC: 'G',
  HIS: 'H',
  HISN: 'H',
  HISC: 'H',
  HID: 'H',
  HIE: 'H',
  HIP: 'H',
  HSD: 'H',
  HSE: 'H',
  ILE: 'I',
  ILEN: 'I',
  ILEC: 'I',
  ILU: 'I',
  LEU: 'L',
  LEUN: 'L',
  LEUC: 'L',
  LYS: 'K',
  LYSN: 'K',
  LYSC: 'K',
  MET: 'M',
  METN: 'M',
  METC: 'M',
  PHE: 'F',
  PHEN: 'F',
  PHEC: 'F',
  PRO: 'P',
  PRON: 'P',
  PROC: 'P',
  PRØ: 'P',
  PR0: 'P',
  PRZ: 'P',
  SER: 'S',
  SERN: 'S',
  SERC: 'S',
  THR: 'T',
  THRN: 'T',
  THRC: 'R',
  TRP: 'W',
  TRPN: 'W',
  TRPC: 'W',
  TRY: 'W',
  TYR: 'Y',
  TYRN: 'Y',
  TYRC: 'Y',
  VAL: 'V',
  VALN: 'V',
  VALC: 'V',
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

// This function converts absolute residue numbers to topology reference residue numbers
// If the residue is not mapped for whatever the reason then return null
// e.g. the topology map may be missing or the residue may be not protein
export const absolute2reference = (
  residue,
  metadata = ProjectCtx._currentValue.metadata,
) => {
  const toporefs = metadata.TOPOREFS;
  if (!toporefs) return null;
  for (const toporef of toporefs) {
    const mapping = toporef.map;
    if (!mapping) continue;
    const reference = mapping[residue];
    if (!reference) continue;
    return { name: toporef.name, index: reference };
  }
  return null;
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
