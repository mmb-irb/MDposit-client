// React logic
import React, {
  useCallback,
  useState,
  useEffect,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useContext,
} from 'react';
import cn from 'classnames';
import screenfull from 'screenfull';
// Visual assets
import {
  Card,
  CardContent,
  LinearProgress,
  IconButton,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faStepBackward,
  faStepForward,
  faPause,
  faPlay,
  faExpand,
  faCompress,
  faCog,
  faTimes,
  faLock,
  faUnlock,
} from '@fortawesome/free-solid-svg-icons';
// Load components used specifically in the viewer with controls
import RepresentationsManager from './representations-manager';
import SettingsControls from './settings-controls';

import { get, setAsync } from '../../utils/storage';

// The main component of the viewer itself
// NGL is the default backend; the viewer switch itself lives in SettingsControls
import NGLViewer from '../ngl-viewer';

// Hooks
import useToggleState from '../../hooks/use-toggle-state';
import useViewerData from '../../hooks/use-viewer-data';

// Used to build the reduced-membrane-subset representations
import getDefaultRepresentations from '../../utils/topology-manager/get-default-reprensetations';

import connectionLevel, {
  LOW,
  MEDIUM,
  HIGH,
} from '../../utils/connection-level';
import reducedMotion from '../../utils/reduced-motion';
// Import CSS style
import style from './style.module.css';
// Import context data
import { ProjectCtx } from '../../contexts';
// Import auxiliar functions
import { copyObject, round2cents, getTimeScale, getFramesSpan } from 'src/utils/auxiliar-functions';

// Decide that the default should be to play the trajectory only on "big enough"
// screens (as a proxy for performance and low-end device detection)
const DEFAULT_STARTS_PLAYING = !reducedMotion() && window.innerWidth > 750;

// Estimated height (in px) the settings controls need once docked at the bottom
// of the right-hand panel. Used to decide whether there is enough free vertical
// room below the representations table to dock them (instead of floating them
// over the viewer). Trajectory viewers also show the speed/frames sliders, so
// they need more room than the topology-only case.
const DOCKED_CONTROLS_HEIGHT = 200;
const DOCKED_CONTROLS_HEIGHT_NO_TRAJECTORY = 96;

const DEFAULT_FRAME_NUMBER = (() => {
  switch (connectionLevel()) {
    case HIGH:
      return 50;
    case MEDIUM:
      return 25;
    case LOW:
    default:
      return 10;
  }
})();

// Set the possible number of frames the user can request
const DEFAULT_FRAME_NUMBERS = [
  { value: 1, label: '1' },
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
];

// Set the default component parameters
// These values are used to fill missing fields in input components
const DEFAULT_COMPONENT_PARAMETERS = {
  name: 'Unnamed component',
  topologyURL: 'auto', // This is assigned further
  trajectoryURLs: 'auto', // This is assigned further
  atomSelection: null,
  atomIndices: null,
  resIndices: null,
  chainIndices: null,
  frame: null,
  onlyTopology: false
}

// Set the default representation parameters
// These values are used to fill missing fields in input representations
const DEFAULT_REPRESENTATION_PARAMETERS = {
  name: 'Unnamed representation',
  selection: 'all',
  show: true,
  type: 'cartoon',
  color: 'chainid',
  opacity: 1,
  component: 'auto' // This is assigned further
}

// DANI: falta representation.index y custom

// Set a function to fill the missing values within an object using default values
// Return true if there was any change
const completeMissingFields = (targetObject, defaultValuesObject) => {
  let anyChange = false;
  for (const [fieldName, defaultValue] of Object.entries(defaultValuesObject)) {
    if (targetObject[fieldName] === undefined) {
      targetObject[fieldName] = defaultValue;
      anyChange = true;
    }
  }
  return anyChange;
}

// Viewer backend wrapper that owns the data-download hook, kept separate from ViewerWithControls so a
// parent key can remount just this subtree to load a different atom subset. The remount is what forces
// the reload: neither useViewerData (dedupes by URL) nor the NGL backend (dedupes stage components by
// name) re-fetches when a live component's atom subset changes. This is how the reduced membrane view
// swaps its atoms without tearing down the surrounding controls (settings panel, backend, speed, ...).
const ManagedViewer = forwardRef(
  (
    {
      Viewer, // The viewer backend component (NGL/MolStar)
      components,
      requestedFramesNumber,
      onLoad,
      ...props // Forwarded as-is to the viewer backend
    },
    ref,
  ) => {
    // Download viewer data (topologies + trajectories) from the API per the components configuration
    const {
      topologies,
      trajectories,
      anyLoadingTopology,
      anyLoadingTrajectory,
    } = useViewerData(components, requestedFramesNumber, onLoad);
    return (
      <Viewer
        ref={ref}
        components={components}
        // Viewer data including both structure and coordinates
        topologies={topologies}
        trajectories={trajectories}
        anyLoadingTopology={anyLoadingTopology}
        anyLoadingTrajectory={anyLoadingTrajectory}
        {...props}
      />
    );
  },
);
ManagedViewer.displayName = 'ManagedViewer';

