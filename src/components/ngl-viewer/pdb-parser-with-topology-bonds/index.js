import { ParserRegistry, Structure } from 'ngl';

import { MMCIF, PDB } from '../../../utils/structure-format';

// NGL guesses the structure bonds while parsing a PDB, but we replace them further by the topology bonds
// Most of this time goes to search neighbour atoms for every non-polymer atom (lipids, ions, ligands...)
// This search takes ~190 ms in membrane systems (~95k atoms) and the bonds it finds are discarded anyway
// This parser hides the structure spatial hash while bonds are calculated, so the search finds nothing
// Backbone bonds, which are needed by the cartoon, do not use the spatial hash so they are still calculated
// The mmCIF parser guesses bonds the same way, so the same trick applies to it
const withTopologyBonds = Parser => class extends Parser {
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
};
export const PDB_WITH_TOPOLOGY_BONDS = 'pdb-with-topology-bonds';
ParserRegistry.add(PDB_WITH_TOPOLOGY_BONDS, withTopologyBonds(ParserRegistry.get('pdb')));
export const CIF_WITH_TOPOLOGY_BONDS = 'cif-with-topology-bonds';
ParserRegistry.add(CIF_WITH_TOPOLOGY_BONDS, withTopologyBonds(ParserRegistry.get('cif')));

// NGL file extensions for every structure format, with and without the topology bonds trick
export const NGL_EXTENSIONS = {
  [PDB]: { stock: 'pdb', topologyBonds: PDB_WITH_TOPOLOGY_BONDS },
  [MMCIF]: { stock: 'cif', topologyBonds: CIF_WITH_TOPOLOGY_BONDS },
};
