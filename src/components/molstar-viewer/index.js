import React, {
  forwardRef,
  memo,
  useState,
  useRef,
  useImperativeHandle,
  useCallback,
  useMemo,
  useEffect,
  useContext,
} from 'react';
//import useToggleState from '../../hooks/use-toggle-state';
import { useInView } from 'react-intersection-observer';
import cn from 'classnames';

// Load molstar logic
//import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { createPluginUI } from 'molstar/lib/mol-plugin-ui/index';
import { renderReact18 } from 'molstar/lib/mol-plugin-ui/react18';
import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { TrajectoryFromModelAndCoordinates } from 'molstar/lib/mol-plugin-state/transforms/model';
import { AnimateModelIndex } from 'molstar/lib/mol-plugin-state/animation/built-in/model-index';
import { createStructureRepresentationParams } from 'molstar/lib/mol-plugin-state/helpers/structure-representation-params';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { Color } from 'molstar/lib/mol-util/color';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { Coordinates, Model, StructureElement, Time } from 'molstar/lib/mol-model/structure';
import { setDebugMode, setTimingMode } from 'molstar/lib/mol-util/debug';
/*  Might require extra configuration,
see https://webpack.js.org/loaders/sass-loader/ for example.
create-react-app should support this natively. */
//import "molstar/lib/mol-plugin-ui/skin/light.scss";

// Load the parser for trajectory coordinates in our format to molstar format
import { TrajectoryFromCustomData, FrozenSecondaryStructure, parseCoordinateFrames } from './molstar-parser';

import { ProjectCtx } from '../../contexts';

// Translate this app's NGL selections, colors and orientations to molstar
// NGL itself is used to understand selections not built by this app (e.g. typed by the user)
import { autoLoad } from 'ngl';
import { nglSelectionToAtomIndices, needsNglSelection } from './ngl-selection';
import { getPartialSystem } from '../ngl-viewer/partial-system';
import { nglColorToTheme } from './ngl-color';
import { nglOrientationToCamera, cameraToNglOrientation } from './ngl-orientation';

import { MAXIMUM_PLAYER_FPS, interpolateSpeed } from '../../utils/player-speed';

//import { setTooltipPosition } from '../../utils/tooltip-position-manager';

import style from './style.module.css';

// Used to just wait
import { sleep } from 'timing-functions';

// Load the molstar plugin context in a global and accessible place
//window.molstar = PluginUIContext;

// Support the same debug/timing query params as molstar's own official viewer app, e.g.
// ?timing-mode=1 to get per-render-pass GPU timing dumped to the console for spotting
// bottlenecks (see https://github.com/molstar/molstar/issues/1880). Query params are read
// before the '#' of this app's hash-router URLs, e.g. http://host/?timing-mode=1#/id/XXXX
// Debug mode is what actually triggers the periodic console dump (on scene changes) - timing
// mode alone only collects the numbers without ever printing them - so requesting timing
// implies debug too, matching what a plain '?timing-mode=1' is expected to show
// Only honoured in development, so production deployments can never be put into molstar's
// debug/timing mode (which is slower and dumps to the console) through the URL
if (import.meta.env.DEV) {
  const molstarDebugParams = new URLSearchParams(window.location.search);
  const molstarTimingMode = molstarDebugParams.get('timing-mode') === '1';
  const molstarDebugMode =
    molstarDebugParams.get('debug-mode') === '1' || molstarTimingMode;
  setDebugMode(molstarDebugMode);
  setTimingMode(molstarTimingMode);
}

// Customize molstar specifications
// Here you can see more clues about molstar options:
//   https://github.com/molstar/molstar/blob/0bf32148afd93a645b44dca6d81e9779e85b4300/src/apps/viewer/app.ts
const molstarSpec = DefaultPluginUISpec();
molstarSpec.layout = {
  initial: {
    // When isExpanded is set true the vertical scroll is blocked
    isExpanded: false,
    // DANI: Esto no se que hace, he provado distintos valores y no veo la diferencia
    // Available options: 'outside', 'portrait', 'landscape' or 'reactive'
    controlsDisplay: 'reactive',
    // If showControls is set to true then some logs are rendered in molstar
    // This is a problem since they offset the molecule and they eclipse the mouse interaction with it
    // These controls can be hidden by parts firther in the specifications however
    showControls: false,
  },
};
molstarSpec.components = {
  // This is only useful if showControls are set to true
  controls: {
    // Hide sequence (question mark in the top right corner)
    // DANI: Al hacer click no hace nada
    top: 'none',
    // Hide console logs (they block the mouse click interaction with the main viewer)
    bottom: 'none',
    // Hide left panel (this panels is offsetting and deforming the main viewer very bad)
    // DANI: Hay un botón pero funciona mal: intenta abrir un desplegable con más botones pero colapsa al momento
    left: 'none',
  },
  // DANI: No se que hace esto pero he visto que alguien lo ponía así que yo también
  remoteState: 'none',
};

// NGL spins 0.005 radians every 16 ms, which is about one turn every 20 seconds
const SPIN_SPEED = 0.05; // Rotations per second
// Set the canvas properties which are controlled by the viewer settings (background, camera and spin)
const getSettingsCanvasProps = ({ darkBackground, perspective, spinning }) => ({
  renderer: { backgroundColor: Color(darkBackground ? 0x000000 : 0xffffff) },
  camera: { mode: perspective ? 'perspective' : 'orthographic' },
  trackball: {
    animate: spinning
      ? { name: 'spin', params: { speed: SPIN_SPEED, axis: Vec3.create(0, -1, 0) } }
      : { name: 'off', params: {} },
  },
});

