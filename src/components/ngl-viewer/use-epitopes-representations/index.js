import { useContext, useMemo } from 'react';

import { ProjectCtx, ToporefsCtx, PdbCtx } from '../../../contexts';

import {
  absolute2sourceResidue,
  complexSelectionRanger,
  reference2absolute,
} from '../../../utils/topology-manager';

// Use this hook to get the memoized NGL default representations
const useEpitopesRepresentations = () => {
  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);
  // Get the toporefs data
  const toporefData = useContext(ToporefsCtx);
  // Get the current topology
  const pdbData = useContext(PdbCtx);
  const topology = pdbData.file;

  // Set the representations for the NGL viewer
  const epitopesRepresentations = useMemo(() => {
    if (!toporefData) return;
    // Check that at least 1 of the toporefs has epitopes
    const anyToporefEpitopes = toporefData.some(toporef => !!toporef.epitopes);
    if (!anyToporefEpitopes) return;
    const toporefs = metadata.TOPOREFS;
    if (!toporefs || toporefs.length === 0) return;
    // Check that we have a map for at least 1 toporef
    const anyMappedToporef = toporefs.some(toporef => !!toporef.map);
    if (!anyMappedToporef) return;
    // Get the residues on each toporef epitopes in the current topology numeration
    const mappedResiduesPerToporef = toporefData.map(toporef => {
      // Get the toporef name and epitopes
      const toporefName = toporef.name;
      const toporefEpitopes = toporef.epitopes;
      if (!toporefEpitopes) return [];
      // Save all epitope residues together and eliminate duplicates
      const epitopeResidues = Object.values(toporefEpitopes).map(
        epitope => epitope.residues,
      );
      const allResidues = [].concat.apply([], epitopeResidues);
      const uniqueResidues = Array.from(new Set(allResidues));
      const mappedResidues = reference2absolute(
        toporefName,
        uniqueResidues,
        metadata,
      );
      if (!mappedResidues) return [];
      return mappedResidues;
    });
    // Join all previous mapped residues together
    const allMappedResidues = [].concat.apply(
      [],
      Object.values(mappedResiduesPerToporef),
    );
    // Transform mapped residues, which comes in absolute numeration, to the source format
    // The source numeration is compatible with NGL once parsed
    const sourceResidues = allMappedResidues.map(
      residue => absolute2sourceResidue(residue, topology).numeration,
    );
    const { rangedSelection, small } = complexSelectionRanger(sourceResidues);
    const reps = [
      {
        name: 'Epitopes',
        selection: rangedSelection || 'none',
        type: small ? 'licorice' : 'cartoon',
        color: 'purple',
      },
    ];
    return reps;
  }, [toporefData, metadata, topology]);

  return epitopesRepresentations;
};

export default useEpitopesRepresentations;
