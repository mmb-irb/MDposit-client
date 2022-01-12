import { useContext, useMemo } from 'react';

import { ColormakerRegistry } from 'ngl';

import { color as d3color, scaleLinear } from 'd3';

import { ProjectCtx, ToporefsCtx } from '../../../contexts';

// Set the color of each residue in the NGL representation
// WARNING: Grey looks better than white because the background may be white and resdiues are hard to see
const greyColorPlan = ['grey', 'yellow', 'red'];

// Use this hook to get the memoized NGL default representations
const useMutationsRepresentations = () => {
  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);
  // Get the toporefs data
  const toporefData = useContext(ToporefsCtx);

  // Set the representations for the NGL viewer
  const mutationRepresentations = useMemo(() => {
    if (!toporefData) return;
    // Check that at least 1 of the toporefs has entropies
    const anyToporefMutations = toporefData.some(
      toporef => !!toporef.entropies,
    );
    if (!anyToporefMutations) return;
    const toporefs = metadata.TOPOREFS;
    if (!toporefs || toporefs.length === 0) return;
    // Check that we have a map for at least 1 toporef
    const anyMappedToporef = toporefs.some(toporef => !!toporef.map);
    if (!anyMappedToporef) return;

    // Build a residues map from the topology reference
    const toporefMap = residue => {
      for (const [index, toporef] of toporefs.entries()) {
        if (!toporef.map) continue;
        const equivalent = toporef.map[residue];
        if (!equivalent) continue;
        return [equivalent, index];
      }
      return [null, null];
    };

    // Get the entorpies of each toporef
    // Save the logarithmic values
    const entropiesPerToporef = toporefData.map(toporef => {
      if (!toporef.entropies) return [];
      return toporef.entropies.map(entropy => Math.log(entropy + 0.0001));
    });

    // Save all array values together just to check the minimum and maximum values
    const allEntropies = [].concat.apply([], entropiesPerToporef);
    const max = Math.max(...allEntropies);
    const min = Math.min(...allEntropies);

    // Set the color scale according to the maximum and minimum means
    const colorScale = scaleLinear()
      .range(greyColorPlan)
      .domain([min, (min + max) / 2, max]);

    const colorScheme = ColormakerRegistry.addScheme(function(params) {
      this.atomColor = atom => {
        // Find the residue index and then the entropy for this residue
        // WARNING: atom.residueIndex starts the count at 0 although it may seem that starts at 1
        // WARNING: It may happen that the first residue is a capping terminal and it is skipped
        // WARNING: The cartoon representation would skip the non-standard residue and start by 1
        const residue = atom.residueIndex;
        const [mapedResidue, toporefIndex] = toporefMap(residue);
        //console.log(residue + ' -> ' + mapedResidue);
        // If no residue was found then paint it white
        if (mapedResidue === null) return parseInt('ffffff', 16);
        // get the corresponding entropy
        // -1 because the residue 'x' would be the index 'x-1' in the array
        const entropies = entropiesPerToporef[toporefIndex];
        if (!entropies || entropies.length === 0) return parseInt('ffffff', 16);
        const entropy = entropies[mapedResidue - 1];
        // If there is no entropy at this point probably there is something wrong with the map
        if (!entropy) return parseInt('ffffff', 16);
        // Calculate the interpolated rgb for this value
        // The interpolated color comes in rbg format
        const hexColor = d3color(colorScale(entropy)).formatHex();
        // The color interpolation returns a string like '#000000'
        // We remove the first character ('#') and parse it to integer from hexadecimal
        const color = parseInt(hexColor.substring(1), 16);
        return color;
      };
    });

    const reps = [
      { name: 'Mutations', color: 'custom', customScheme: colorScheme },
    ];
    return reps;
  }, [toporefData, metadata]);

  return mutationRepresentations;
};

export default useMutationsRepresentations;
