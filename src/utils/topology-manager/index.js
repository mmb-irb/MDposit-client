import { range } from 'lodash-es';
const ngl = require('ngl');

// Topology manager
// Many functions to handle atom/residue/chain numeration conversions and more
// All these functions which need the topology are able to read the context topology
// However, it may be better to pass them the topology as an argument since the context may be null

// There are 4 different residue numeration types in the client:
// - Absolute/Index: From 0 to 'n'
//   Used in some internal managments
// - Original/Source: The numbers in the original topology file
//   Source numbers may be repeated, have gaps or do not start at 0 or 1. May include icodes.
//   They are also the usual numeration in analyses from the database
// - Reference: The number in a reference topology, which is a standard
// - (DEPRECATED) Model: From 1 to 'n' for each chain

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
export const parsedSelectionRanger = (selection, addWhiteSpaces = true) => {
  const separator = addWhiteSpaces ? ', ' : ',';
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
    rangedSelection += separator + num;
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
  rangedSelection = rangedSelection.substring(separator.length); // Remove the first separator
  return { rangedSelection, small };
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
  // Nucleotides
  A: 'A',
  A3: 'A',
  A5: 'A',
  C: 'C',
  C3: 'C',
  C5: 'C',
  T: 'T',
  T3: 'T',
  T5: 'T',
  G: 'G',
  G3: 'G',
  G5: 'G',
  U: 'U',
  U3: 'U',
  U5: 'U',
  DA: 'A',
  DT: 'T',
  DC: 'C',
  DG: 'G',
};

export const getResidueTypeLetter = residueType => {
  if (!residueType) return;
  const letter = residueLetters[residueType];
  if (letter) return letter;
  return 'X';
};

// Check if an NGL residues is cartoon supported or not
// e.g. check if it is recognized by NGL as a protein, RNA or DNA residue
export const isCartoonSupported = nglResidue => {
  return nglResidue.isProtein() || nglResidue.isRna() || nglResidue.isDna();
};

// Convert a ngl selection string into an array with the absolute residue indices
// If the 'onlyCartoonSupported' parameter is passed then it will return only cartoon supported residues
export const nglSelection2absolute = (
  nglSelection,
  onlyCartoonSupported = false,
  viewerTopology,
) => {
  const residues = [];
  // Save the selection in ngl format (structureComponent)
  const selection = new ngl.Selection(nglSelection);
  // Save the data from structure which corresponds to the selection atoms
  const view = viewerTopology.getView(selection);
  if (onlyCartoonSupported) {
    view.eachResidue(residue => {
      if (isCartoonSupported(residue)) residues.push(residue.index);
    });
  } else {
    view.eachResidue(residue => {
      residues.push(residue.index);
    });
  }

  return residues;
};

// Set the element colors for displaying
const elementColors = {
  H: 'white',
  C: 'grey',
  N: 'blue',
  O: 'red',
  S: 'yellow',
  P: 'orange',
};