// Set the number of bytes per element in trajectory data
const BYTES_PER_COORDINATE = 4; // float 32
const COORDINATES_PER_ATOM = 3; // x, y and z
const BYTES_PER_ATOM = BYTES_PER_COORDINATE * COORDINATES_PER_ATOM;


// Set representation types for the different types of highlights
const defaultHighlightTypes = {
  atoms: 'spacefill',
  residues: 'ball+stick',
  chains: 'ball+stick',
  selections: 'ball+stick',
};

// DEV-ONLY badge showing the measured playback framerate (see 'recordFrameTick')
// Fixed positioning keeps this independent from the viewer's own layout/CSS
const debugFpsBadgeStyle = {
  position: 'fixed',
  top: 4,
  right: 4,
  zIndex: 10000,
  background: 'rgba(0, 0, 0, 0.7)',
  color: '#0f0',
  font: '11px monospace',
  padding: '2px 6px',
  borderRadius: 4,
  pointerEvents: 'none',
};

// Map this app's NGL-style representation type names (set in get-default-representations)
// to molstar representation type names
// Molstar has no dedicated 'licorice' or 'base' type, so those are approximated with ball-and-stick
const REPRESENTATION_TYPES = {
  cartoon: { type: 'cartoon' },
  'ball+stick': { type: 'ball-and-stick' },
  // Bond lines only. Molstar's 'line' also draws a point and a cross at every atom by default,
  // which on A01IP's 80k-atom membrane cost ~20 ms/frame - two thirds of the whole representation -
  // while being invisible under the bond lines. NGL's 'line' draws bond lines only too, so this
  // also makes the two backends agree
  // The one thing this gives up is atoms with no bonds at all, which would now not be drawn. Every
  // selection this app renders as licorice is a covalently bonded molecule (short polymer ranges
  // and membranes - see get-default-reprensetations); unbonded things like ions go to ball+stick,
  // which keeps its element-sphere visual
  licorice: {
    type: 'line',
    typeParams: { aromaticBonds: false, multipleBonds: 'off', visuals: ['intra-bond'] },
  },
  // Deliberately NOT requesting the 'structure-*' visual variants ('structure-element-sphere',
  // 'structure-intra-bond'). They batch everything into a single draw call, which sounds like a
  // win, but they are ComplexVisuals, and a ComplexVisual force-sets updateColor and updateSize
  // whenever it rebuilds geometry - which for a trajectory is every single frame, since the
  // coordinates always differ. The default per-unit visuals are UnitsVisuals, which rebuild only
  // the geometry and skip colour/size unless the structure hash changes (it doesn't) or the colour
  // theme is vertex/volume granularity (ours are group/uniform)
  // The draw-call argument does not apply here either: Structure.ofModel makes roughly one unit
  // per chain, so we are in the single digits, nowhere near the >5000 unitSymmetryGroups at which
  // molstar itself switches these on (getSpacefillParams in
  // mol-repr/structure/representation/spacefill.js)
  // 'approximate' trades some impostor-sphere shading accuracy (visible mostly on overlaps)
  // for faster fragment shading - kept paired with the default tryUseImpostor: true, since
  // it only affects the impostor path (mol-geo/geometry/spheres/spheres.js)
  spacefill: {
    type: 'spacefill',
    typeParams: { approximate: true },
  },
  surface: { type: 'molecular-surface' },
  line: { type: 'line' },
  point: { type: 'point' },
  base: { type: 'ball-and-stick' },
};
const DEFAULT_REPRESENTATION_TYPE = { type: 'ball-and-stick' };
const getRepresentationType = typeName =>
  REPRESENTATION_TYPES[typeName] || DEFAULT_REPRESENTATION_TYPE;


// Build a molstar expression selecting exactly the given atom indices
// This relies on 'sourceIndex', the 0-based index of the atom in the loaded topology file,
// which matches the atom indices used everywhere else in this app (topology, trajectory coordinates)
const atomIndicesToExpression = atomIndices =>
  MS.struct.generator.atomGroups({
    'atom-test': MS.core.set.has([MS.core.type.set(atomIndices), MS.acp('sourceIndex')]),
  });

// Duration of the camera transitions, as in the NGL viewer
const FOCUS_TRANSITION_DURATION = 750; // ms
// Margin added around the focused atoms, as molstar does when it focuses something
const FOCUS_EXTRA_RADIUS = 4; // Å
// The NGL default view, used when there is no curated orientation: looking along +Z with Y up
const DEFAULT_CAMERA_ROTATION = { direction: [0, 0, 1], up: [0, 1, 0] };

// Get the bounding sphere of the atoms in an NGL selection, or null if it selects no atom
const getSelectionSphere = (structure, selection, topologyManager, nglStructure, subset) => {
  const atomIndices = nglSelectionToAtomIndices(selection, topologyManager, nglStructure, subset);
  if (atomIndices === null) return structure.boundary.sphere;
  if (atomIndices.length === 0) return null;
  const bundle = StructureElement.Bundle.fromExpression(structure, atomIndicesToExpression(atomIndices));
  const loci = StructureElement.Bundle.toLoci(bundle, structure);
  if (StructureElement.Loci.isEmpty(loci)) return null;
  return StructureElement.Loci.getBoundary(loci).sphere;
};

// Move the camera to frame a sphere, looking in the given direction or in the current one if none is given
// Molstar clips whatever is in front of the sphere it focuses, while NGL clips nothing
// For this reason the clipping radius is extended so it includes the whole structure
const focusCamera = (camera, structure, sphere, rotation, durationMs) => {
  const { direction, up } = rotation || {
    direction: Vec3.sub(Vec3.zero(), camera.state.target, camera.state.position),
    up: camera.state.up,
  };
  const snapshot = camera.getInvariantFocus(
    sphere.center, sphere.radius + FOCUS_EXTRA_RADIUS, up, direction);
  const whole = structure.boundary.sphere;
  snapshot.radius = Vec3.distance(whole.center, sphere.center) + whole.radius;
  snapshot.radiusMax = whole.radius;
  camera.setState(snapshot, durationMs);
};

