import { useContext, useMemo } from 'react';

import { ColormakerRegistry } from 'ngl';

import { color as d3color, scaleLinear } from 'd3';

import { ProjectCtx } from '../../../contexts';

// Set the color of each residue in the NGL representation
// WARNING: Grey looks better than white because the background may be white and resdiues are hard to see
const greyColorPlan = ['grey', 'yellow', 'red'];

// Use this hook to get the memoized NGL default representations
const useMutationsRepresentations = () => {
  // Get the topology data
  const { topology: topologyManager, references: referenceData } = useContext(
    ProjectCtx,
  );

  // Set the representations for the NGL viewer
  const mutationRepresentations = useMemo(() => {
    if (!referenceData) return;
    // Check that at least 1 of the references has entropies
    const anyReferenceMutations = referenceData.some(
      reference => !!reference.entropies,
    );
    if (!anyReferenceMutations) return;

    // Get the entorpies of each reference
    // Save the logarithmic values on each reference
    const entropiesPerReference = referenceData.map(reference => {
      if (!reference.entropies) return [];
      const logarithmicEntropies = reference.entropies.map(entropy =>
        Math.log(entropy + 0.0001),
      );
      reference.logarithmicEntropies = logarithmicEntropies;
      return logarithmicEntropies;
    });

    // Save all array values together just to check the minimum and maximum values
    const allEntropies = [].concat.apply([], entropiesPerReference);
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
        const ref = topologyManager.absolute2reference(residue);
        // If no reference residue was found then paint it white
        if (!ref) return parseInt('ffffff', 16);
        const { id: referenceId, index: residueIndex } = ref;
        // get the corresponding entropy
        // -1 because the residue 'x' would be the index 'x-1' in the array
        const reference = referenceData.find(
          reference => reference.uniprot === referenceId,
        );
        const entropies = reference.logarithmicEntropies;
        if (!entropies || entropies.length === 0) return parseInt('ffffff', 16);
        const entropy = entropies[residueIndex - 1];
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
  }, [referenceData, topologyManager]);

  return mutationRepresentations;
};

export default useMutationsRepresentations;
