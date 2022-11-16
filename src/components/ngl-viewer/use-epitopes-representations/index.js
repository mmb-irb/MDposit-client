import { useContext, useMemo } from 'react';

import { ProjectCtx } from '../../../contexts';

// Use this hook to get the memoized NGL default representations
const useEpitopesRepresentations = () => {
  // Get the current project data
  const { references: referenceData, topology: topologyManager } = useContext(
    ProjectCtx,
  );
  // Set the representations for the NGL viewer
  const epitopesRepresentations = useMemo(() => {
    if (!referenceData) return;
    // Check that at least 1 of the references has epitopes
    const anyReferenceEpitopes = referenceData.some(
      reference => !!reference.epitopes,
    );
    if (!anyReferenceEpitopes) return;
    // Get the residues on each reference epitopes in the current topology numeration
    const mappedResiduesPerReference = referenceData.map(reference => {
      // Get the reference name and epitopes
      const referenceId = reference.id;
      const referenceEpitopes = reference.epitopes;
      if (!referenceEpitopes) return [];
      // Save all epitope residues together and eliminate duplicates
      const epitopeResidues = Object.values(referenceEpitopes).map(
        epitope => epitope.residues,
      );
      const allResidues = [].concat.apply([], epitopeResidues);
      const uniqueResidues = Array.from(new Set(allResidues));
      const mappedResidues = topologyManager.reference2absolute(
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
    // Transform mapped residues, which comes in absolute numeration, to the source format
    // The source numeration is compatible with NGL once parsed
    const { rangedSelection, small } = topologyManager.absoluteSelectionToNgl(
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
  }, [topologyManager, referenceData]);

  return epitopesRepresentations;
};

export default useEpitopesRepresentations;
