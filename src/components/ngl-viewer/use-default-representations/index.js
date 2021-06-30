// React logic
import { useMemo, useContext } from 'react';

import { ProjectCtx } from '../../../contexts';

// Use this hook to get the memoized NGL default representations
const useDefaultRepresentations = () => {
  // Get the current project metadata and chains
  const { chains, metadata } = useContext(ProjectCtx);
  // Set the chains to be represented in the NGL viewer by default
  // WARNING: This is experimental and may have some bugs
  const defaultRepresentations = useMemo(() => {
    if (!metadata || !chains) return [{ name: 'Structure' }];
    const chainnames = metadata.CHAINNAMES;
    // Represent each protein chain
    const reps = [];
    for (const chain of chains) {
      const name = chainnames[chain];
      reps.push({
        name: name ? name + ' (Chain ' + chain + ')' : 'Chain ' + chain,
        selection: ':' + chain,
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
          color: 'grey',
          opacity: 0.3,
        });
      });
    }

    // DANI: Hardcodeado para trayectorias de Rebecca Wade
    if (metadata.PDBID === '6ACC') {
      reps.push({
        name: 'Other',
        selection: 'not Protein',
        type: 'licorice',
        color: 'grey',
        opacity: 0.3,
      });
    }

    return reps;
  }, [chains, metadata]);

  return defaultRepresentations;
};

export default useDefaultRepresentations;
