import {
  RESIDUE_NAME_LETTERS,
  PROTEIN_RESIDUE_NAME_LETTERS,
  DNA_RESIDUE_NAME_LETTERS,
  RNA_RESIDUE_NAME_LETTERS,
  NUCLEIC_RESIDUE_NAME_LETTERS,
  FATTY_RESIDUE_NAMES,
  STEROID_RESIDUE_NAMES,
  STANDARD_SOLVENT_RESIDUE_NAMES,
  STANDARD_COUNTER_ION_ATOM_NAMES,
  STANDARD_DUMMY_ATOM_NAMES,
  DUMMY_ATOM_ELEMENT,
  CG_ATOM_ELEMENT
} from './residues-library';
import { countElement, parsedSelectionRanger } from 'src/utils/auxiliar-functions';

// Topology manager
// Many functions to handle atom/residue/chain numeration conversions and more
// All these functions which need the topology are able to read the context topology
// However, it may be better to pass them the topology as an argument since the context may be null

// Set the element colors for displaying
const ELEMENT_COLORS = {
  H: 'white',
  C: 'grey',
  N: 'blue',
  O: 'red',
  S: 'yellow',
  P: 'orange',
};

// Set an atom handler
class Atom {
  // Constructor expects the topology this atom belongs to and the atom index
  constructor (topology, atomIndex) {
    this.topology = topology;
    this.index = atomIndex;
  }
  // Atom name
  get name () {
    return this.topology.atomNames[this.index];
  }
  // Index of the residue this atom belongs to
  get residueIndex () {
    return this.topology.atomResidueIndices[this.index];
  }
  // Residue this atom belongs to
  get residue () {
    return this.topology.getResidueByIndex(this.residueIndex);
  }
  // Atom element
  get element () {
    return this.topology.atomElements[this.index];
  }
  // Viewer color representations for this atom according to tis element
  get elementColor () {
    const color = ELEMENT_COLORS[this.element];
    if (!color) return 'black';
    return color;
  }
  // Check if the resiude is coarse grained
  get isCg () {
    return this.element === CG_ATOM_ELEMENT;
  }
}

