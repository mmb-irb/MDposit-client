// React logic
import { useMemo } from 'react';

// Use this hook to get the memoized NGL default representations
const useDefaultRepresentations = (chains, metadata) => {
  // Set the chains to be represented in the NGL viewer by default
  // WARNING: This is experimental and may have some bugs
  const defaultRepresentations = useMemo(() => {
    if (!metadata || !chains) return [{ name: 'Structure' }];
    // Represent each protein chain
    const reps = [];
    for (const chain of chains) {
      reps.push({
        name: 'Chain ' + chain,
        selection: ':' + chain,
      });
    }
    // Represent the mebrane if exist
    /*
        if (metadata.MEMBRANE !== 'No')
            reps.push({
            selection: '(not polymer or hetero) and not (water or ion)',
            name: metadata.MEMBRANE,
            defaultDrawingMethod: 'licorice',
            defaultOpacity: 0.5,
            });
        */
    // Show also all ligands with licorice representations
    const ligands = metadata.LIGANDS;
    if (ligands) {
      for (const ligand of ligands) {
        reps.push({
          name: ligand.name,
          selection: ligand.ngl,
          defaultDrawingMethod: 'licorice',
        });
      }
    }
    // Represent all chains which are not in the 'chains' and 'ligands' list in licorice
    const chainnames = metadata.CHAINNAMES;
    if (chainnames && !Array.isArray(chainnames)) {
      const chainsAndNames = Object.entries(chainnames);
      chainsAndNames.forEach(([chain, name]) => {
        // Check if the chain is in the protein chains
        const isProtein = chains.indexOf(chain) !== -1;
        // Check if the name matches any ligand name
        const isLigand = ligands.find(ligand => ligand.name === name);
        // If there is any coincidence then skip this chainname
        if (isProtein || isLigand) return;
        reps.push({
          name: name,
          selection: ':' + chain,
          defaultDrawingMethod: 'licorice',
          defaultColoringMethod: 'grey',
          defaultOpacity: 0.3,
        });
      });
    }

    return reps;
  }, [chains, metadata]);

  return defaultRepresentations;
};

export default useDefaultRepresentations;
