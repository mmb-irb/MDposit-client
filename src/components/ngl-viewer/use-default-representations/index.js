// React logic
import { useMemo, useContext } from 'react';

import { ProjectCtx, PdbCtx } from '../../../contexts';

import { nglSelection2residueIndices, nglSelectionExists } from '../../../utils/topology-manager';

// Use this hook to get the memoized NGL default representations
const useDefaultRepresentations = () => {
  // Get the current project metadata and chains
  const { chains, metadata, topology } = useContext(ProjectCtx);
  // Get current structure
  const { file: structure } = useContext(PdbCtx);
  //console.log(structure.residueMap.get(0).isCg());
  // Set the chains to be represented in the NGL viewer by default
  // WARNING: This is experimental and may have some bugs
  const defaultRepresentations = useMemo(() => {
    if (!topology) return [];
    const reps = [];
    const ligands = metadata && metadata.LIGANDS;
    if (metadata && chains) {
      const chainnames = metadata.CHAINNAMES;
      // Represent each protein chain
      if (chainnames) {
        for (const chain of chains) {
          const name = chainnames[chain];
          reps.push({
            name: name ? name + ' (Chain ' + chain + ')' : 'Chain ' + chain,
            selection: ':' + chain,
          });
        }
      }
      // If chainnames are not defined then set a general representation
      else {
        const generalRepresentations = [
          { name: 'Protein', selection: 'protein' },
          { name: 'Nucleic acids', selection: 'nucleic' }
        ]
        // Add the representation only if it contains any atom
        generalRepresentations.forEach(rep => {
          const exists = nglSelectionExists(rep.selection, structure);
          if (exists) reps.push(rep);
        });
      }

      // Represent the mebrane if exist
      /*
          if (metadata.MEMBRANE !== 'No')
              reps.push({
              selection: '(not polymer or hetero) and not (water or ion)',
              name: metadata.MEMBRANE,
              type: 'licorice',
              opacity: 0.5,
              });
          */
      // Represent all chains which are not in the 'chains' and 'ligands' list in licorice
      if (chainnames && !Array.isArray(chainnames)) {
        const chainsAndNames = Object.entries(chainnames);
        chainsAndNames.forEach(([chain, name]) => {
          // Check if the chain is in the protein chains
          const isProtein = chains.indexOf(chain) !== -1;
          if (isProtein) return;
          // Check if the chain is full ligand
          // DANI: No se ha probado
          const topologyChain = topology.getChainByName(chain);
          const isLigand = topologyChain.residues.every(residue => residue.isLigand);
          // If there is any coincidence then skip this chainname
          if (isLigand) return;
          reps.push({
            name: name,
            selection: ':' + chain,
            type: 'licorice',
            color: 'purple',
            opacity: 0.5,
          });
        });
      }
    }
    // If there is no metadata/chains then set up a defualt generic representation
    else {
      reps.push({ name: 'Main structure' });
    }

    // Display ligands
    if (ligands) {
      for (const ligand of ligands) {
        // New system: ligands are pubchem ids
        if (typeof ligand === 'string') {
          // Get ligand reisude indcies
          const ligandResidueIndices = topology.getReferenceResidueIndices(ligand);
          if (!ligandResidueIndices || ligandResidueIndices.length === 0) continue;
          // Transform the residue indices to a NGL selection
          const { rangedSelection: nglSelection } = topology.residueIndices2Ngl(ligandResidueIndices);
          // Add the representation
          reps.push({
            name: ligand,
            selection: nglSelection,
            type: 'ball+stick',
            color: 'element'
          });
        }
        // Old system: ligands are objects which may have a ngl selection
        else{
          if (!ligand.ngl) continue;
          reps.push({
            name: ligand.name,
            selection: ligand.ngl,
            type: 'licorice',
          });
        }
        
      }
    }

    // Add a representation for ions in spacefill in case there are residues with 1 atom
    const singleAtomIndices = []
    topology.residueAtomIndices.forEach(atomIndices => {
      if (atomIndices.length > 1) return;
      singleAtomIndices.push(atomIndices[0]);
    })
    if (singleAtomIndices.length > 0) {
      const singleAtomSelection = '@' + singleAtomIndices.join(',');
      reps.push({
        name: 'Ions',
        selection: singleAtomSelection,
        type: 'spacefill',
        color: 'element',
      });
    }

    // Represent "Other" residues in low opacity grey licorice
    // Get all residues which are not already included on any previous section
    // Get also all residues which are represented as cartoon but are not protein or nucleic acid
    // i.e. residues which would not be represented by now
    const representedResidues = [];
    reps.forEach(rep => {
      const isCartoon = rep.type === undefined || rep.type === 'cartoon';
      const residues = nglSelection2residueIndices(
        rep.selection,
        isCartoon,
        structure,
      );
      representedResidues.push(...residues);
    });
    const residuesCount = topology.getResiduesCount();
    const nonRepresentedResidues = [];
    for (let i = 0; i < residuesCount; i++) {
      if (representedResidues.indexOf(i) === -1) nonRepresentedResidues.push(i);
    }
    if (nonRepresentedResidues.length > 0) {
      const {
        rangedSelection: otherSelection,
      } = topology.residueIndices2Ngl(nonRepresentedResidues);
      reps.push({
        name: 'Other',
        selection: otherSelection,
        type: 'licorice',
        color: 'grey',
        opacity: 0.3,
      });
    }

    return reps;
  }, [chains, metadata, topology, structure]);

  return defaultRepresentations;
};

export default useDefaultRepresentations;
