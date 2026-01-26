import React, { useState } from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

// Visual components
import Card from '../../../components/animated-card';
import { CardContent } from '@mui/material';

// Viewer available domains
import Domains from '../../../components/domains';
// The molecular viewer
import ViewerWithControls from '../../../components/viewer-with-controls';
// Component for the metadata table
import TrajectoryMetadata from './metadata';
// Component for the chains analysis
import ChainsAnalysis from './chains';
import CompositionOverview from '../trajectory/composition';

// CSS style
import style from './style.module.css';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const Trajectory = () => {
  // useInView acts as a React hook
  // Track if the NGL viewer (nglRef) and the analyses (nightingaleRef) are on screen
  // The status (e.g. isNglVisible) is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);
  const [nightingaleRef, isNightingaleVisible] = useInView(useInViewOptions);

  // Set the representations to be displayed in the viewer
  const representationsState = useState(null);
  const [ representations, setRepresentations ] = representationsState;

  // Set the viewer initial focus
  const [ initialFocus, setInitialFocus ] = useState(null);

  return (
    <>
      <Domains setRepresentations={setRepresentations} setInitialFocus={setInitialFocus} />
      <Card className={style['ngl-card']} ref={nglRef}>
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <ViewerWithControls
            className={style.container}
            representationsState={representationsState}
            initialFocus={initialFocus}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
      <Card className={style.card}>
        <CardContent>
          <details>
            <summary className={style['trajectory-metadata-title']}>
              Trajectory metadata
            </summary>
            <br />
            <span>
              {/* Renders the metadata table */}
              <TrajectoryMetadata />
            </span>
          </details>
        </CardContent>
      </Card>
      <CompositionOverview />
      <Card className={style.card} ref={nightingaleRef}>
        {isNightingaleVisible ? (
          <CardContent>
            {/* Render chain analyses */}
            <ChainsAnalysis />
          </CardContent>
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
    </>
  );
};

export default Trajectory;
