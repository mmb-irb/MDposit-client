import React, { useState, useContext, useMemo } from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

// Project data context
import { ProjectCtx } from '../../../contexts';

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

  // Get the project topology
  const { topology } = useContext(ProjectCtx);

  // Set the representations to be displayed in the viewer
  const representationsState = useState(null);
  const [ representations, setRepresentations ] = representationsState;

  // Set the viewer initial focus
  const [ initialFocus, setInitialFocus ] = useState(null);

  // Whether this is a membrane simulation (i.e. there is a reduced membrane selection available)
  const isMembrane = !!(topology && topology.membraneViewerSelection);

  // Toggle for the reduced membrane view (on by default for membrane simulations)
  // When active, the viewer only loads the protein/solute atoms plus the membrane headgroups
  // instead of the whole system, which is dominated by heavy lipid tails, water and ions
  // RUBEN: desactivado de momento hasta que pueda probar en A01IR cuando este la topologia actualizada
  const [ membraneReduced, setMembraneReduced ] = useState(false);

  // For membrane simulations, load a reduced atom subset (protein/solute + membrane headgroups)
  // For every other simulation (or when the toggle is off) this is null and the whole system is loaded
  const startingComponents = useMemo(() => {
    const membraneSelection = topology && topology.membraneViewerSelection;
    if (!membraneSelection || !membraneReduced) return undefined;
    return [{ name: 'Main', atomIndices: membraneSelection.atomIndices }];
  }, [topology, membraneReduced]);

  return (
    <>
      <Domains
        setRepresentations={setRepresentations}
        setInitialFocus={setInitialFocus}
        membraneReduced={membraneReduced}
      />
      <Card className={style['ngl-card']} ref={nglRef}>
        {/* Render the NGL viewer when it is on screen and the topology is ready */}
        {/* We wait for the topology so the membrane atom subset (if any) is set before mounting */}
        {/* The key forces a remount when the membrane view is toggled, so the new atom set is fetched */}
        {/* The membrane toggle itself lives in the viewer settings panel (SettingsControls) */}
        {isNglVisible && topology ? (
          <ViewerWithControls
            key={`viewer-membrane-${membraneReduced}`}
            className={style.container}
            startingComponents={startingComponents}
            representationsState={representationsState}
            initialFocus={initialFocus}
            showMembraneToggle={isMembrane}
            membraneReduced={membraneReduced}
            setMembraneReduced={setMembraneReduced}
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
