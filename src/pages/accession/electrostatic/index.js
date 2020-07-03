import React, { useContext } from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

import Card from '../../../components/animated-card';
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';

import style from './style.module.css';

//import { AccessionCtx } from '../../../contexts';
import { ProjectCtx } from '../../../contexts';

import Info from '../../../components/info';

//import { BASE_PATH_PROJECTS } from '../../../utils/constants';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const Trajectory = () => {
  // useInView acts as a React hook
  // Track if the NGL viewer (nglRef) and the analyses (nightingaleRef) are on screen
  // The status (e.g. isNglVisible) is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the accession
  //const accession = useContext(AccessionCtx);
  // Get the current project chains
  const { chains } = useContext(ProjectCtx);

  // Get the API URL of the average structure
  //const structureURL = `${BASE_PATH_PROJECTS}${accession}/files/md.average.pdb`;

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
        <Info
          reference={'electrostatic'}
          tooltip={
            <>
              This is the electrostatic potencial surface representation.
              <br />
              <br />
              The{' '}
              <a
                href="http://nglviewer.org/"
                target="_blank"
                rel="noreferrer noopener"
              >
                NGL viewer
              </a>{' '}
              represents the main structures and the interface surfaces between
              two interacting proteins. Surfaces are painted according the
              electrostatic potencial.
              <br />
              <br />
              Trajectory is not loaded in this context because the surface
              representation is too heavy to be updated dinamically.
            </>
          }
        />
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <NGLViewerWithControls
            className={style.container}
            //structureURL={structureURL}
            representations={chainsNGL}
            requestedFrame={0}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
    </>
  );
};

export default Trajectory;
