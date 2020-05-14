import React, { useContext } from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

import Card from '../../../components/animated-card';
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';

import style from './style.module.css';

import { AccessionCtx } from '../../../contexts';
import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const Trajectory = () => {
  // useInView acts as a React hook
  // Track if the NGL viewer (nglRef) and the analyses (nightingaleRef) are on screen
  // The status (e.g. isNglVisible) is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project chains
  const { chains } = useContext(ProjectCtx);

  // Get the API URL of the average structure
  const structureURL = `${BASE_PATH_PROJECTS}${accession}/files/average.pdb`;

  // Set the chains to be represented in the NGL viewer
  const chainsNGL = [];
  for (const c in chains) {
    // The last chain is represented as licorice
    if (+c === +(chains.length - 1)) {
      chainsNGL.push({
        name: 'Chain ' + chains[c],
        selection: ':' + chains[c],
        defaultDrawingMethod: 'licorice',
      });
    } else {
      chainsNGL.push({
        name: 'Chain ' + chains[c],
        selection: ':' + chains[c],
        defaultDrawingMethod: 'surface',
        defaultColoringMethod: 'electrostatic',
      });
    }
  }

  return (
    <>
      <Card className={style.card} ref={nglRef}>
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <NGLViewerWithControls
            className={style.container}
            structureURL={structureURL}
            chains={chainsNGL}
            noTrajectory={true}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
    </>
  );
};

export default Trajectory;