// Set a residue handler
class Residue {
  // Constructor expects the resiude index (absolute numeration)
  constructor(topology, residueIndex) {
    this.topology = topology;
    this.index = residueIndex;
  }
  // Original residue number (source numeration)
  get number () {
    return this.topology.residueNumbers[this.index];
  }
  // Chain index
  get chainIndex () {
    return this.topology.residueChainIndices[this.index];
  }
  // Chain name
  get chain () {
    return this.topology.chainNames[this.chainIndex];
  }
  // Insertion code
  get icode () {
    return this.topology.residueIcodes && this.topology.residueIcodes[residueIndex];
  }
  // NGL selection of this specific residue
  get nglSelection () {
    return `:${this.chain} and ${this.number} ^${this.icode}`;
  }
  // Residue name
  get type () {
    return this.topology.residueNames[this.index];
  }
  // Residue standard letter (e.g. ARG -> R)
  get letter () {
    return getResidueTypeLetter(this.type);
  }
  // Reference protein index in the topology
  get referenceIndex () {
    if (!this.topology.residueReferenceIndices) return null;
    return this.topology.residueReferenceIndices[this.index];
  }
  // Reference protein id
  get referenceId () {
    const referenceIndex = this.referenceIndex;
    if (referenceIndex === null) return null;
    return this.topology.references[referenceIndex];
  }
  // Reference protein residue number (reference numeration)
  get referenceNumber () {
    return this.topology.residueReferenceNumbers[this.index];
  }
  // Standard label for display
  get standardLabel () {
    // Add the chain to the label only if there is more than ona chain
    let labelChain = '';
    if (this.topology.chainNames.length > 1 ) labelChain = `${this.chain}:`;
    // Use the reference numeration if possible
    // Use the source numeration otherwise
    const referenceNumber = this.referenceNumber;
    let labelNumber;
    if (referenceNumber !== null) labelNumber = `${referenceNumber}`;
    else labelNumber = `${this.number}*`;
    // Get the insertion code
    let labelIcode = this.icode;
    if (!labelIcode) labelIcode = '';
    // Get the residue name
    const labelType = `(${this.type})`;
    // Finally return the label
    return labelChain + labelNumber + labelIcode + labelType;
  }
  // Atom indices for atoms which belong to this residue
  get atomIndices () {
    return this.topology.residueAtomIndices[this.index];
  }
  // Number of atoms which belong to this residue
  get atomCount () {
    return this.atomIndices.length;
  }
  // Check if the residue has an alpha carbon
  get hasCAlpha () {
    for (const atomIndex of this.atomIndices) {
      const atomName = this.topology.getAtomName(atomIndex);
      if (atomName === 'CA') return true;
    }
    return false;
  }

};

export class Topology {
  constructor(topology, metadata) {
    // Save the topology data as it comes
    this.atomNames = topology.atom_names;
    this.atomElements = topology.atom_elements;
    this.atomCharges = topology.atom_charges;
    this.atomResidueIndices = topology.atom_residue_indices;
    this.residueNames = topology.residue_names;
    this.residueNumbers = topology.residue_numbers;
    // Residue icodes have a different structure, since usually there are only a few icodes and not 1 per residue
    // It is an object where keys are residue indices
    // It is null when there are not icodes at all in the topology
    // In order to convert it to the other values format we transform the object into an array
    // Non assigned indices will become empty strings
    const icodes = topology.residue_icodes;
    // In case we have no icodes at all we set the icodes list as an empty string
    // This is usefull for icode getters that do 'icodes && ...'
    if (!icodes) this.residueIcodes = '';
    else {
      this.residueIcodes = Array(this.residueNames.length).fill('');
      Object.entries(icodes).forEach(([residueIndex, icode]) => {
        this.residueIcodes[+residueIndex] = icode;
      });
    }
    this.residueChainIndices = topology.residue_chain_indices;
    this.chainNames = topology.chain_names;
    this.references = topology.references;
    this.residueReferenceIndices = topology.residue_reference_indices;
    this.residueReferenceNumbers = topology.residue_reference_numbers;
    // Data is stored in a down-top structure according to atom-residue-chain indices
    // i.e. atoms know which residue they belong to and residues know which chain they belong to
    // Now set the top-down structure values
    // i.e. set which atoms are contained on every residue and which residues are contained on every chain
    // WARNING: Note that arrays of empty arrays can not be filled as when filled with nulls or empty strings
    // WARNING: We must fill them with this complicated method or all empty arrays would be the same array
    this.residueAtomIndices = Array.from(Array(this.residueNames.length), () => []);
    for (const [atomIndex, residueIndex] of this.atomResidueIndices.entries()) {
      this.residueAtomIndices[residueIndex].push(atomIndex);
    }
    this.chainResidueIndices = Array.from(Array(this.chainNames.length), () => []);
    for (const [ residueIndex, chainIndex ] of this.residueChainIndices.entries()) {
      this.chainResidueIndices[chainIndex].push(residueIndex);
    }
    this.chainResidueNumbers = this.chainResidueIndices.map(
      residueIndices => residueIndices.map(residueIndex => this.residueNumbers[residueIndex])
    );
    // Save also the metadata chain names
    // They are not letters ('A', 'B', etc.) but actual names ('Spike', 'Glycans', etc.)
    this.metadataChainNames = metadata.CHAINNAMES;
  }

  // --------------------------------------------------------------------
  // BASICS
  // --------------------------------------------------------------------

  // Get atom data from atom index
  getAtomName = atomIndex => {
    return this.atomNames[atomIndex];
  };