// Set a residue handler
class Residue {
  // Constructor expects the topology this residue belongs to and the residue index
  constructor(topology, residueIndex) {
    this.topology = topology;
    this.index = residueIndex;
    // Internal variables
    this._classification = undefined;
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
  get chainName () {
    return this.topology.chainNames[this.chainIndex];
  }
  // Chain handler
  get chain () {
    return this.topology.getChainByIndex(this.chainIndex);
  }
  // Insertion code
  get icode () {
    if (!this.topology.residueIcodes) return null;
    return this.topology.residueIcodes[this.index];
  }
  // NGL selection of this specific residue
  get nglSelection () {
    let selection = `:${this.chainName} and ${this.number}`
    if (this.icode) selection += ` ^${this.icode}`
    return selection;
  }
  // Residue name
  get name () {
    return this.topology.residueNames[this.index];
  }
  // Residue standard letter (e.g. ARG -> R)
  get letter () {
    if (!this.name) return;
    const letter = RESIDUE_NAME_LETTERS[this.name];
    if (letter) return letter;
    return 'X';
  }
  // Get a cassification for this residue
  // This is quite standard for proteins and nucleic acids
  // It also relies on references to classify ligands
  // However, it delegates in the 'classificationByName' function for the rest
  // Available classifications:
  // - protein
  // - dna
  // - rna
  // - carbohydrate
  // - fatty
  // - steroid
  // - ion
  // - solvent
  // - acetyl
  // - amide
  // - other
  get classification () {
    // If the classification was previously found then return the stored value
    if (this._classification !== undefined) return this._classification;
    // If this is a coarse grain residue then we can not classify it through the smart way
    // We can only rely in residue names
    if (this.isCg) {
      this._classification = this.classificationByName;
      return this._classification;
    }
    // Classify according this residue according to its atom composition
    // ----- Ions -----------------------------------------------
    // If it has only one atom then it must be an ion
    if (this.atomCount === 1) {
      this._classification = 'ion';
      return this._classification;
    }
    // ----- Solvent -----------------------------------------------
    // Solvent is water molecules
    // First rely on the residue name
    if (this.name in STANDARD_SOLVENT_RESIDUE_NAMES) {
      this._classification = 'solvent'
      return this._classification
    }
    // It may be water with a not known name
    // Literally check if its a molecule with 3 atoms: 2 hydrogens and 1 oxygen
    if (this.atomCount === 3) {
      const atomElements = this.atoms.map(atom => atom.element);
      const hydrogenCount = countElement(atomElements, 'H');
      const oxygenCount = countElement(atomElements, 'O');
      if (hydrogenCount === 2 && oxygenCount === 1) {
        this._classification = 'solvent'
        return this._classification
      }
    }
    // ----- Protein -----------------------------------------------
    // Protein definition according to vmd:
    // a residue with atoms named C, N, CA, and O
    // In our case we accept OC1 and OC2 or OT1 and OT2 instead of O for terminal residues
    const atomNames = new Set(this.atoms.map(atom => atom.name));
    if (['C', 'N', 'CA'].every(name => atomNames.has(name)) && (
      atomNames.has('O') ||
      ['OC1', 'OC2'].every(name => atomNames.has(name)) ||
      ['OT1', 'OT2'].every(name => atomNames.has(name))
    )) {
      this._classification = 'protein'
      return this._classification
    }
    // ----- Nucleic -----------------------------------------------
    // Nucleic acids definition according to vmd:
    // a residue with atoms named P, O1P, O2P and either O3’, C3’, C4’, C5’, O5’ or O3*, C3*, C4*, C5*, O5*
    // Apparently it has been fixed so now a residue does not need to be phosphorylated to be considered nucleic
    if (["O3'", "C3'", "C4'", "C5'", "O5'"].every(name => atomNames.has(name))
    || ["O3*", "C3*", "C4*", "C5*", "O5*"].every(name => atomNames.has(name))) {
      // At this point we know it is nucleic
      // We must tell the difference between DNA and RNA
      if (atomNames.has("O2'") || atomNames.has("O2*")) this._classification = 'rna'
      else this._classification = 'dna'
      return this._classification
    }
    // ----- Ligands -----------------------------------------------
    // If this residue is a ligand according to the references then classify it as ligand
    if (this.referenceType === 'ligand') {
      this._classification = 'ligand'
      return this._classification
    }
    // ----- Others -----------------------------------------------
    // If the residue does not fall in any of the previous conditions then try it with the residue name
    this._classification = this.classificationByName;
    return this._classification;
  }
  // Set an alternative function to "try" to classify the residues according only to its name
  // This is useful for corase grain residues whose atoms may not reflect the real atoms
  // WARNING: This logic is very limited and may return "unknown"
  // WARNING: This logic relies in atom names, which may be not standard
  get classificationByName () {
    if (this.name in PROTEIN_RESIDUE_NAME_LETTERS) return 'protein';
    if (this.name in DNA_RESIDUE_NAME_LETTERS) return 'dna';
    if (this.name in RNA_RESIDUE_NAME_LETTERS) return 'rna';
    if (this.name in NUCLEIC_RESIDUE_NAME_LETTERS) return 'nucleic';
    if (FATTY_RESIDUE_NAMES.has(this.name)) return 'fatty';
    if (STEROID_RESIDUE_NAMES.has(this.name)) return 'steroid';
    if (STANDARD_COUNTER_ION_ATOM_NAMES.has(this.name)) return 'ion';
    if (STANDARD_SOLVENT_RESIDUE_NAMES.has(this.name)) return 'solvent';
    // If we do not know what it is
    return 'unknown'
  }
  // Reference index in the topology
  get referenceIndex () {
    if (!this.topology.residueReferenceIndices) return null;
    return this.topology.residueReferenceIndices[this.index];
  }
  // Reference id
  get referenceId () {
    const referenceIndex = this.referenceIndex;
    if (referenceIndex === null) return null;
    return this.topology.references[referenceIndex];
  }
  // Reference type
  get referenceType () {
    const referenceIndex = this.referenceIndex;
    if (referenceIndex === null) return null;
    return this.topology.referenceTypes[referenceIndex];
  }
  // Reference residue number (reference numeration)
  get referenceNumber () {
    if (!this.topology.residueReferenceNumbers) return null;
    return this.topology.residueReferenceNumbers[this.index];
  }
  // Reference data
  get referenceData () {
    // If this residue has reference id then it belongs to no reference at all
    if (this.referenceId === null) return null;
    // Otherwise get the corresponding reference data
    if (this.referenceType === 'protein') {
      const reference = this.topology.proteinReferences.find(ref => ref.uniprot === this.referenceId);
      if (!reference) throw new Error(`Reference id ${this.referenceId} is not found among protein references`);
      return reference;
    }
    if (this.referenceType === 'ligand') {
      const reference = this.topology.ligandReferences.find(ref => ref.pubchem === this.referenceId);
      if (!reference) throw new Error(`Reference id ${this.referenceId} is not found among ligand references`);
      return reference;
    }
    throw new Error(`Not supported reference type ${this.referenceType}`);
  }
  // Reference name
  get referenceName () {
    // If this is a ligand we may have a forced name in metadata
    const forcedLigandName = this.topology.metadataLigandNames && this.topology.metadataLigandNames[this.referenceId];
    if (forcedLigandName) return forcedLigandName;
    // Get reference data
    const referenceData = this.referenceData;
    if (!referenceData) return null;
    // Now return its name
    return referenceData.name;
  }
  // Check if the resiude is in periodic boundary conditions
  get isPbc () {
    return this.topology.pbcResidues.has(this.index);
  }
  // Check if the resiude is coarse grained
  get isCg () {
    for (const atom of this.iteratoms())
      if (atom.isCg) return true;
    return false;
  }
  // Standard label for display
  get standardLabel () {
    // Add the chain to the label only if there is more than ona chain
    let labelChain = '';
    if (this.topology.chainNames.length > 1 ) labelChain = `${this.chainName}:`;
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
    const labelType = `(${this.name})`;
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
    for (const atom of this.iteratoms())
      if (atom.name === 'CA') return true;
    return false;
  }
  // Iterate residue atoms
  * iteratoms () {
    for (const atomIndex of this.atomIndices)
      yield new Atom(this.topology, atomIndex);
  }
  // Get all atoms already parsed
  get atoms () {
    return [...this.iteratoms()];
  }
};

// Set a chain handler
class Chain {
  // Constructor expects the chain index
  constructor(topology, chainIndex) {
    this.topology = topology;
    this.index = chainIndex;
  }
  // Get the chain name
  get name () {
    return this.topology.chainNames[this.index];
  }
  get letter () {
    return this.name;
  }
  // Get the metadata chain name
  get metadataChainName () {
    const metadataChainNames = this.topology.metadataChainNames;
    if (!metadataChainNames) return '';
    // OBSOLETE: Chains were stored as an array of names long time ago
    if (Array.isArray(metadataChainNames)) return metadataChainNames[this.index] || '';
    // Chains are stored as and object (e.g. { 'A': 'ACE2', 'B': 'RBD' })
    else return metadataChainNames[this.name] || '';
  }
  // Get residue indcies
  get residueIndices () {
    return this.topology.chainResidueIndices[this.index];
  }
  // Get residue numbers
  get residueNumbers () {
    return this.topology.chainResidueNumbers[this.index];
  }
  // Get the residue sequence
  get sequence () {
    return this.sequences[this.index];
  }
  // Iterate chain residues
  * iterresidues () {
    for (const residueIndex of this.residueIndices)
      yield new Residue(this.topology, residueIndex);
  }
  // Get all residues already parsed
  get residues () {
    return [...this.iterresidues()];
  }
}

export class Topology {
  constructor(topology, metadata, references) {
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
    this.referenceTypes = topology.reference_types;
    // DANI: Esta linea es para mantener las topologías viejas que solo tienen referencias de proteínas
    if (!this.referenceTypes && this.references) this.referenceTypes = this.references.map(r => 'protein');
    this.residueReferenceIndices = topology.residue_reference_indices;
    this.residueReferenceNumbers = topology.residue_reference_numbers;
    // Save atom bonds
    this.atomBonds = topology.atom_bonds
    // Save the PBC (Priodic Boundary Conditions) residues
    this.pbcResidues = topology.pbc_residues && new Set(topology.pbc_residues);
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
    // Get chain sequences by adding all residue letters together for each chain
    this.sequences = this.chainResidueIndices.map(residueIndices => 
      residueIndices.map(residueIndex => this.getResidueByIndex(residueIndex).letter).join('')
    );
    // Save metadata chain names
    // They are not letters ('A', 'B', etc.) but actual names ('Spike', 'Glycans', etc.)
    this.metadataChainNames = metadata.CHAINNAMES;
    // Save metadata forced ligand names
    this.metadataLigandNames = metadata.LIGANDNAMES;
    // Save the references so we can further return reference data from here
    this.proteinReferences = references.proteins;
    this.ligandReferences = references.ligands;
    this.chainReferences = references.chains;
    // Assign the chain name and index to every chain reference
    // Match every chain reference with its chain relying on sequence
    for (const chainReference of this.chainReferences) {
      chainReference.chains = [];
      chainReference.chain_indices = [];
      for (const [chainIndex, chainName] of Object.entries(this.chainNames)) {
        // Match sequence
        const chainSequence = this.sequences[chainIndex];
        if (chainSequence !== chainReference.sequence) continue;
        // Once we have a match assign the corresponding name and index
        chainReference.chains.push(chainName);
        chainReference.chain_indices.push(+chainIndex);
      }
      // If we did not manage to match this chain then log an error
      if (chainReference.chain_indices.length === 0)
        console.error('Unmatched chain reference ' + chainReference.sequence);
    }
  }

