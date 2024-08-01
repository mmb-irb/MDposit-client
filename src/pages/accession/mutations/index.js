import React, {
  Suspense,
  useContext,
  useMemo,
  useState,
  useCallback,
} from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

import Card from '../../../components/animated-card';
/*
import {
  CardContent,
} from '@mui/material';
*/
import ViewerWithControls from '../../../components/viewer-with-controls';
import useMutationsRepresentations from '../../../components/ngl-viewer/use-mutations-representations';

import style from './style.module.css';

import Loading from '../../../components/loading';

import { REFERENCES_WITH_ENTROPIES } from '../../../utils/constants';

import { ProjectCtx } from '../../../contexts';

import ResidueSelector from '../../../components/residue-selector';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const Mutations = () => {
  // Track if the NGL viewer
  // The status isNglVisible is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the current project data
  const { topology: topologyManager } = useContext(ProjectCtx);

  const residueEntropies = useMemo(() => {
    if (!topologyManager) return;
    // Determine if this project has entropies
    // Otherwise stop here
    const valid_references = topologyManager.proteinReferences.filter(
      ref => REFERENCES_WITH_ENTROPIES.includes('ref')
    );
    if (valid_references.length === 0) return;
    // Iterate over all residues in the topology to find their corresponding entropy
    const residuesCount = topologyManager.residueCount;
    const residueEntropies = new Array(residuesCount).fill(null);
    // Iterate over all residues in the topology to find their corresponding entropy
    for (let i = 0; i < residuesCount; i++) {
      const residue = topologyManager.getResidueByIndex(i);
      const referenceId = residue.referenceId;
      if (!referenceId) continue;
      // We substract 1 from the residue index since it counts from 1 to n as references do
      const residueReferenceIndex = residue.referenceNumber - 1;
      const currentproteinReference = residue.referenceData;
      const entropies = currentproteinReference.entropies;
      if (!entropies) continue;
      const entropy = entropies[residueReferenceIndex];
      if (entropy === undefined) continue;
      const logarithmicEntropy =
        Math.round(Math.log(entropy + 0.0001) * 1000) / 1000;
      residueEntropies[i] = logarithmicEntropy;
    }
    return residueEntropies;
  }, [topologyManager]);

  // Set when one point in the graph is selected
  const [selectedResidues, setSelectedResidues] = useState([]);
  // Get the selected residue indices
  const selectedResidueIndices = selectedResidues.map(
    residue => +residue.index,
  );

  // Set the representations for the NGL viewer
  const representations = useMutationsRepresentations();

  // When a residue is selected
  const handleSelect = useCallback(
    (residue, residueIndex, color) => {
      const selectedResidue = { color, index: residueIndex };
      setSelectedResidues(previous => [...previous, selectedResidue]);
    },
    [setSelectedResidues],
  );
  // When a residue is deselected
  const handleDeselect = useCallback(
    (residue, residueIndex) => {
      setSelectedResidues(previous =>
        previous.filter(residue => residue.index !== residueIndex),
      );
    },
    [setSelectedResidues],
  );
  // When the clean all residues button is clicked
  const handleClean = useCallback(() => {
    setSelectedResidues([]);
  }, [setSelectedResidues]);

  // Handle what to write on the tooltip when the user hovers a specific residue letter
  const handleTooltip = useCallback(residue => {
    const value = Math.round(residue.value * 100) / 100;
    return `Logarithmic entropy: ${value}`;
  }, []);

  // This data was added manually to the spike reference
  // If this is missing you may be not in the covid database or the reference has been overwritten
  if (topologyManager && !residueEntropies) return 'Missing entropies data';
  if (!representations) return <Loading />;

  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.nglcard} ref={nglRef}>
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <ViewerWithControls
            className={style.container}
            startingRepresentations={representations}
            selectedResidueIndices={selectedResidueIndices}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
      <Card>
        <ResidueSelector
          residueValues={residueEntropies}
          legendTitle={'Logarithmic entropy'}
          onSelect={handleSelect}
          onDeselect={handleDeselect}
          onClean={handleClean}
          onTooltip={handleTooltip}
          className={style.selector}
        />
      </Card>
    </Suspense>
  );
};

export default Mutations;