  // Given an atom, return its residue index
  getAtomResidueIndex = atomIndex => {
    return this.atomResidueIndices[atomIndex];
  };

  // Return all atom absolute numbers from resiude absolute number
  getResidueName = residueIndex => {
    return this.residueNames[residueIndex];
  };

  // Return all atom absolute numbers from resiude absolute number
  getResidueAtoms = residueIndex => {
    return this.residueAtomIndices[residueIndex];
  };

  // Get the total number of atoms from a resiude absolute number
  getResidueAtomsCount = residueIndex => {
    const atoms = this.getResidueAtoms(residueIndex);
    return atoms.length;
  };

  // Get the total number of residues in topology
  getResiduesCount = () => {
    return this.residueNumbers.length;
  };

  // Given a chain name, get its index
  getChainIndex = chainName => {
    const chainIndex = this.chainNames.indexOf(chainName);
    if (chainIndex === -1)
      throw new Error('Chain ' + chainName + ' is not found in the topology');
    return chainIndex;
  };

  // Get a chain name from its index
  getChainName = chainIndex => {
    return this.chainNames[chainIndex];
  };

  // Given a residue, get its chain index
  getResidueChainIndex = residueIndex => {
    return this.residueChainIndices[residueIndex];
  };

  // Given an atom, return its chain index
  getAtomChainIndex = atomIndex => {
    const residueIndex = this.getAtomResidueIndex(atomIndex);
    return this.getResidueChainIndex(residueIndex);
  };

  // Given a chain, return its atom indices
  getChainAtomIndices = chainIndex => {
    const residueIndices = this.chainResidueIndices[chainIndex];
    return [].concat(
      residueIndices.map(residueIndex => this.residueAtomIndices[residueIndex]),
    );
  };

  // --------------------------------------------------------------------
  // RESIDUE PARSING
  // --------------------------------------------------------------------

  // This function converts a list of topology reference residue numbers to current topology residue numbers
  // The reference must be specified with the topology reference name, since there may be more than 1 reference
  // e.g. "SARS-CoV-2 spike"
  // Note that one residue in the reference may be more than once or not be in the current topology
  reference2absolute = (reference, residues) => {
    if (!this.references) return;
    const referenceIndex = this.references.indexOf(reference);
    if (referenceIndex === -1) return;
    const absoluteResidues = [];
    this.residueReferenceIndices.forEach((refIndex, residueIndex) => {
      if (refIndex !== referenceIndex) return;
      const residueNumber = this.residueReferenceNumbers[residueIndex];
      if (residues.indexOf(residueNumber) !== -1)
        absoluteResidues.push(residueIndex);
    });
    return absoluteResidues;
  };

  // This function converts absolute residue numbers to topology residue numbers
  getResidueByIndex = residueIndex => {
    const count = this.residueNumbers.length;
    if (residueIndex >= count) throw new Error(
      `The residue index ${residueIndex} is out of range. There are ${count} residues in the topology`,
    );
    return new Residue(this, residueIndex);
  };

  // This function converts topology residue numbers to absolute residue numbers
  getResidueByParameters = (chain, number, icode = '') => {
    // Get the first residue index of residues belonging to this chain
    const chainIndex = this.getChainIndex(chain);
    const firstResideeIndex = this.residueChainIndices.indexOf(chainIndex);
    if (firstResideeIndex === -1) throw new Error(`Chain ${chain} does not exist`);
    // Now iterate residues starting at this index
    for (let residueIndex = firstResideeIndex; residueIndex < this.residueChainIndices.length; residueIndex++) {
      const residue = new Residue(this, residueIndex);
      // If this resiude does not belong to the requested chain already then we give up
      if (residue.chainIndex !== chainIndex) break;
      // Check if the residue number matches
      if (residue.number !== number) continue;
      // Check if the insertion code matches
      if (residue.icode !== icode) continue;
      // If everything matches then return this residue
      return residue;
    }
    // There should always be a match
    throw new Error(
      `Residue with chain ${chain}, number ${number} and icode ${icode} does not exist`,
    );
  };

  // --------------------------------------------------------------------
  // OTHER
  // --------------------------------------------------------------------