const MolstarViewer = memo(
  forwardRef(
    (
      {
        className,
        playing,
        spinning,
        smooth,
        onProgress,
        bounce = false, // Set if the animation, when finished, starts again (false) or goes back (true)
        selectedAtoms, // Atom index of the atom and residue to be represented
        selectedResidueIndices, // Residue indices from residues to be highlighted
        selectedChains, // Chain letters from chains to be represented
        selectedCustom, // Free NGL selections to be directly represented
        selectedDistances, // Groups of 2 atoms or residues to be represented as a distance
        selectedAngles, // Groups of 3 atoms to be represented as an angle
        selectedRepresentation, // String name of a representation to be painted in yellow color (only 1)
        snapRepresentations,
        noTrajectory, // True when only specific frames must be loaded
        initialFocus, // The viewer selection to be focused by the camera initially
        darkBackground,
        perspective,
        speed,
        // Hooked values for changing representation parameters
        drawingMethods,
        coloringMethods,
        opacities,
        components,
        representations,
        showRepresentations,
        nglSelections,
        // Viewer data incluting both structure and coordinates
        topologies,
        trajectories,
        anyLoadingTopology,
        anyLoadingTrajectory,
        // Message of a failed topology or trajectory download, if any
        downloadError,
        // Set the highlight representations types
        highlightTypes = defaultHighlightTypes,
      },
      ref,
    ) => {
      // Save the components object into a local constant which can be modified
      const comps = useMemo(() => components, [components]);

      // Get project data
      const {
        metadata,
        topology: topologyManager,
      } = useContext(ProjectCtx);

      // Set the curated orientation as camera directions
      const curatedOrientation = useMemo(() => {
        // If no curated orientation is set in metadata then stop
        if (!metadata || !metadata.ORIENTATION) return;
        return nglOrientationToCamera(metadata.ORIENTATION);
      }, [metadata]);

      // The last automatic camera focus
      const [focus, setFocus] = useState(initialFocus);
      // Set the initial focus
      useEffect(() => {
        //console.log(initialFocus);
        setFocus(initialFocus);
      }, [initialFocus]);

      // references
      const parentRef = useRef(null);
      const containerRef = useRef(null);
      const stageRef = useRef(null);
      const tooltipRef = useRef(null);

      // in-view hook
      const [inViewRef, isInView] = useInView();

      // Set the content of the tooltip in JSX format
      const [tooltipContent, setTooltipContent] = useState(null);

      // Set the molstar instance
      const [molstar, setMolstar] = useState(null);

      // Setup molstar
      useEffect(() => {
        // Keep the instance here: the 'molstar' state seen by the cleanup would always be the initial null
        let molstarInstance = null;
        let unmounted = false;
        // This wrapper function is the most correct way to call awaits inside a use effect
        const wrap = async () => {
          // Create the plugin
          molstarInstance = await createPluginUI({
            target: parentRef.current,
            render: renderReact18,
            // Start with the current settings so the very first frame already has them
            // Later changes are applied by the settings effect below
            spec: {
              ...molstarSpec,
              canvas3d: getSettingsCanvasProps({ darkBackground, perspective, spinning }),
            },
          });
          // If we were unmounted while creating it then nobody else will dispose it
          if (unmounted) {
            molstarInstance.dispose();
            return;
          }
          // Drop render passes we don't need, to help with large trajectories
          // (see https://github.com/molstar/molstar/issues/1880)
          molstarInstance.canvas3d?.setProps({
            multiSample: { mode: 'off' },
            marking: { enabled: false },
            renderer: { colorMarker: false },
            // Molstar refits the camera to the whole scene every time representations are rebuilt
            // The camera is moved only by the focus effect below instead, as in the NGL viewer
            camera: { manualReset: true },
          });
          // DEV-ONLY: expose the plugin for debugging from the browser console, alongside the
          // debug/timing query params above and the framerate badge below. Useful for inspecting the
          // state tree, driving modelIndex by hand, and subscribing to state.data.events.log, which
          // reports how long each state node took to update - which is how the per-frame costs in
          // the comments throughout this file were attributed
          if (import.meta.env.DEV) window.__molstar = molstarInstance;
          setMolstar(molstarInstance);
        };
        wrap();
        // Cleanup function
        // Disposing stops the plugin render loop and releases its WebGL context
        return () => {
          unmounted = true;
          progressSubscriptionRef.current?.unsubscribe();
          if (molstarInstance) molstarInstance.dispose();
        };
      }, []);

      // Apply the viewer settings: background, camera and spin
      useEffect(() => {
        if (!molstar) return;
        molstar.canvas3d?.setProps(getSettingsCanvasProps({ darkBackground, perspective, spinning }));
      }, [molstar, darkBackground, perspective, spinning]);

      // Set the molstar model reference
      const [modelReference, setModelReference] = useState(null);

      // Track the currently built trajectory/structure/representations pipeline
      // (root-level refs to discard on a real rebuild, and the live data objects that
      // can instead be grown in place while more trajectory data keeps streaming in)
      const trajectoryPipelineRef = useRef(null);
      // The last built structure, which the camera focuses
      const [builtStructure, setBuiltStructure] = useState(null);

      // The main topology parsed by NGL, which is only needed to understand selections not built by this app
      // It is parsed the first time one of these selections is to be represented or focused
      // The parsed file is kept as well, since the topology may change (e.g. reduced membrane view toggle)
      const [nglParse, setNglParse] = useState(null);
      const topologyFile = topologies[0] && topologies[0].file;
      const nglStructure = nglParse && nglParse.file === topologyFile ? nglParse.structure : null;

      // Set if only a subset of the system atoms is loaded (e.g. the reduced membrane view or embed selections)
      // Then topology atom indices do not match the loaded atoms and every selection needs NGL
      // The partial system is null when it is unknown which atoms are loaded (residue/chain subsets)
      // The subset is set in the main component, whose atom indices are sorted when the topology is requested
      const subset = useMemo(() => {
        const mainComponent = components && components[0];
        if (!mainComponent || !topologyManager) return null;
        const { atomIndices, resIndices, chainIndices, atomSelection } = mainComponent;
        if (!(atomIndices || resIndices || chainIndices || atomSelection)) return null;
        return { partialSystem: getPartialSystem(atomIndices, topologyManager.atomCount) };
      }, [components, topologyManager]);

      const needsNglStructure = useMemo(() => {
        if (subset) return true;
        const selections = (representations || []).map(representation => representation.selection);
        if (focus) selections.push(focus.sele);
        return selections.some(needsNglSelection);
      }, [subset, representations, focus]);
      useEffect(() => {
        if (!needsNglStructure || nglStructure || !topologyFile) return;
        let cancelled = false;
        autoLoad(new Blob([topologyFile], { type: 'text/plain' }), { ext: 'pdb' })
          .then(structure => { if (!cancelled) setNglParse({ file: topologyFile, structure }) })
          .catch(error => console.error(error));
        return () => { cancelled = true };
      }, [needsNglStructure, nglStructure, topologyFile]);

      // How many frames the trajectory is expected to have once fully downloaded, and
      // whether it is already fully downloaded - both read by the play/pause effect and
      // by the progress subscription below, without needing to be effect dependencies
      const expectedFramesRef = useRef(1);
      const isCompleteRef = useRef(false);
      // Subscription notifying onProgress/currentFrame consumers as the current frame changes
      const progressSubscriptionRef = useRef(null);
      // Guards against overlapping full rebuilds when trajectory chunks arrive faster than a rebuild
      // can complete (rebuilds are async; a chunk that arrives mid-rebuild is simply picked up, already
      // caught up, by the growth path on the next chunk instead of starting a second parallel rebuild)
      const buildingRef = useRef(false);
      // A rebuild skipped because another one was in flight must run once that one is done
      // Otherwise a change arriving mid-rebuild (e.g. the NGL parse, or the last trajectory chunk) is lost
      const skippedRebuildRef = useRef(false);
      const [rebuildRetries, setRebuildRetries] = useState(0);

      // DEV-ONLY: measured actual playback framerate, shown in a small on-screen badge so the
      // 'speed' slider's effect can be visually verified. Stripped in production builds since
      // import.meta.env.DEV is statically known then, so this whole branch is dead-code-eliminated
      const frameTimesRef = useRef([]);
      const lastRecordedModelIndexRef = useRef(null);
      const [debugFps, setDebugFps] = useState(0);
      // 'stateUpdated' fires more than once per real frame advance (representation/render
      // bookkeeping also touches this cell), so only count a tick when modelIndex actually changed
      const recordFrameTick = useCallback(modelIndex => {
        if (!import.meta.env.DEV) return;
        if (modelIndex === lastRecordedModelIndexRef.current) return;
        lastRecordedModelIndexRef.current = modelIndex;
        const now = Date.now();
        const times = frameTimesRef.current;
        times.push(now);
        if (times.length > 10) times.shift();
        if (times.length < 2) return;
        const elapsedSeconds = (times[times.length - 1] - times[0]) / 1000;
        if (elapsedSeconds <= 0) return;
        setDebugFps((times.length - 1) / elapsedSeconds);
      }, []);

      // Latest 'speed' value, readable from getAnimationParams below without needing it as a
      // dependency (kept stable so it never forces the play/pause or streaming effects to rerun)
      const speedRef = useRef(speed);
      speedRef.current = speed;

      // Animation parameters shared by the play/pause effect and the streaming resume logic below
      // Loop once the full trajectory is downloaded, otherwise stop at the last downloaded frame
      // (mirrors the NGL viewer's 'loop'/'once' player mode switch in payload-to-ngl-file)
      // The 'speed' input ranges 0-100; interpolateSpeed turns it into the same per-frame timeout
      // (in ms) that the NGL viewer uses, which is then expressed as molstar's fps-cap equivalent
      // ('sequential' duration re-applies the animation at most every 1000/maxFps ms)
      const getAnimationParams = useCallback(() => {
        const timeout = interpolateSpeed(speedRef.current);
        const maxFps = Math.max(1, Math.min(MAXIMUM_PLAYER_FPS, Math.round(1000 / timeout)));
        return {
          duration: { name: 'sequential', params: { maxFps } },
          mode: isCompleteRef.current
            ? { name: 'loop', params: { direction: 'forward' } }
            : { name: 'once', params: { direction: 'forward' } },
        };
      }, []);

      // Load topologies in molstar
      useEffect(() => {
        // Stop here if we are still loading topologies
        if (anyLoadingTopology) return;
        // Get the molstar reference
        if (!molstar) return;
        // Load each topology
        topologies.forEach(async topology => {
          // Download and apply data
          const data = await molstar.builders.data.rawData(
            { data: topology.file } /* replace with your URL */,
            { state: { isGhost: true } },
          );
          // DANI: Aunque no llegues a 'aplicarla' acabas teniendo una trayectoria de una frame en la data
          const trajectory = await molstar.builders.structure.parseTrajectory(data, 'pdb');
          // WARNING: Do not modify this model
          // WARNING: Althought it should be the same model
          const model = await molstar.builders.structure.createModel(trajectory);

          // DANI: Esta función te acepta igual una trayectory que un model que una structure
          // await molstar.builders.structure.hierarchy.applyPreset(structure, "default");

          // console.log(molstar);
          // console.log(molstar.managers.structure.hierarchy.current);

          // // Set the representations (https://github.com/molstar/molstar/issues/68)
          // // WARNING: Default MolStar representation is not the most efficient one so we have to tweak it
          // // First set the different features we may encounter within the structure
          // const components = {
          //     polymer: await molstar.builders.structure.tryCreateComponent(structure, 'polymer'),
          //     ligand: await molstar.builders.structure.tryCreateComponent(structure, 'ligand'),
          //     //water: await molstar.builders.structure.tryCreateComponent(structure, 'water'),
          // };
          // // Now
          // const builder = molstar.builders.structure.representation;
          // const update = molstar.build();
          // if (components.polymer) builder.buildRepresentation(update, components.polymer, {
          //   type: 'line',
          //   //typeParams: { alpha: 0.51 } // Make it transparent
          // }, { tag: 'polymer' });
          // if (components.ligand) builder.buildRepresentation(update, components.ligand, {
          //   type: 'ball-and-stick'
          // }, { tag: 'ligand' });
          // //if (components.water) builder.buildRepresentation(update, components.water, { type: 'ball-and-stick', typeParams: { alpha: 0.6 } }, { tag: 'water' });
          // await update.commit();

          // Save the model reference inside the molstar reference
          setModelReference(model.ref);
        });
      }, [molstar, anyLoadingTopology, topologies]);

      // Load trajectories in molstar
      // Once trajectory bytes start arriving, build the playback pipeline immediately so the trajectory
      // can play while the rest of it keeps downloading, mirroring the NGL viewer's incremental behaviour
      // (see payload-to-ngl-file/updateNGLFile). This effect reruns on every downloaded chunk; most of
      // those reruns just grow the already-built trajectory in place (mutating the live molstar
      // Coordinates/Trajectory data directly) instead of rebuilding the whole
      // coords->trajectory->model->structure->representations pipeline, which would be far too expensive
      // to redo on every network chunk. A full rebuild only happens when the represented model or the
      // representation set itself changes.
      useEffect(() => {
        // Wait for the molstar reference to be available
        if (!molstar) return;
        // If there must be no trajectory then stop here
        if (noTrajectory) return;
        // This wrapper function is the most correct way to call awaits inside a use effect
        const wrap = async () => {
          // Check if trajectories are
          if (!topologies || !trajectories || trajectories.length === 0) return;

          // If molstar or the main model are not set yet then we must wait
          if (!modelReference) return;

          const trajectory = trajectories[0];

          let trajectoryFinalExpectedFrames = 0;

          // If the trajectory has no atom count then read it from the already-parsed structure
          // This may happen when we request coordinates using resindices or chaindices
          const modelAtoms = molstar.state.data.cells.get(modelReference).obj.data.atomicHierarchy.atoms._rowCount;
          const trajectoryAtoms = trajectory.atoms || modelAtoms;

          // Add the final expected frames for all frames in the component
          trajectoryFinalExpectedFrames += trajectory.frames;

          // Only the first 'loadedBytes' bytes of the payload buffer are downloaded
          const payload = trajectory.payload;
          const bytesPerFrame = trajectoryAtoms * BYTES_PER_ATOM;
          const fitLength =
            Math.floor(trajectory.loadedBytes / bytesPerFrame) * bytesPerFrame;

          // If the total payload is empty then stop here
          if (fitLength === 0) return;

          // Calculate how many frames are there in total
          const totalFrames = fitLength / bytesPerFrame;

          // Check if all required data is already downloaded
          const completedTrajectory =
            totalFrames === trajectoryFinalExpectedFrames;
          expectedFramesRef.current = trajectoryFinalExpectedFrames;
          isCompleteRef.current = completedTrajectory;

          const pipeline = trajectoryPipelineRef.current;
          // A full rebuild is only required the first time, or if the represented model or the
          // representation set itself changed - not on every new chunk of the same trajectory
          // It is also required once NGL has parsed the topology, to represent the selections only NGL understands
          const needsFullRebuild = !pipeline ||
            pipeline.modelReference !== modelReference ||
            pipeline.representations !== representations ||
            pipeline.nglStructure !== nglStructure;

          if (needsFullRebuild) {
            // Skip if a previous rebuild triggered by an earlier chunk is still in flight
            // It will be retried once the current rebuild is done (see skippedRebuildRef)
            if (buildingRef.current) {
              skippedRebuildRef.current = true;
              return;
            }
            buildingRef.current = true;
            try {
              // Discard the previously built trajectory/structure/representations, if any
              // Otherwise every rebuild would stack a new duplicate on top of the previous one
              // Deleting the trajectory root cascades to its model/structure/representations
              // descendants (parent-child tree edges), unlike the coords->trajectory dependsOn edge
              if (pipeline) {
                await molstar
                  .build()
                  .delete(pipeline.coordsRef)
                  .delete(pipeline.trajectoryRef)
                  .commit();
              }

              // Load the whole frames downloaded so far
              const coords = await molstar
                .build()
                .toRoot()
                .apply(TrajectoryFromCustomData, {
                  data: payload.slice(0, fitLength),
                  natoms: trajectoryAtoms,
                })
                .commit();

              const molstarTrajectory = await molstar
                .build()
                .toRoot()
                .apply(
                  TrajectoryFromModelAndCoordinates,
                  {
                    modelRef: modelReference,
                    coordinatesRef: coords.ref,
                  },
                  { dependsOn: [modelReference, coords.ref] },
                )
                .commit();

              // Get the current trajectory model
              // From now on, this is the model to be modified and not the model in modelReference
              // NOTE: keep this as molstar's own ModelFromTrajectory. AnimateModelIndex finds the
              // node to advance by selecting that exact transformer, so replacing it with a custom
              // equivalent (as interpolating between frames would need) leaves the animation with
              // nothing to drive: playback then silently does nothing, with no error anywhere.
              // Such a replacement has to land together with its own playback driver
              const newModel = await molstar.builders.structure.createModel(
                molstarTrajectory,
              );

              // Set the default representations
              // Ask for the model as-is: the default is 'assembly', which for an MD topology
              // searches for symmetry that isn't there, logs a warning, and falls back to exactly
              // this anyway
              const rootStructure = await molstar.builders.structure.createStructure(
                newModel,
                { name: 'model', params: {} },
              );

              // Hold secondary structure at the first frame, so cartoon representations stop
              // recomputing DSSP on every frame. Must sit above the components so it re-plants the
              // cached result before the representations below it update
              const frozenSecondaryStructure = molstar.build()
                .to(rootStructure)
                .apply(FrozenSecondaryStructure, {});
              await frozenSecondaryStructure.commit();
              const structure = frozenSecondaryStructure.selector;

              // Build one molstar component + representation per data representation
              // (mirrors what the NGL viewer does with the same `representations`/`components` props)
              // Fall back to a single lightweight cartoon over the whole structure when there is
              // no representations data yet (e.g. still loading) or none was provided at all
              const reps = representations && representations.length > 0
                ? representations
                : [{ selection: 'all', type: 'cartoon', color: 'chainid' }];

              // Built bundle components, kept only so the dev-only sanity check below can notice if
              // one of them ever silently empties out during playback (see the check for why)
              const builtBundleComponents = [];

              for (const [repIndex, representation] of reps.entries()) {
                if (representation.show === false) continue;

                // Resolve which atoms this representation targets, and build a component for them
                let component;
                const atomIndices = nglSelectionToAtomIndices(
                  representation.selection, topologyManager, nglStructure, subset);
                if (atomIndices === null) {
                  // No filtering needed: represent the whole structure
                  component = structure;
                } else {
                  if (atomIndices.length === 0) continue;
                  // Resolve the selection into a 'bundle' (a plain list of unit ids + element
                  // index ranges/sets) ONCE, here, rather than letting molstar re-resolve it on
                  // every single playback frame
                  // Every frame replaces the structure with a coordinate-only remap, so molstar
                  // re-runs each component's update. For a component built from an expression
                  // there is no cheap path: 'a === cache.source' is never true for the fresh
                  // structure, so updateStructureComponent re-executes the compiled query, and an
                  // atom-test-only atomGroups query scans EVERY atom of EVERY unit. That is why
                  // the cost tracked the whole structure rather than the selection: on A01IP the
                  // 220-atom glycans component cost as much per frame as the 80k-atom membrane one
                  // A 'bundle' component instead updates via Bundle.toStructure, which just maps
                  // the stored index ranges through the (unchanged) unit element arrays
                  // See mol-plugin-state/helpers/structure-component.js, updateStructureComponent
                  const bundle = StructureElement.Bundle.fromExpression(
                    structure.data,
                    atomIndicesToExpression(atomIndices),
                  );
                  // 'label' is what molstar names this node in the state tree and in its per-node
                  // update timing log; without it every component is just 'Selection'
                  const label = representation.name || representation.selection;
                  component = await molstar.builders.structure.tryCreateComponent(
                    structure,
                    {
                      type: { name: 'bundle', params: bundle },
                      nullIfEmpty: true,
                      label,
                    },
                    // The key is what tryCreateComponent tags the node with, and equal keys
                    // UPDATE the same node instead of adding a second one. Names are not
                    // guaranteed unique (a representation with no name falls back to its
                    // selection, and different representations may share a selection), so
                    // disambiguate with the index
                    `${label}#${repIndex}`,
                  );
                  // The selection matched no atoms in the loaded structure
                  if (!component) continue;
                  builtBundleComponents.push({
                    label,
                    component,
                    elementCount: component.data.elementCount,
                  });
                }

                const { type, typeParams } = getRepresentationType(representation.type);
                const colorTheme = nglColorToTheme(representation.color);
                // Molstar calls opacity 'alpha'. Representations only carry an opacity when
                // something asked for one (currently PBC regions, which are drawn faded so it is
                // clear they have jumped across a periodic boundary), so leave molstar's own
                // default alone otherwise rather than passing an explicit 1
                const { opacity } = representation;
                const alphaParams = opacity === undefined || opacity === null
                  ? undefined
                  : { alpha: opacity };
                const reprParams = createStructureRepresentationParams(
                  molstar,
                  void 0,
                  {
                    type,
                    typeParams: {
                      // Quality options: custom, auto, highest, higher, high, medium, low, lower, lowest
                      // https://github.com/molstar/molstar/blob/0e197b18857d59c27f51d4aa0226cd772bc872ca/src/mol-geo/geometry/base.ts
                      // DANI: 'lowest' se ve muy feo y no mejora mucho el rendimiento
                      quality: 'lower',
                      ignoreHydrogens: 'all',
                      ignoreHydrogensVariant: 'all',
                      // ignoreLight: true,
                      ...typeParams,
                      ...alphaParams,
                    },
                    color: colorTheme.name,
                    colorParams: colorTheme.params,
                  },
                );

                const update = molstar.build();
                update.to(component).apply(
                  StateTransforms.Representation.StructureRepresentation3D,
                  reprParams,
                );
                await update.commit();
              }

              // DEV-ONLY: bundle components address atoms by unit id + element index, and molstar
              // only reuses a bundle while its stored hash still matches the structure's. The hash
              // covers unit ids and element arrays but not coordinates, and a coordinate-only remap
              // preserves both, so it should hold for every frame of a trajectory. If that ever
              // stopped being true the component would be quietly replaced by an EMPTY structure
              // and its representation would just vanish - no error, nothing in the console - so
              // check it explicitly rather than relying on someone noticing a missing membrane
              let bundleCheckDone = false;
              const checkBundleComponents = () => {
                if (bundleCheckDone) return;
                for (const built of builtBundleComponents) {
                  const current = built.component.data;
                  if (current && current.elementCount === built.elementCount) continue;
                  bundleCheckDone = true; // Report once, not once per frame
                  console.error(
                    'Molstar viewer: bundle component "%s" changed from %d to %d atoms during ' +
                      'playback. Its representation has most likely disappeared. The structure ' +
                      'hash is no longer stable across frames, so components must go back to ' +
                      'being built from expressions (slower, but correct).',
                    built.label,
                    built.elementCount,
                    current ? current.elementCount : 0,
                  );
                  return;
                }
              };

              // Notify onProgress/currentFrame consumers whenever the current frame changes
              // (playback tick or manual scrub), by watching the frame-index-controlling node
              if (progressSubscriptionRef.current) progressSubscriptionRef.current.unsubscribe();
              progressSubscriptionRef.current = molstar.state.data.events.cell.stateUpdated.subscribe(
                event => {
                  if (event.ref !== newModel.ref) return;
                  const modelIndex = (newModel.cell && newModel.cell.transform.params.modelIndex) || 0;
                  recordFrameTick(modelIndex);
                  if (import.meta.env.DEV) checkBundleComponents();
                  if (!onProgress) return;
                  const total = expectedFramesRef.current;
                  if (total <= 1) return;
                  onProgress(Math.min(1, Math.max(0, modelIndex / (total - 1))));
                },
              );

              trajectoryPipelineRef.current = {
                modelReference,
                representations,
                nglStructure,
                coordsRef: coords.ref,
                trajectoryRef: molstarTrajectory.ref,
                modelFromTrajectory: newModel,
                baseModel: molstar.state.data.cells.get(modelReference).obj.data,
                coordsData: coords.data,
                trajectoryData: molstarTrajectory.data,
                parsedBytes: fitLength,
              };
              setBuiltStructure(structure);
            } finally {
              buildingRef.current = false;
              if (skippedRebuildRef.current) {
                skippedRebuildRef.current = false;
                setRebuildRetries(retries => retries + 1);
              }
            }
          } else if (fitLength > pipeline.parsedBytes) {
            // Grow the already-built trajectory in place with just the newly downloaded bytes
            // AnimateModelIndex/ModelFromTrajectory both re-read frameCount live on every tick,
            // so mutating these live objects directly is picked up automatically, with no need
            // to rebuild or recommit anything
            const newBytes = payload.slice(pipeline.parsedBytes, fitLength);
            const previousFrameCount = pipeline.coordsData.frames.length;
            const newFrames = parseCoordinateFrames(newBytes, trajectoryAtoms, previousFrameCount);
            pipeline.coordsData.frames.push(...newFrames);

            const deltaCoords = Coordinates.create(newFrames, Time(1, 'step'), Time(0, 'step'));
            const deltaTrajectory = Model.trajectoryFromModelAndCoordinates(pipeline.baseModel, deltaCoords);
            pipeline.trajectoryData.frames.push(...deltaTrajectory.frames);
            pipeline.trajectoryData.frameCount = pipeline.trajectoryData.frames.length;
            pipeline.trajectoryData.duration = pipeline.trajectoryData.frames.length;

            pipeline.parsedBytes = fitLength;
          }

          // Keep the animation's params in sync with the latest download state on every chunk
          // This is the only place the 'once' -> 'loop' mode switch happens once the trajectory
          // finishes downloading, and it must happen here, proactively, rather than only when
          // playback has already stalled: if completion happens while still mid-playback (still
          // in 'once' mode), nothing else would ever catch it once it later hits the last frame
          // and stops for good, since there is no further chunk left to rerun this effect and
          // resume it - this was the exact scenario that got stuck playing to a halt
          if (playing && isInView) {
            if (molstar.managers.animation.state.animationState === 'playing') {
              molstar.managers.animation.updateCurrentParams(getAnimationParams());
            } else {
              // Resume playback if it had already stopped, e.g. because it ran out of
              // downloaded frames ('once' mode stops the animation outright at the last frame)
              molstar.managers.animation.play(AnimateModelIndex, getAnimationParams());
            }
          }
        };
        wrap();
      }, [
        molstar,
        modelReference,
        topologies,
        trajectories,
        comps,
        representations,
        nglStructure,
        subset,
        rebuildRetries,
        topologyManager,
        noTrajectory,
        playing,
        isInView,
        onProgress,
        getAnimationParams,
        recordFrameTick,
      ]);

      // Track when the first focus has been performed, since first focus is instantaneous
      const firstFocus = useRef(true);
      // Track the last focus performed, since rebuilding the structure alone must not move the camera
      const appliedFocus = useRef(null);
      // Focus the specified selection with the camera automatically, as the NGL viewer does
      useEffect(() => {
        if (!molstar || !builtStructure) return;
        if (!firstFocus.current && focus === appliedFocus.current) return;
        // The structure is missing while it is being rebuilt, then wait for the new one
        const structure = builtStructure.data;
        if (!structure) return;
        const sphere = getSelectionSphere(
          structure, focus && focus.sele, topologyManager, nglStructure, subset);
        if (!sphere) return;
        const isFirstFocus = firstFocus.current;
        firstFocus.current = false;
        appliedFocus.current = focus;
        // Use the curated orientation the first time and when it is explicitly requested
        // The very first time, if there is no curated orientation, use the NGL default view
        // Otherwise keep the current camera direction
        let rotation = null;
        if (isFirstFocus || (focus && focus.orient)) rotation = curatedOrientation;
        if (isFirstFocus && !rotation) rotation = DEFAULT_CAMERA_ROTATION;
        const duration = isFirstFocus ? 0 : FOCUS_TRANSITION_DURATION;
        focusCamera(molstar.canvas3d.camera, structure, sphere, rotation, duration);
      }, [molstar, builtStructure, focus, curatedOrientation, topologyManager, nglStructure, subset]);

      // play/pause button effect
      useEffect(() => {
        // If molstar has not been yet initiated then stop here
        if (!molstar) return;
        // If there is no trajectory then there is nothing to play
        if (noTrajectory) return;
        // Play
        if (playing && isInView) {
          molstar.managers.animation.play(AnimateModelIndex, getAnimationParams());
        }
        // Pause
        else {
          molstar.managers.animation.stop();
        }
      }, [molstar, playing, isInView, noTrajectory, bounce, getAnimationParams]);

      // Handle the speed
      // Live-update the fps cap of the already-running animation, without restarting it
      // (mirrors the NGL viewer's nglPlayer.setParameters({ timeout }) in the equivalent effect)
      useEffect(() => {
        if (!molstar) return;
        if (molstar.managers.animation.state.animationState !== 'playing') return;
        molstar.managers.animation.updateCurrentParams(getAnimationParams());
      }, [molstar, speed, getAnimationParams]);

      // Resize logic
      // declare handler
      const handleResize = useCallback(async () => {
        if (!stageRef.current) return;
        const canvas = containerRef.current.querySelector('canvas');
        if (canvas) {
          canvas.style.height = '';
          canvas.style.cursor = 'default';
        }
        // WARNING: This sleep here is to fix a bug
        // When we open/close settings we trigger this function but it takes the size of the window before changing
        // The sleep fixes this problem altought the delay is 0
        await sleep(0);
        stageRef.current.handleResize();
      }, []);
      // connect the handle to events
      useEffect(() => {
        window.addEventListener('resize', handleResize);
        return () => {
          window.removeEventListener('resize', handleResize);
        };
      }, [handleResize]);

      // Expose public methods and getters/setters
      useImperativeHandle(
        ref,
        () => ({
          autoResize: handleResize,
          // Output the current orientation/focus in console
          // Note: this is for the developer, not for the regular user
          // It is printed in the NGL format, which is the one stored in the ORIENTATION metadata
          displayFocus() {
            if (!molstar) return;
            const { target, position, up } = molstar.canvas3d.camera.state;
            const orientation = cameraToNglOrientation({
              target,
              distance: Vec3.distance(target, position),
              direction: Vec3.sub(Vec3.zero(), target, position),
              up,
            });
            const stringifiedArray = `[${orientation.toString()}]`;
            console.log(stringifiedArray);
          },
          centerFocus() {
            // Focus the whole structure and use the curated orientation, if any
            setFocus({ sele: 'all', orient: true });
          },
          get currentFrame() {
            const modelFromTrajectory = trajectoryPipelineRef.current && trajectoryPipelineRef.current.modelFromTrajectory;
            if (!(molstar && modelFromTrajectory && modelFromTrajectory.cell)) return -1;
            return modelFromTrajectory.cell.transform.params.modelIndex || 0;
          },
          set currentFrame(value) {
            const modelFromTrajectory = trajectoryPipelineRef.current && trajectoryPipelineRef.current.modelFromTrajectory;
            if (!(molstar && modelFromTrajectory && modelFromTrajectory.cell)) return;
            const total = this.totalFrames;
            let frame = value;
            if (frame < 0) frame = 0;
            if (frame >= total) frame = total - 1;
            modelFromTrajectory.update({ modelIndex: frame }).commit();
          },
          get totalFrames() {
            const pipeline = trajectoryPipelineRef.current;
            if (!(molstar && pipeline)) return 1;
            return pipeline.trajectoryData.frameCount;
          },
          get totalExpectedFrames() {
            return expectedFramesRef.current;
          },
        }),
        [molstar, trajectories, handleResize],
      );

      // workaround to have multiple ref logic on one element
      // https://github.com/thebuilder/react-intersection-observer/issues/186#issuecomment-468641525
      const handleRef = node => {
        inViewRef(node);
        parentRef.current = node;
      };

      // Finally, render the viewer window
      return (
        <>
          <div
            ref={handleRef}
            className={cn(className, style.container, {
              [style['loading-structure']]: anyLoadingTopology,
              [style['loading-trajectory']]:
                !noTrajectory && anyLoadingTrajectory,
              [style['light-theme']]: !darkBackground,
            })}
            // Display loading status data in the upper left corner of the viewer window
            data-loading={downloadError || undefined}
          />
          <div ref={tooltipRef} className={style.tooltip}>
            {tooltipContent}
          </div>
          {import.meta.env.DEV && (
            <div style={debugFpsBadgeStyle}>{debugFps.toFixed(1)} fps</div>
          )}
        </>
      );
    },
  ),
);

export default MolstarViewer;