  // --------------------------------------------------------------------
  // BASICS
  // --------------------------------------------------------------------

  get atomCount () {
    return this.atomNames.length;
  }

  get residueCount () {
    return this.residueNumbers.length;
  }

  get chainCount () {
    return this.chainNames.length;
  }

  // --------------------------------------------------------------------
  // Atom getters
  // --------------------------------------------------------------------

  getAtomByIndex = atomIndex => {
    const count = this.atomCount;
    if (atomIndex >= count) throw new Error(
      `The atom index ${atomIndex} is out of range. There are ${count} atoms in the topology`,
    );
    return new Atom(this, atomIndex);
  };

  // --------------------------------------------------------------------
  // Residue getters
  // --------------------------------------------------------------------

  // Given a residue index, return its handler
  getResidueByIndex = residueIndex => {
    const count = this.residueCount;
    if (residueIndex >= count) throw new Error(
      `The residue index ${residueIndex} is out of range. There are ${count} residues in the topology`,
    );
    return new Residue(this, residueIndex);
  };

  // Given a residue parameters, find the residue and then return its handler
  getResidueByParameters = (chainName, number, icode = null) => {
    // Get the residue chain
    const chain = this.getChainByName(chainName);
    // Now iterate residues starting at this index
    for (const residueIndex of chain.residueIndices) {
      const residue = new Residue(this, residueIndex);
      // Check if the residue number matches
      if (residue.number !== number) continue;
      // Check if the insertion code matches
      if (residue.icode !== icode) continue;
      // If everything matches then return this residue
      return residue;
    }
    // There should always be a match
    const icode_message = icode ? `icode ${icode}` : `no icode`
    throw new Error(
      `Residue with chain ${chainName}, number ${number} and ${icode_message} does not exist`,
    );
  };

