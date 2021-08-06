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
} from '@material-ui/core';
*/
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';
import useMutationsRepresentations from '../../../components/ngl-viewer/use-mutations-representations';

import style from './style.module.css';

import Loading from '../../../components/loading';

import { PdbCtx, ProjectCtx, ToporefsCtx } from '../../../contexts';

import {
  getResiduesCount,
  absolute2reference,
  absolute2modelResidue,
} from '../../../utils/topology-manager';

import ResidueSelector from '../../../components/residue-selector';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const Mutations = () => {
  // Track if the NGL viewer
  // The status isNglVisible is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the toporefs data
  const toporefData = useContext(ToporefsCtx);
  // Get the current topology
  const pdbData = useContext(PdbCtx);
  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);

  const sequences = useMemo(() => {
    const topology = pdbData.file;
    const residuesCount = getResiduesCount(topology);
    const chains = {};
    // Iterate over all residues in the topology to find their corresponding entropy
    // Organize the resiudes data by 'chains' according to the residue selector input format
    for (let i = 0; i < residuesCount; i++) {
      const reference = absolute2reference(i, metadata);
      if (!reference) continue;
      const { name: toporefName, index: residueIndex } = reference;
      // We substract 1 from the residueIndex since it counts from 1 to n as toporefs do
      // However, entropies is a list, so their indexes count from 0 to n as usual
      const entropy = toporefData.find(data => data.name === toporefName)
        .entropies[residueIndex - 1];
      if (!entropy) continue;
      const model = absolute2modelResidue(i, topology, metadata);
      const fResidue = {
        letter: model.letter,
        numeration: model.numeration,
        tooltip: `Entropy: ${entropy}`,
        value: entropy,
      };
      const chain = model.chain;
      const current = chains[chain];
      if (current) chains[chain].push(fResidue);
      else chains[chain] = [fResidue];
    }
    // Format residues data as the residue selector requires
    const sequences = Object.entries(chains).map(([chain, residues]) => {
      return {
        name: 'Chain ' + chain,
        residues: residues,
      };
    });
    return sequences;
  }, [toporefData, pdbData, metadata]);

  // Set when one point in the graph is selected
  const [selectedResidues, setSelectedResidues] = useState([]);

  // Set the representations for the NGL viewer
  const representations = useMutationsRepresentations();

  // When a residue is selected
  const handleSelect = useCallback(
    residue => {
      const numeration = residue.numeration;
      setSelectedResidues(previous => [...previous, numeration]);
    },
    [setSelectedResidues],
  );
  // When a residue is deselected
  const handleDeselect = useCallback(
    residue => {
      const numeration = residue.numeration;
      setSelectedResidues(previous => {
        const newState = [...previous];
        const index = newState.indexOf(numeration);
        newState.splice(index, 1);
        return newState;
      });
    },
    [setSelectedResidues],
  );
  // When the clean all residues button is clicked
  const handleClean = useCallback(() => {
    setSelectedResidues([]);
  }, [setSelectedResidues]);

  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.nglcard} ref={nglRef}>
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <NGLViewerWithControls
            className={style.container}
            representations={representations}
            selectedResidues={selectedResidues}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
      <ResidueSelector
        sequences={sequences}
        legendTitle={'Entropy'}
        onSelect={handleSelect}
        onDeselect={handleDeselect}
        onClean={handleClean}
      />
    </Suspense>
  );
};

export default Mutations;
