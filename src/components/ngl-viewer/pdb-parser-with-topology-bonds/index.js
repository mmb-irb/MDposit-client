import { ParserRegistry, Structure } from 'ngl';

// NGL guesses the structure bonds while parsing a PDB, but we replace them further by the topology bonds
// Most of this time goes to search neighbour atoms for every non-polymer atom (lipids, ions, ligands...)
// This search takes ~190 ms in membrane systems (~95k atoms) and the bonds it finds are discarded anyway
// This parser hides the structure spatial hash while bonds are calculated, so the search finds nothing
// Backbone bonds, which are needed by the cartoon, do not use the spatial hash so they are still calculated
const PdbParser = ParserRegistry.get('pdb');
class PdbParserWithTopologyBonds extends PdbParser {
  _parse () {
    const structure = this.structure;
    let spatialHash;
    structure.finalizeAtoms = () => {
      Structure.prototype.finalizeAtoms.call(structure);
      spatialHash = structure.spatialHash;
      structure.spatialHash = { eachWithin: () => {} };
    };
    structure.finalizeBonds = () => {
      structure.spatialHash = spatialHash;
      Structure.prototype.finalizeBonds.call(structure);
    };
    try { super._parse(); }
    finally {
      delete structure.finalizeAtoms;
      delete structure.finalizeBonds;
    }
  }
}
export const PDB_WITH_TOPOLOGY_BONDS = 'pdb-with-topology-bonds';
ParserRegistry.add(PDB_WITH_TOPOLOGY_BONDS, PdbParserWithTopologyBonds);