  // --------------------------------------------------------------------
  // Chain getters
  // --------------------------------------------------------------------

  // Given a chain index, return its handler
  getChainByIndex = chainIndex => {
    const count = this.chainNames.length;
    if (chainIndex >= count) throw new Error(
      `The chain index ${chainIndex} is out of range. There are ${count} chains in the topology`,
    );
    return new Chain(this, chainIndex);
  }

  // Given a chain name, find the chain and return its handler
  getChainByName = chainName => {
    const chainIndex = this.chainNames.indexOf(chainName);
    if (chainIndex === -1)
      throw new Error(`Chain ${chainName} is not found in the topology`);
    return new Chain(this, chainIndex);
  }

  // --------------------------------------------------------------------
  // ITERATORS
  // --------------------------------------------------------------------

  // Iterate topology atoms
  * iteratoms () {
    for (let atomIndex = 0; atomIndex < this.atomCount; atomIndex++) 
      yield new Atom(this, atomIndex);
  }

  // Iterate topology residues
  * iterresidues () {
    for (let residueIndex = 0; residueIndex < this.residueCount; residueIndex++) 
      yield new Residue(this, residueIndex);
  }

  // Iterate topology chains
  * iterchains () {
    for (let chainIndex = 0; chainIndex < this.chainCount; chainIndex++) 
      yield new Chain(this, chainIndex);
  }

