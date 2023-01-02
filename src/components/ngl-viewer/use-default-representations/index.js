// React logic
import { useMemo, useContext } from 'react';

import { ProjectCtx, PdbCtx } from '../../../contexts';

import { nglSelection2absolute } from '../../../utils/topology-manager';

// Use this hook to get the memoized NGL default representations
const useDefaultRepresentations = () => {
  // Get the current project metadata and chains
  const projectData = useContext(ProjectCtx);
  // Get current structure
  const { file: structure } = useContext(PdbCtx);
  //console.log(structure.residueMap.get(0).isCg());
  // Set the chains to be represented in the NGL viewer by default
  // WARNING: This is experimental and may have some bugs
  const defaultRepresentations = useMemo(() => {
    const reps = [];
    const { chains, metadata, topology: topologyManager } = projectData;
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
      // If chainnames are not defined then set a general protein representation
      else {
        reps.push({
          name: 'Protein',
          selection: 'protein',
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
      // Show also all ligands with licorice representations
      const ligands = metadata.LIGANDS;
      if (ligands) {
        for (const ligand of ligands) {
          reps.push({
            name: ligand.name,
            selection: ligand.ngl,
            type: 'licorice',
          });
        }
      }
      // Represent all chains which are not in the 'chains' and 'ligands' list in licorice
      if (chainnames && !Array.isArray(chainnames)) {
        const chainsAndNames = Object.entries(chainnames);
        chainsAndNames.forEach(([chain, name]) => {
          // Check if the chain is in the protein chains
          const isProtein = chains.indexOf(chain) !== -1;
          // Check if the name matches any ligand name
          const isLigand =
            ligands && ligands.find(ligand => ligand.name === name);
          // If there is any coincidence then skip this chainname
          if (isProtein || isLigand) return;
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

    // Add a representation for ions in spacefill in case there are residues with 1 atom
    const someSingleAtomResidue = structure.residueStore.atomCount.some(
      count => count === 1,
    );
    if (someSingleAtomResidue) {
      reps.push({
        name: 'Ions',
        selection: 'ion',
        type: 'spacefill',
        color: 'element',
      });
    }

    // Get all residues which are not already included on any previous section
    // Get also all residues which are represented as cartoon but are not protein or nucleic acid
    // i.e. residues which would not be represented by now
    const representedResidues = [];
    reps.forEach(rep => {
      const isCartoon = rep.type === undefined || rep.type === 'cartoon';
      const residues = nglSelection2absolute(
        rep.selection,
        isCartoon,
        structure,
      );
      representedResidues.push(...residues);
    });
    const residuesCount = topologyManager.getResiduesCount();
    const nonRepresentedResidues = [];
    for (let i = 0; i < residuesCount; i++) {
      if (representedResidues.indexOf(i) === -1) nonRepresentedResidues.push(i);
    }

    // Represent those "Other" residues in low opacity grey licorice
    if (nonRepresentedResidues.length > 0) {
      const {
        rangedSelection: otherSelection,
      } = topologyManager.absoluteSelectionToNgl(nonRepresentedResidues);
      reps.push({
        name: 'Other',
        selection: otherSelection,
        type: 'licorice',
        color: 'grey',
        opacity: 0.3,
      });
    }

    return reps;
  }, [projectData, structure]);

  return defaultRepresentations;
};

export default useDefaultRepresentations;