  // This function finds all requested metadata from a residue absolute number
  // Requests is an object with all the names of the fields to be requested as keys and all of them with true values
  // Available fields:
  // - type
  // - letter
  // - chain
  // - number
  // - icode
  // - ngl
  // - label
  getAbsoluteResidueMetadata = (residue, requests) => {
    const output = {};
    if (requests.type || requests.letter) {
      const type = this.residueNames[residue];
      if (requests.type) output.type = type;
      if (requests.letter) output.letter = getResidueTypeLetter(type);
    }
    let source = {};
    if (requests.chain || requests.ngl || requests.label) {
      const chainIndex = this.getResidueChainIndex(residue);
      const chain = this.chainNames[chainIndex];
      if (requests.chain) output.chain = chain;
      if (requests.ngl || requests.label) source.chain = chain;
    }
    if (requests.number || requests.ngl || requests.label) {
      const number = this.residueNumbers[residue];
      if (requests.number) output.number = number;
      if (requests.ngl || requests.label) source.number = number;
    }
    if (requests.icode || requests.label) {
      const icode = this.residueIcodes && this.residueIcodes[residue];
      if (requests.icode) output.icode = icode;
      if (requests.label) source.icode = icode;
    }
    if (requests.ngl) {
      const ngl = ':' + source.chain + ' and ' + source.number;
      output.ngl = ngl;
    }
    if (requests.label) {
      const label = source.chain + ':' + source.number + source.icode;
      output.label = label;
    }
    return output;
  };

  // Do the same that the previous function but from absolute residues
  // e.g. [0, 1, 2, 3, ...] => nglSelection = "(A: and 1, 3-5) or (B: and 1)"
  // In addition track if there is any small serie (i.e. 3 residues or less)
  // DANI: Esta función no sería necesaria si se pudiesen hacer selecciones en NGL con índices de residuos
  // DANI: De hecho no haría falta eliminar residuos duplicados si se pudiesen hacer selecciones en NGL con índices de residuos
  absoluteSelectionToNgl = selection => {
    let small = false;
    let rangedSelection = '';
    // Parse each residue in complex notation
    const parsedResidues = selection.map(residueIndex => this.getResidueByIndex(residueIndex));
    // Get unique chains
    const chains = parsedResidues.map(r => r.chain).filter((v, i, a) => a.indexOf(v) === i);
    // For each chain, get all residues and "range" them
    chains.forEach(chain => {
      const chainResidues = parsedResidues.filter(v => v.chain === chain).map(r => r.number);
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

  // This function returns the chain name from a chain letter (e.g 'A')
  getMetadataChainname = chain => {
    if (!this.metadataChainNames) return '';
    // OBSOLETE: Chains were stored as an array of names
    if (Array.isArray(this.metadataChainNames)) {
      for (let c = 0; c < this.metadataChainNames.length; c++) {
        const topologyChainname = this.getChainName(c);
        if (topologyChainname === chain) return this.metadataChainNames[c];
      }
    }
    // Chains are stored as and object (e.g. { 'A': 'ACE2', 'B': 'RBD' })
    else {
      const chainname = this.metadataChainNames[chain];
      if (chainname) return chainname;
    }

    // "charCodeAt" transforms a string character to int code
    // The 'A' string returns 65, the 'B' returns 66 and so on
    //const name = metadataChainnames[chain.charCodeAt(0) - 65];
    return '';
  };

  // Given a list of residues in absolute numeration, separate them by chain and return an object where keys are chain names
  // e.g. [ 1, 2, 3, 17 ] -> { 'A': [1,2,3], 'B': [17] }
  byChains = residues => {
    const chained = {};
    residues.forEach(residue => {
      const chainIndex = this.getResidueChainIndex(residue);
      const chain = this.chainNames[chainIndex];
      const current = chained[chain];
      if (current) current.push(residue);
      else chained[chain] = [residue];
    });
    return chained;
  };

  // Get an atom color according to its element
  // If the element color is not defined return black color
  getAtomElementColor = atomIndex => {
    const element = this.atomElements[atomIndex];
    const color = elementColors[element];
    if (!color) return 'black';
    return color;
  };

  // Get all atom colors according to their elements
  getAtomElementColors = () => {
    return this.atomElements.map(element => {
      const color = elementColors[element];
      if (!color) return 'black';
      return color;
    });
  };
}
