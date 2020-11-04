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
    if (metadata.LIGANDS) {
      for (const ligand of metadata.LIGANDS) {
        reps.push({
          name: ligand.name,
          selection: ligand.ngl_selection,
          defaultDrawingMethod: 'licorice',
        });
      }
    }
    // Represent all chains which are not in the 'chains' list (i.e. not protein chains) in licorice
    if (metadata.CHAINNAMES && !Array.isArray(metadata.CHAINNAMES)) {
      const chainnames = Object.entries(metadata.CHAINNAMES);
      chainnames.forEach(([chain, name]) => {
        if (chains.indexOf(chain) !== -1) return;
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