  // --------------------------------------------------------------------
  // OTHER
  // --------------------------------------------------------------------

  // This function returns residue indices for every residue which belongs to a reference
  // The reference must be specified with the topology reference id (i.e. uniprot id)
  // Optionally, you may request only specific residue numbers according to reference numeration
  // Note that one residue in the reference may be more than once or not be at all in the topology
  getReferenceResidueIndices = (reference, residueNumbers = null) => {
    if (!this.references) return;
    // Get the requested reference index
    const referenceIndex = this.references.indexOf(reference);
    if (referenceIndex === -1) return;
    const residueIndices = [];
    this.residueReferenceIndices.forEach((refIndex, residueIndex) => {
      if (refIndex !== referenceIndex) return;
      // If no residue number were specified then simply return all residue indcies
      if (residueNumbers === null) return residueIndices.push(residueIndex);
      // Otherwise we must check
      const residueNumber = this.residueReferenceNumbers[residueIndex];
      if (residueNumbers.includes(residueNumber)) residueIndices.push(residueIndex);
    });
    return residueIndices;
  };

  // Set an NGL selection from a list of residue indices
  // e.g. [0, 1, 2, 3, ...] => nglSelection = "(A: and 1, 3-5) or (B: and 1)"
  // In addition track if there is any small serie (i.e. 3 residues or less)
  // DANI: Esta función no sería necesaria si se pudiesen hacer selecciones en NGL con índices de residuos
  // DANI: De hecho no haría falta eliminar residuos duplicados si se pudiesen hacer selecciones en NGL con índices de residuos
  residueIndices2Ngl = residueIndices => {
    const rangedSelections = [];
    let small = false;
    // Parse each residue in complex notation
    const parsedResidues = residueIndices.map(residueIndex => this.getResidueByIndex(residueIndex));
    // Get unique chains
    const chains = parsedResidues.map(r => r.chainName).filter((v, i, a) => a.indexOf(v) === i);
    // For each chain, get all residues and "range" them
    chains.forEach(chain => {
      const chainResidues = parsedResidues.filter(v => v.chainName === chain).map(r => r.number);
      const { rangedSelection: ranged, small: smallChain } = parsedSelectionRanger(chainResidues);
      rangedSelections.push(`(:${chain} and (${ranged}))`); // Al parenthesis are mandatory
      if (smallChain) small = true; // If any chain small is true then the overall small is true
    });
    // Join all ranged selections
    const rangedSelection = rangedSelections.join(' or ');
    return { rangedSelection, small };
  };

  // Given a list of residues indices, separate them by chain and return an object where keys are chain names
  // e.g. [ 1, 2, 3, 17 ] -> { 'A': [1,2,3], 'B': [17] }
  byChains = residuesIndices => {
    const chained = {};
    residuesIndices.forEach(residueIndex => {
      const chainName = this.getResidueByIndex(residueIndex).chainName;
      const current = chained[chainName];
      if (current) current.push(residueIndex);
      else chained[chainName] = [residueIndex];
    });
    return chained;
  };

  // Get all atom colors according to their elements
  getAtomELEMENT_COLORS = () => {
    return this.atomElements.map(element => {
      const color = ELEMENT_COLORS[element];
      if (!color) return 'black';
      return color;
    });
  };
}