// Set an NGL view window which is managed by some controls
// There are different ways to call this script
// 1 - With components: Used for situations where more than a topology or trajectory are required
// 2 - With representations: Which internally means there will be only 1 component
// 3 - With no parameters: In which case a default representation in set up
// * In case of both components and representations passed, the valid argument will be the components
// WARNING: There are many important hooks which have components/representations as a dependency
// Avoid passing an object which is created every render. Use a somehow memoized array.
// WARNING: The style of this component and its parent is very important. Use a reference to call it
const ViewerWithControls = forwardRef(
  (
    {
      // The viewer starting components
      // Components are objects which may include the following values:
      // All values are optional since missing values will be set by default
      //  {
      //    name: name of the component used to link representations with it
      //    topologyURL: string, (used in pockets analysis)
      //    trajectoryURLs: [ string ], (used in pca)
      //    atomSelection: string, (not used anymore but still supported)
      //    atomIndices: [ int ], (used in pca)
      //    frame: int, (used in rmsd pairwise analysis)
      //    onlyTopology: bool, (used in pockets analysis)
      //  }
      startingComponents,
      // The viewer starting representations
      // It is an array of objects with the following structure:
      // All values are optional since missing values will be set by default
      // {
      //   name: ('representation' by default) The string label of this representation,
      //   show: ('true' by default) Boolean to set if this representation is shown or not,
      //   selection: ('all' by default) The NGL selection string to define the atom selection,
      //   type: ('cartoon' by default) The initial representation 'type',
      //   color: ('chainid' by default) The initial representation 'colorScheme',
      //   opacity: ('1' by default) The initial representation opacity
      //   other: object with any other ngl options to be passed for the representation (e.g. radius)
      //   component: name of the component this representation belongs to (main component when missing)
      // }
      startingRepresentations,
      // Alternatively you may pass bot components and representations as states
      // Thus the parent component may also control them
      // Note that these states will be still controled by the child components anyway
      componentsState,
      representationsState,
      // Style
      className,
      // Set if the viewer must play the simulation as soon as it appears
      startsPlaying = DEFAULT_STARTS_PLAYING,
      // Closing callback
      close,
      // Nailing callback
      nail,
      // Set which frame must be loaded. It may be undefined, if the whole trajectory is desired.
      requestedFrame,
      // Set if the frame number selector is allowed for trajectories (false in PCA projections)
      framesSelect = true,
      // Set a special option to force the 'noTrajectory' condition
      // This is used to avoid the trajectory playing in pockets since there are surfaced representations
      // This is only to be passed when having a trajectory loaded in the main component
      // If a single frame is forced then this is redundant
      preventTrajectory = false,
      // Set a state setter to handle the frame progress
      onProgress,
      // Opt in to the reduced membrane view (settings-panel toggle loading only protein/solute +
      // membrane headgroups). Handled entirely internally; only appears for membrane simulations.
      allowMembraneReduced = false,
      // NGL selection of atoms to center the trajectory around, every frame
      centering = null,
      // The rest of properties paased to the NGLViewer
      ...props
    },
    ref,
  ) => {
    // Make sure we are not having incompatible inputs
    if (startingComponents && componentsState)
      throw new Error('startingComponents and componentsState are not compatilbe inputs. Choose one.');
    if (startingRepresentations && representationsState)
      throw new Error('startingRepresentations and representationsState are not compatilbe inputs. Choose one.');
    // Set which viewer is used: NGL or MolStar (the default is NGL)
    const [Viewer, setViewer] = useState(NGLViewer);
    // Get project metadata
    const { metadata, accessionAndMdNumber, topology } = useContext(ProjectCtx);
    // Track the current frame and time
    const [currentFrameInfo, setCurrentFrameInfo] = useState({ frame: 0, time: 0 });
    // Use metadata to limit available frames number
    const frameNumbers = useMemo(() => {
      const maximumSnapshots = metadata.mdFrames;
      const frameNumbers = [...DEFAULT_FRAME_NUMBERS];
      // Remove values over the maximim number of frames
      for (let i = frameNumbers.length - 1; i >= 0; i--) {
        if (frameNumbers[i].value > maximumSnapshots) frameNumbers.pop();
        else break;
      }
      // In case no value was removed we are done
      if (frameNumbers.length === DEFAULT_FRAME_NUMBERS.length)
        return frameNumbers;
      // Otherwise, if the maximum number of frames is not one of the options already, then add it
      if (frameNumbers[frameNumbers.length - 1].value !== maximumSnapshots)
        frameNumbers.push({
          value: maximumSnapshots,
          label: maximumSnapshots.toString(),
        });
      return frameNumbers;
    }, [metadata.mdFrames]);
    // Do not use the start object but make a copy to avoid a lot of silent errors
    const fixedStartingComponents = useMemo(() => {
      // If there are no starting components then just leave it as null
      // The defualt completer logic will take over
      if (!startingComponents) return null;
      return startingComponents.map(comp => copyObject(comp));
    }, [startingComponents]);

    // Set the final components to be passed to the viewer
    const [finalComponents, setFinalComponents] =
      componentsState || useState(fixedStartingComponents);

    // Set the missing value completer for components including URLs
    // Return true if there was any change
    const completeComponentMissingFields = useCallback(targetObject => {
      if (!accessionAndMdNumber) return false;
      const defaults = {...DEFAULT_COMPONENT_PARAMETERS};
      defaults.topologyURL = `/structure`;
      defaults.trajectoryURLs = [ `/trajectory` ];
      return completeMissingFields(targetObject, defaults);
    }, [accessionAndMdNumber]);

    // Anytime components change, check if there are any missing values and fill them with default values
    useEffect(() => {
      // Wait for the default completer to be ready
      if (!completeComponentMissingFields) return;
      // If there are no components then set a default configuration
      if (!finalComponents) {
        const defComponents = [{ name: 'Main' }];
        defComponents.forEach(comp => { completeComponentMissingFields(comp) });
        return setFinalComponents(defComponents);
      }
      // Make sure we have no components with the same name
      const componentNames = finalComponents.map(comp => comp.name);
      const uniqueComponentNames = new Set(componentNames);
      if (componentNames.length !== uniqueComponentNames.size)
        throw new Error(`We have multiple components with the same name: ${componentNames.join(', ')}`);
      // Fill missing values among components with default values
      const changes = finalComponents.map(comp => 
        completeComponentMissingFields(comp, DEFAULT_COMPONENT_PARAMETERS));
      // If there was any value filled then update the state to trigger a rerender
      if (changes.some(v => v === true)) setFinalComponents([...finalComponents]);
    }, [finalComponents, completeComponentMissingFields]);

    // Anytime the requested frame changes update the main component
    useEffect(() => {
      if (!finalComponents) return;
      if (requestedFrame === undefined) return;
      if (finalComponents[0].frame === requestedFrame) return;
      finalComponents[0].frame = requestedFrame;
      setFinalComponents([...finalComponents]);
    }, [finalComponents, requestedFrame]);

    // Do not use the start object but make a copy to avoid a lot of silent errors
    const fixedStartingRepresentations = useMemo(() => {
      // If there are no starting representations then just leave it as null
      // The defualt completer logic will take over
      if (!startingRepresentations) return null;
      return startingRepresentations.map(rep => copyObject(rep));
    }, [startingRepresentations]);

    // Set the final representations to be passed to the viewer
    const [finalRepresentations, setFinalRepresentations] =
      representationsState || useState(fixedStartingRepresentations);

    // Use this hook to get the memoized NGL default representations
    const defaultRepresentations = topology && topology.defaultRepresentations;;

    // Set the missing value completer for representations including the main component name
    // Return true if there was any change
    const completeRepresentationMissingFields = useCallback(targetObject => {
      if (!finalComponents) return false;
      const defaults = {...DEFAULT_REPRESENTATION_PARAMETERS};
      defaults.component = finalComponents[0].name;
      return completeMissingFields(targetObject, defaults);
    }, [finalComponents]);

    // Anytime representations change, check if there are any missing values and fill them
    // WARNING: Note that this must be a useEffect, not a useMemo, or you will get the following error:
    //   Warning: Cannot update a component (`Pockets`) while rendering a different component (`ForwardRef`).
    //   To locate the bad setState() call inside `ForwardRef`, follow the stack trace as described in 
    //   https://reactjs.org/link/setstate-in-render
    useEffect(() => {
      // If we still have no default references then stop here
      if (!defaultRepresentations || defaultRepresentations.length === 0) return;
      // If there are no representations then set a default configuration
      if (!finalRepresentations) {
        // Unless the representations state has been passed from another component above
        // If it has been passed then delegate the job to that component
        // Otherwise, we could interfere as it happend with pockets (it was hard to track the problem)
        if (representationsState) return;
        const defRepresentations = [...defaultRepresentations];
        defRepresentations.forEach(rep => 
          completeRepresentationMissingFields(rep));
        return setFinalRepresentations(defRepresentations);
      }
      // Fill missing values among representations with default values
      const changes = finalRepresentations.map(rep => 
        completeRepresentationMissingFields(rep));
      // If there was any value filled then update the state to trigger a rerender
      // DANI: Este es el responsable de esto:
      //   Warning: Cannot update a component (`blablabla`) while rendering a different component (`ForwardRef`).
      //   To locate the bad setState() call inside `ForwardRef`, follow the stack trace as described in 
      //   https://reactjs.org/link/setstate-in-render
      if (changes.some(v => v === true)) setFinalRepresentations([...finalRepresentations]);
    }, [finalRepresentations, defaultRepresentations, completeRepresentationMissingFields]);

    // Reduced membrane view ------------------------------------------------------------------------
    // For heavy membrane trajectories (lots of lipid tails, water, ions), load only protein/solute +
    // membrane headgroups. Lives here rather than in the parent page / Domains so toggling reloads only
    // the viewer's data (via the ManagedViewer remount, see viewerReloadKey) instead of the whole page.

    // The reduced atom subset for this topology, or null when it is not a membrane simulation
    const membraneSelection = topology && topology.membraneViewerSelection;
    // Whether the reduced view is available at all (opt-in and an actual membrane simulation)
    const canReduceMembrane = allowMembraneReduced && !!membraneSelection;
    // Default on for very large membranes, where loading every lipid atom is too heavy
    const membraneReducedDefault = !!(topology && topology.lipidAtomsCount > 100000);
    // Store only the user's explicit choice (null until they toggle) and derive the effective value,
    // so it stays correct as soon as the topology (and its default) arrives.
    const [membraneReducedOverride, setMembraneReducedOverride] = useState(null);
    const membraneReduced = canReduceMembrane && (membraneReducedOverride ?? membraneReducedDefault);
    // Toggle setter passed to SettingsControls (it always calls it with a function updater).
    // Resolve the null "untouched" override to the effective default before handing it to the updater.
    const setMembraneReduced = useCallback(updater =>
      setMembraneReducedOverride(previous => updater(previous ?? membraneReducedDefault)),
      [membraneReducedDefault]);

    // The default representations restricted to the reduced subset, with the membrane as spacefill
    const membraneReducedRepresentations = useMemo(() => {
      if (!canReduceMembrane) return null;
      return getDefaultRepresentations(topology, membraneSelection.residueIndices).map(representation =>
        representation.name.toLowerCase().includes('lipid')
          ? { ...representation, type: 'spacefill', opacity: 0.3 }
          : representation);
    }, [canReduceMembrane, topology, membraneSelection]);

    // Keep the "Overall" default representations in sync with the reduced view. Domains always emits
    // the FULL default set for "Overall", so we swap it to the reduced set (and back) on toggle or
    // re-selection. We match by name + selection + type (the fields distinguishing the two default
    // sets) so we only touch a default set — other domains and manual edits (opacity, color, show) are
    // left alone.
    useEffect(() => {
      if (!canReduceMembrane) return;
      if (!finalRepresentations || !defaultRepresentations || !membraneReducedRepresentations) return;
      const repsMatch = (reps, other) =>
        reps.length === other.length && reps.every((rep, r) =>
          rep.name === other[r].name
          && rep.selection === other[r].selection
          && rep.type === other[r].type);
      const currentIsFull = repsMatch(finalRepresentations, defaultRepresentations);
      const currentIsReduced = repsMatch(finalRepresentations, membraneReducedRepresentations);
      // Only touch a default set, and only when it isn't already in the toggled mode
      if (!currentIsFull && !currentIsReduced) return;
      if (membraneReduced ? currentIsReduced : currentIsFull) return;
      const target = membraneReduced ? membraneReducedRepresentations : defaultRepresentations;
      setFinalRepresentations(target.map(rep => ({ ...rep })));
    }, [
      canReduceMembrane,
      membraneReduced,
      finalRepresentations,
      defaultRepresentations,
      membraneReducedRepresentations,
      setFinalRepresentations,
    ]);

    // The components actually loaded by the viewer. When the reduced view is on we inject the reduced
    // atom subset into the main component so only those atoms are downloaded and displayed.
    const effectiveComponents = useMemo(() => {
      if (!finalComponents || !membraneReduced) return finalComponents;
      return finalComponents.map((comp, c) =>
        c === 0 ? { ...comp, atomIndices: membraneSelection.atomIndices } : comp);
    }, [finalComponents, membraneReduced, membraneSelection]);

    // Key remounting the ManagedViewer to reload the data when the atom subset changes (i.e. on toggle).
    // WARNING: depend only on the membrane mode, never on finalComponents. Keying on the components would
    // flip on the initial null -> ready transition and remount mid-load; useViewerData transitively holds
    // useAPI subscriptions (fileDescriptors, structureData) that a remount tears down and can't re-establish
    // while a request is in flight, leaving fileDescriptors stuck loading so the trajectory never downloads.
    const viewerReloadKey = membraneReduced ? 'membrane-reduced' : 'full';

    // references
    const containerRef = useRef(null);
    const viewerRef = useRef(null);
    // Right-panel scroll container and the representations-table wrapper, measured
    // to decide whether the settings controls can be docked below the table
    const settingsContentRef = useRef(null);
    const representationsRef = useRef(null);

    // toggle states
    const [nailed, toggleNailed] = useToggleState(false);
    const [playing, togglePlaying] = useToggleState(startsPlaying);
    const [spinning, toggleSpinning] = useToggleState(false);
    const [smooth, setSmooth] = useState(true);
    const [darkBackground, toggleDarkBackground] = useToggleState(
      useMemo(() => get('dark-background', false), []),
    );
    const [perspective, togglePerspective] = useToggleState(
      useMemo(() => get('perspective', false), []),
    );

    // states
    const [progress, setProgress] = useState(0);
    const [load, setLoad] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(screenfull.isFullscreen);
    const [requestedFramesNumber, setRequestedFramesNumber] = useState(
      Math.min(DEFAULT_FRAME_NUMBER, metadata.mdFrames),
    );
    const [speed, setSpeed] = useState(useMemo(() => get('speed', 50), []));
    const [settings, openSettings] = useState(false);
    // Whether there is enough free vertical room in the right-hand panel below the
    // representations table to dock the settings controls there rather than float
    // them over the viewer. Kept up to date by a ResizeObserver (see effect below).
    const [roomBelow, setRoomBelow] = useState(false);
    // Width (in px) of the settings panel, resizable by dragging its left border
    // Cap the initial width to at most half of the window so it never opens oversized
    const [settingsWidth, setSettingsWidth] = useState(
      useMemo(() => Math.min(get('settings-width', 480), window.innerWidth * 0.5), []),
    );

    // handlers

    // Handle the automatic progress
    const handleProgress = useCallback(
      prog => {
        if (onProgress) onProgress(prog);
        setProgress(prog);
        
        // Calculate the current frame and time
        if (viewerRef.current) {
          const currentFrame = viewerRef.current.currentFrame;
          // Calculate time in nanoseconds using the frame step from metadata
          const timeInNs = metadata.FRAMESTEP ? (metadata.timeLength * prog).toFixed(2) : 0;
          setCurrentFrameInfo({ frame: currentFrame, time: timeInNs });
        }
      }, [setProgress, onProgress, metadata.FRAMESTEP],
    );

    // Patch to stop playback when URL changes
    // LORE: this is a workaround to be able to change from the trajectory to other
    // accesion pages when the player speed is high (ISSUE #24)
    useEffect(() => {
      // Save original history methods
      const originalPushState = window.history.pushState;
      const originalReplaceState = window.history.replaceState;
      
      // Override history methods to add our own handlers
      window.history.pushState = function() {
        // Call original method
        originalPushState.apply(this, arguments);
        // Stop playback if playing
        if (playing) togglePlaying(false);
      };
      
      window.history.replaceState = function() {
        // Call original method
        originalReplaceState.apply(this, arguments);
        // Stop playback if playing
        if (playing) togglePlaying(false);
      };

      // Clean up
      return () => {
        window.history.pushState = originalPushState;
        window.history.replaceState = originalReplaceState;

      };
    }, [playing, togglePlaying]);
    

    // Handle the trajectory load
    const handleLoad = useCallback(
      load => {
        setLoad(load);
      }, [setLoad],
    );

    // Set a reference to the progress element
    const progressRef = useRef(null);

    // handle click or click & drag progress bar
    const handleManualProgress = useCallback(event => {
      if (!progressRef.current || !viewerRef.current) return;
      // Get the mouse position
      const { clientX } = event;
      // Get the progress element position and width
      const { x, width } = progressRef.current.getBoundingClientRect();
      // Set pause
      togglePlaying(false);
      // Change the ngl viewer current ref from its exposed setter
      // Then the ngl itself will update the 'progress' state
      viewerRef.current.currentFrame = Math.floor(
        ((clientX - x) / width) * viewerRef.current.totalExpectedFrames,
      );
    }, [togglePlaying]);

    // Set callbacks for event listeners
    const startDraggingProgress = useCallback(event => {
      // Avoid selecting page text while dragging the progress bar
      event.preventDefault();
      handleManualProgress(event);
      window.addEventListener('mouseup', stopDraggingProgress);
      window.addEventListener('mousemove', handleManualProgress);
    }, []);
    const stopDraggingProgress = useCallback(() => {
      window.removeEventListener('mouseup', stopDraggingProgress);
      window.removeEventListener('mousemove', handleManualProgress);
    }, []);

    // Resize the settings panel by dragging its left border
    // The panel is docked to the right, so its right edge stays fixed while dragging
    const settingsRightRef = useRef(null);
    const settingsRightEdge = useRef(0);
    const handleSettingsResize = useCallback(event => {
      const width = settingsRightEdge.current - event.clientX;
      // Clamp so the panel and the viewer always keep a usable width
      // (never wider than half the window, never narrower than 280px)
      const clamped = Math.min(Math.max(width, 280), window.innerWidth * 0.5);
      setSettingsWidth(clamped);
      // Keep the viewer canvas fitted to its shrinking/growing container
      if (viewerRef.current) viewerRef.current.autoResize();
    }, []);
    const stopResizingSettings = useCallback(() => {
      window.removeEventListener('mouseup', stopResizingSettings);
      window.removeEventListener('mousemove', handleSettingsResize);
      document.body.style.userSelect = '';
      if (settingsRightRef.current)
        setAsync('settings-width', settingsRightRef.current.offsetWidth);
    }, [handleSettingsResize]);
    const startResizingSettings = useCallback(event => {
      if (settingsRightRef.current)
        settingsRightEdge.current = settingsRightRef.current.getBoundingClientRect().right;
      // Avoid selecting text while dragging
      document.body.style.userSelect = 'none';
      window.addEventListener('mouseup', stopResizingSettings);
      window.addEventListener('mousemove', handleSettingsResize);
    }, [handleSettingsResize, stopResizingSettings]);

    // Frame change handler to interact with the child viewer
    const handleFrameChange = useCallback(
      value => {
        if (!viewerRef.current) return;
        togglePlaying(false);
        viewerRef.current.currentFrame += value;
      }, [togglePlaying],
    );

    // When the user requests the previous frame
    const handlePreviousFrame = useCallback(() => handleFrameChange(-1), [handleFrameChange]);

    // When the user requests the next frame
    const handleNextFrame = useCallback(() => handleFrameChange(1), [handleFrameChange]);

    // Enter/exit fullscreen
    const handleFullscreenChange = useCallback(() => setIsFullscreen(screenfull.isFullscreen), []);
    useEffect(() => {
      screenfull.on('change', handleFullscreenChange);
      return () => screenfull.off('change', handleFullscreenChange);
    }, [handleFullscreenChange]);

    // When the user clicks on the fullscreen button
    const handlerFullscreenButton = useCallback(
      () => { if (containerRef.current) screenfull.toggle(containerRef.current) }, []);

    // Exit the options menu by pressing the escape key and handle spacebar for play/pause
    useEffect(() => {
      const handleKeyPress = event => {
        if (event.key === 'Escape') {
          openSettings(false);
          viewerRef.current.autoResize();
        }
        // Only handle spacebar if not typing in an input field
        if (event.key === ' ' && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
          event.preventDefault(); // Prevent page scrolling
          togglePlaying(prev => !prev);
        }
      };
      document.addEventListener('keydown', handleKeyPress, false);
      return () => document.removeEventListener('keydown', handleKeyPress, false);
    }, []);

    // Find out if there are residues under PBC (Periodic Boundary Conditions) in the topology
    // In case we have atom selections in all components, check if at least one is under PBC
    // Otherwise we consider there are no PBC since all represented atoms are not in PBC
    // This is useful in PCA projections
    // If there are PBC residues then stop the smooth to prevent misleading artifacts
    const hasPbcResidues = useMemo(() => {
      if (!topology || !topology.pbcResidues) return;
      if (!effectiveComponents) return;
      // Check if there is at least one residue in PBC
      const anyPbcResidues = topology.pbcResidues.size > 0;
      if (anyPbcResidues === false) return false;
      // If there is at least one PBC residue...
      // Check if we have atom indices in all components
      const haveAllAtomIndices = effectiveComponents.every(comp => comp.atomIndices);
      if (haveAllAtomIndices) {
        // Check if any atom index is included among PBC residues
        const allAtomIndices = effectiveComponents.reduce((acc, comp) => acc.concat(comp.atomIndices), []);
        const anyPbcAtom = allAtomIndices.some(atomIndex => {
          const atom = topology.getAtomByIndex(atomIndex);
          return topology.pbcResidues.has(atom.residueIndex);
        });
        if (anyPbcAtom === false) return false;
      }
      setSmooth(false);
      return true;
    }, [topology, effectiveComponents]);

    // This allows parent components to interact with this component
    useImperativeHandle(ref,
      () => ({
        autoResize: viewerRef.current.autoResize,
        centerFocus: viewerRef.current.centerFocus,
        drawMesh: viewerRef.current.drawMesh,
        get currentFrame() {
          return viewerRef.current.currentFrame;
        },
        set currentFrame(value) {
          viewerRef.current.currentFrame = value;
        },
        togglePlaying: togglePlaying,
        setFinalComponents: setFinalComponents,
        setFinalRepresentations: setFinalRepresentations
      }),
      [
        togglePlaying,
        setFinalComponents,
        setFinalRepresentations,
      ],
    );

    // Set the variable 'noTrajectory' as true when:
    // The flag 'onlyTopology' is passed
    // there is a selected unique frame to load from the main trajectory
    // The main trajectory only has 1 frame (e.g. average.xtc)
    const mainComponent = effectiveComponents && effectiveComponents[0];
    const noTrajectory = preventTrajectory || (mainComponent && (mainComponent.onlyTopology ||
      Number.isFinite(mainComponent.frame))); // May be 0

    // Decide where the settings controls live: docked at the bottom of the right
    // panel when there is enough free vertical room below the representations
    // table, otherwise floating over the viewer. Measure the right-panel scroll
    // container height and the table height, and re-measure whenever either
    // resizes (window/fullscreen resize, adding/removing representations, ...).
    // The table wrapper is measured independently of the docked controls, so
    // there is no feedback loop between docking and the measurement.
    const neededControlsHeight = noTrajectory
      ? DOCKED_CONTROLS_HEIGHT_NO_TRAJECTORY
      : DOCKED_CONTROLS_HEIGHT;
    useEffect(() => {
      if (!settings) return setRoomBelow(false);
      const content = settingsContentRef.current;
      const table = representationsRef.current;
      if (!content || !table || typeof ResizeObserver === 'undefined') return;
      const measure = () =>
        setRoomBelow(content.clientHeight - table.offsetHeight >= neededControlsHeight);
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(content);
      observer.observe(table);
      return () => observer.disconnect();
    }, [settings, neededControlsHeight, finalRepresentations]);

    // Dock the settings controls under the representations panel only when the
    // panel is open and there is enough free vertical room below the table;
    // otherwise float them over the viewer as a translucent overlay
    const settingsDocked = settings && roomBelow;

    // Shared props for SettingsControls so it can be rendered in either location
    // (floating overlay or docked in the right panel) without duplication
    const settingsControlsProps = {
      viewerRef,
      noTrajectory,
      hasPbcResidues,
      toggleSpinning,
      smooth,
      setSmooth,
      darkBackground,
      toggleDarkBackground,
      perspective,
      togglePerspective,
      Viewer,
      setViewer,
      speed,
      setSpeed,
      framesSelect,
      requestedFramesNumber,
      setRequestedFramesNumber,
      frameNumbers,
      showMembraneToggle: !!canReduceMembrane,
      membraneReduced,
      setMembraneReduced,
    };

    // Pick a readable time unit (fs, ps, ns, µs, ms) based on the trajectory total length
    const timeScale = useMemo(
      () => getTimeScale(metadata.timeLength), [metadata.timeLength],
    );

    // Whether the loaded frames are spread across (almost) the whole trajectory, as opposed to
    // a narrow, specific frame window (e.g. a single cluster transition). In the latter case the
    // total trajectory time is not representative of what is loaded, so the time tooltip is hidden
    const framesDistributed = useMemo(() => {
      const mainComponent = finalComponents && finalComponents[0];
      const urlpath = mainComponent && mainComponent.trajectoryURLs && mainComponent.trajectoryURLs[0];
      const span = getFramesSpan(urlpath);
      if (!span) return true;
      if (!metadata.mdFrames) return true;
      return (span.end - span.start) / metadata.mdFrames > 0.9;
    }, [finalComponents, metadata.mdFrames]);

    // DANI: Si no quieres buscarte problemas no cambies las "Card"s de aquí abajo por "div"s o similar
    return (
      <Card
        className={cn(style['fullscreen-target'], {
          [style['is-fullscreen']]: isFullscreen,
        })}
        ref={containerRef}
      >
        <div className={cn(style.adapter, className)}>
          <Card
            className={settings
              ? style['ngl-with-settings']
              : style['ngl-without-settings']
            }
            style={{ border: 'none', boxShadow: 'none' }}
            // This id prevents the mouse to drag or resize the Rnd when it is over this element
            id={'preventDragSize'}
          >
            <Card
              className={settings
                ? cn(style['settings-left'], className)
                : cn(style['ngl-alone'], className)
              }
              style={{ border: 'none', boxShadow: 'none' }}
            >
              {/* Gate the mount on this component's own topology when the reduced-membrane feature is on. */}
              {/* topology is a getter running useAPI hooks, so it starts undefined here and settles a few */}
              {/* renders later; mounting earlier would start in 'full' mode then flip viewerReloadKey once */}
              {/* topology (and its mem-map) resolves, remounting mid-load and stranding in-flight requests. */}
              {(!allowMembraneReduced || topology) && (
                <ManagedViewer
                  key={viewerReloadKey}
                  Viewer={Viewer}
                  ref={viewerRef}
                  components={effectiveComponents}
                  requestedFramesNumber={requestedFramesNumber}
                  onLoad={handleLoad}
                  playing={playing}
                  spinning={spinning}
                  smooth={smooth}
                  onProgress={handleProgress}
                  noTrajectory={noTrajectory}
                  darkBackground={darkBackground}
                  perspective={perspective}
                  speed={speed}
                  centering={centering}
                  representations={finalRepresentations}
                  {...props}
                />
              )}
              {settings && !settingsDocked && (
                <SettingsControls {...settingsControlsProps} docked={false} />
              )}
            </Card>
            {settings && (
              <div
                className={style['settings-right']}
                ref={settingsRightRef}
                style={{ width: settingsWidth }}
              >
                <div
                  className={style['settings-resizer']}
                  onMouseDown={startResizingSettings}
                  title="Drag to resize the panel"
                />
                <div className={style['settings-right-content']} ref={settingsContentRef}>
                  <div ref={representationsRef}>
                    <RepresentationsManager
                      components={finalComponents}
                      representations={finalRepresentations}
                      setRepresentations={setFinalRepresentations}
                    />
                  </div>
                  {settingsDocked && (
                    <SettingsControls {...settingsControlsProps} docked={true} />
                  )}
                </div>
              </div>
            )}
          </Card>
          <CardContent style={{ padding: 0 }}>
            {noTrajectory
              // Render an empty div to avoid a Warning message since CardContent expect a ReactNode and an undefined is not
              ? (<div />)
              // Render the loading/progress bar in case there is a trajectory to be loaded
              : (<div className={style.progressContainer}>
                  <div
                    className={cn(style.progress, 'prevent-drag', { [style.dark]: darkBackground })}
                    onMouseDown={startDraggingProgress}
                    ref={progressRef}
                  >
                    <LinearProgress
                      variant="buffer"
                      color="primary"
                      value={progress * 100}
                      valueBuffer={load * 100}
                      style={{ height: '1ch' }}
                    />
                  </div>
                  {metadata.FRAMESTEP && framesDistributed && (
                    <div className={cn(style.timeInfo, 'prevent-drag', { [style.dark]: darkBackground })}>
                      Time: {round2cents(currentFrameInfo.time * timeScale.factor)} / {round2cents(metadata.timeLength * timeScale.factor)} {timeScale.label}
                    </div>
                  )}
                </div>)
            }
            <div className={style.controls}>
              <div>
                <IconButton
                  title="Close viewer"
                  className={cn({ [style.hidden]: !close })}
                  disabled={!close}
                  onClick={close}
                  size="large"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </IconButton>

                <IconButton
                  title={nailed ? 'Nailed viewer' : 'Nail viewer'}
                  className={cn({ [style.hidden]: !nail })}
                  disabled={!nail || nailed}
                  onClick={() => {
                    nail();
                    toggleNailed();
                  }}
                  size="large"
                >
                  <div className={style['flip-container']}>
                    <div
                      className={cn(style['flip-card-container'], {
                        [style.flipped]: nailed,
                      })}
                    >
                      <FontAwesomeIcon
                        className={cn(style['flip-card'], style.front)}
                        icon={faUnlock}
                      />
                      <FontAwesomeIcon
                        className={cn(style['flip-card'], style.back)}
                        icon={faLock}
                      />
                    </div>
                  </div>
                </IconButton>
              </div>
              <div>
                {noTrajectory || (
                  <>
                    <IconButton
                      title="Previous frame"
                      onClick={handlePreviousFrame}
                      size="large"
                    >
                      <FontAwesomeIcon icon={faStepBackward} />
                    </IconButton>
                    <IconButton
                      title={playing ? 'Pause' : 'Play'}
                      onClick={togglePlaying}
                      size="large"
                    >
                      <div className={style['flip-container']}>
                        <div
                          className={cn(style['flip-card-container'], {
                            [style.flipped]: playing,
                          })}
                        >
                          <FontAwesomeIcon
                            className={cn(style['flip-card'], style.front)}
                            icon={faPlay}
                          />
                          <FontAwesomeIcon
                            className={cn(style['flip-card'], style.back)}
                            icon={faPause}
                          />
                        </div>
                      </div>
                    </IconButton>
                    <IconButton
                      title="Next frame"
                      onClick={handleNextFrame}
                      size="large"
                    >
                      <FontAwesomeIcon icon={faStepForward} />
                    </IconButton>
                  </>
                )}
              </div>
              <div>
                <IconButton
                  title={`${isFullscreen ? 'Exit' : 'Go'} fullscreen`}
                  onClick={handlerFullscreenButton}
                  className={cn(style['fullscreen-toggle'], {
                    [style.hidden]: !screenfull.isEnabled,
                    [style['is-fullscreen']]: isFullscreen,
                    [style['settings']]: settings,
                  })}
                  disabled={!screenfull.isEnabled}
                  size="large"
                >
                  <FontAwesomeIcon
                    icon={isFullscreen ? faCompress : faExpand}
                  />
                </IconButton>
                <IconButton
                  title={'Settings'}
                  onClick={() => {
                    openSettings(previous => !previous);
                    viewerRef.current.autoResize();
                  }}
                  size="large"
                >
                  <FontAwesomeIcon icon={faCog} />
                </IconButton>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>
    );
  },
);

ViewerWithControls.displayName = 'ViewerWithControls'
export default ViewerWithControls;
