import React, { useState, useContext, useMemo, useCallback } from 'react';
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

  // Reduced membrane view: the viewer only loads the protein/solute atoms plus the
  // membrane headgroups instead of the whole system, which is dominated by heavy lipid
  // tails, water and ions. It defaults to on for very large membrane systems, where
  // loading the whole set of lipid atoms would be too heavy for the viewer.
  //
  // The default depends on the topology, which loads asynchronously, so we derive the
  // effective value instead of seeding state (which would mount the viewer in the wrong
  // mode and force a remount once the topology arrives, interrupting playback). The only
  // stored bit is the user's explicit toggle choice (null while they have not touched it).
  const [ membraneReducedOverride, setMembraneReducedOverride ] = useState(null);
  const membraneDefault = !!(topology && topology.lipidAtomsCount > 100000);
  const membraneReduced = membraneReducedOverride ?? membraneDefault;
  // Setter passed to the SettingsControls toggle, which uses a function to toggle
  const setMembraneReduced = useCallback(value =>
    setMembraneReducedOverride(previousOverride => {
      const current = previousOverride ?? membraneDefault;
      return typeof value === 'function' ? value(current) : value;
    }), [membraneDefault]);

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
