import { useContext, useMemo } from 'react';

import { ProjectCtx } from '../../../contexts';

// Use this hook to get the memoized NGL default representations
const useEpitopesRepresentations = () => {
  // Get the current project data
  const { proteinReferences, topology } = useContext(
    ProjectCtx,
  );
  // Set the representations for the NGL viewer
  const epitopesRepresentations = useMemo(() => {
    if (!proteinReferences || !topology) return;
    // Check that at least 1 of the proteinReferences has epitopes
    const anyReferenceEpitopes = proteinReferences.some(
      reference => !!reference.epitopes,
    );
    if (!anyReferenceEpitopes) return;
    // Get the residues on each reference epitopes in the current topology numeration
    const mappedResiduesPerReference = proteinReferences.map(reference => {
      // Get the reference name and epitopes
      const referenceId = reference.uniprot;
      const referenceEpitopes = reference.epitopes;
      if (!referenceEpitopes) return [];
      // Save all epitope residues together and eliminate duplicates
      const epitopeResidues = Object.values(referenceEpitopes).map(
        epitope => epitope.residues,
      );
      const allResidues = [].concat.apply([], epitopeResidues);
      const uniqueResidues = Array.from(new Set(allResidues));
      const mappedResidues = topology.getReferenceResidueIndices(
        referenceId,
        uniqueResidues,
      );
      if (!mappedResidues) return [];
      return mappedResidues;
    });
    // Join all previous mapped residues together
    const allMappedResidues = [].concat.apply(
      [],
      Object.values(mappedResiduesPerReference),
    );
    // Transform mapped residues indices to an NGL selection
    const { rangedSelection, small } = topology.residueIndices2Ngl(
      allMappedResidues,
    );
    const reps = [
      {
        name: 'Epitopes',
        selection: rangedSelection || 'none',
        type: small ? 'licorice' : 'cartoon',
        color: 'purple',
      },
    ];
    return reps;
  }, [topology, proteinReferences]);

  return epitopesRepresentations;
};

export default useEpitopesRepresentations;
