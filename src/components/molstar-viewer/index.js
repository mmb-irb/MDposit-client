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
import { Loci } from 'molstar/lib/mol-model/loci';
import { PluginBehaviors } from 'molstar/lib/mol-plugin/behavior';
import { NoPrimaryFocusLociBindings } from 'molstar/lib/mol-plugin/behavior/dynamic/camera';
import { Binding } from 'molstar/lib/mol-util/binding';
import { ButtonsType, ModifiersKeys } from 'molstar/lib/mol-util/input/input-observer';
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
import { getPartialSystem, toWholeAtomIndex, toPartialColorScheme, toPartialAtomGroups } from '../ngl-viewer/partial-system';
import { nglSchemeToTheme, NglSchemeColorThemeProvider, isNglScheme } from './ngl-color-scheme';
import AtomDescription from '../atom-description';
import { getHoveredAtoms, getHoveredAtomPair } from './hovered-atoms';
import { AtomPairsShape } from './atom-pairs';
import { getHighlights } from './highlights';
import { MeshShape } from './mesh';
import { nglColorToTheme } from './ngl-color';
import { nglOrientationToCamera, cameraToNglOrientation, rotateSceneAroundX } from './ngl-orientation';

import { MAXIMUM_PLAYER_FPS, interpolateSpeed } from '../../utils/player-speed';

import { setTooltipPosition } from '../../utils/tooltip-position-manager';

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
  // Hide the buttons molstar shows over the viewport (zoom, screenshot, settings, fullscreen, VR...)
  // Our own controls already do most of it, and some open molstar panels which are hidden above
  viewport: { controls: () => null },
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

// Build a molstar component and representation for some atoms of a structure, as the NGL viewer represents them
// Atom indices are those of the loaded topology, or null to represent the whole structure
// The type and color are NGL ones, which are translated to molstar
// Return the node which is to be deleted to remove the representation and the built bundle component, if any
// Return null if there are no atoms to represent
// The color theme may be given already translated (e.g. NGL color schemes, see nglSchemeToTheme)
const buildRepresentation = async (molstar, structure, atomIndices, {
  label, key, type: typeName, color, colorTheme: givenColorTheme, opacity, sizeFactor,
}) => {
  let component;
  let bundleComponent = null;
  if (atomIndices === null) {
    // No filtering needed: represent the whole structure
    component = structure;
  } else {
    if (atomIndices.length === 0) return null;
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
    component = await molstar.builders.structure.tryCreateComponent(
      structure,
      {
        type: { name: 'bundle', params: bundle },
        nullIfEmpty: true,
        label,
      },
      key,
    );
    // The selection matched no atoms in the loaded structure
    if (!component) return null;
    bundleComponent = { label, component, elementCount: component.data.elementCount };
  }

  const { type, typeParams } = getRepresentationType(typeName);
  const colorTheme = givenColorTheme || nglColorToTheme(color);
  // Molstar calls opacity 'alpha'. Representations only carry an opacity when
  // something asked for one (e.g. PBC regions, which are drawn faded so it is
  // clear they have jumped across a periodic boundary), so leave molstar's own
  // default alone otherwise rather than passing an explicit 1
  const alphaParams = opacity === undefined || opacity === null
    ? undefined
    : { alpha: opacity };
  // NGL calls the size factor 'scale'
  const sizeParams = sizeFactor ? { sizeFactor } : undefined;
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
        ...sizeParams,
      },
      color: colorTheme.name,
      colorParams: colorTheme.params,
    },
  );

  const update = molstar.build();
  const representationNode = update.to(component).apply(
    StateTransforms.Representation.StructureRepresentation3D,
    reprParams,
  );
  await update.commit();
  // Deleting a component deletes its representation as well
  return { ref: component === structure ? representationNode.ref : component.ref, bundleComponent };
};

// Build the links of an NGL distance representation, which go between pairs of atoms (see AtomPairsShape)
// Atom indices are those of the loaded topology
// Return the node which is to be deleted to remove the representation
const buildAtomPairs = async (molstar, structure, pairs, { label, color, colorTheme, opacity, radius }) => {
  const update = molstar.build();
  const shape = update.to(structure).apply(AtomPairsShape, {
    label,
    pairs,
    radius,
    colorTheme: colorTheme || nglColorToTheme(color),
    alpha: opacity === undefined || opacity === null ? 1 : opacity,
  });
  shape.apply(StateTransforms.Representation.ShapeRepresentation3D);
  await update.commit();
  return { ref: shape.ref, bundleComponent: null };
};

// Color of the distance lines, as in the NGL viewer
const DISTANCE_COLOR = 0x87ceeb; // skyblue

// Duration of the camera transitions, as in the NGL viewer
const FOCUS_TRANSITION_DURATION = 750; // ms
// Margin added around the focused atoms, as molstar does when it focuses something
const FOCUS_EXTRA_RADIUS = 4; // Å
// The NGL default view, used when there is no curated orientation: looking along +Z with Y up
const DEFAULT_CAMERA_ROTATION = { direction: [0, 0, 1], up: [0, 1, 0] };
// Rotation of the scene around the X axis when 'rotateX' is requested, as in the NGL viewer
// This makes the Z axis go from bottom to top (e.g. membrane normals)
const ROTATE_X_ANGLE = -1.57; // radians

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
        centering, // NGL selection of atoms to center the trajectory around, every frame
        rotateX, // To rotate the scene so the Z axis goes from bottom to top
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
        // Arguments of drawMesh for a mesh to be drawn, e.g. channels (see drawMesh in the NGL viewer)
        mesh,
        // Optional function to set the tooltip content when hovering a distance
        // It receives both atom indices and returns JSX, or nothing to use the default content
        distanceTooltip,
        // Optional function to modify the tooltip content when hovering an atom
        // It receives the atom index and the original content and returns the new content
        onHoverDisplay,
        // Optional function to be called with the atom index when the user clicks an atom
        // When passed, the cursor becomes a pointer over selectable atoms
        onAtomSelect,
        // Optional function which receives an atom index and returns true if the atom may be selected
        // If missing, all atoms may be selected
        isAtomSelectable,
      },
      ref,
    ) => {
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
            // Do not draw the axes in the corner either, which NGL does not have
            camera: { manualReset: true, helper: { axes: { name: 'off', params: {} } } },
          });
          // DEV-ONLY: expose the plugin for debugging from the browser console, alongside the
          // debug/timing query params above and the framerate badge below. Useful for inspecting the
          // state tree, driving modelIndex by hand, and subscribing to state.data.events.log, which
          // reports how long each state node took to update - which is how the per-frame costs in
          // the comments throughout this file were attributed
          if (import.meta.env.DEV) window.__molstar = molstarInstance;
          // Make the NGL color schemes of the analyses available as a color theme
          molstarInstance.representation?.structure.themes.colorThemeRegistry.add(NglSchemeColorThemeProvider);
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

      // The molstar model of every topology, by the topology urlpath
      const [topologyModels, setTopologyModels] = useState({});
      // The file of every topology already parsed (or being parsed), by the topology urlpath
      const parsedTopologiesRef = useRef(new Map());

      // Track the currently built pipeline of every component, by component name
      // (root-level refs to discard on a real rebuild, and the live data objects that
      // can instead be grown in place while more trajectory data keeps streaming in)
      const pipelinesRef = useRef(new Map());
      // The pipeline of the main component, which is the one played and focused
      const trajectoryPipelineRef = useRef(null);
      // The inputs and nodes of the last built representations
      const representationsBuildRef = useRef(null);
      // The last built structure, which the camera focuses
      const [builtStructure, setBuiltStructure] = useState(null);

      // The main topology parsed by NGL, which is only needed to understand selections not built by this app
      // It is parsed the first time one of these selections is to be represented or focused
      // The parsed file is kept as well, since the topology may change (e.g. reduced membrane view toggle)
      const [nglParse, setNglParse] = useState(null);
      const mainTopologyUrlpath = components && components[0] && components[0].topologyURL;
      const mainTopology = topologies.find(topology => topology.urlpath === mainTopologyUrlpath);
      const topologyFile = mainTopology && mainTopology.file;
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

      // Set the highlight representations, which are added on top of the regular ones (see getHighlights)
      const highlights = useMemo(() => getHighlights({
        topologyManager, highlightTypes, selectedAtoms, selectedResidueIndices, snapRepresentations,
      }), [topologyManager, highlightTypes, selectedAtoms, selectedResidueIndices, snapRepresentations]);

      const needsNglStructure = useMemo(() => {
        if (subset) return true;
        // NGL color schemes are calculated with NGL as well
        if ((representations || []).some(representation =>
          representation.customScheme || isNglScheme(representation.color))) return true;
        const selections = (representations || []).map(representation => representation.selection);
        if (focus) selections.push(focus.sele);
        selections.push(centering);
        highlights.forEach(highlight => selections.push(highlight.selection));
        // Distances may be given as NGL selections as well
        [...(selectedDistances || []), ...(selectedAngles || [])].forEach(atoms =>
          atoms.forEach(atom => { if (typeof atom === 'string') selections.push(atom) }));
        return selections.some(needsNglSelection);
      }, [subset, representations, focus, centering, highlights, selectedDistances, selectedAngles]);
      useEffect(() => {
        if (!needsNglStructure || nglStructure || !topologyFile) return;
        let cancelled = false;
        autoLoad(new Blob([topologyFile], { type: 'text/plain' }), { ext: 'pdb' })
          .then(structure => { if (!cancelled) setNglParse({ file: topologyFile, structure }) })
          .catch(error => console.error(error));
        return () => { cancelled = true };
      }, [needsNglStructure, nglStructure, topologyFile]);

      // Atoms to center the trajectory around, every frame, if requested (e.g. the embed target residue)
      // It is null when there is no centering, and undefined while NGL is still needed to find the atoms
      const centeringAtomIndices = useMemo(() => {
        if (!centering || !topologyManager) return null;
        if ((subset || needsNglSelection(centering)) && !nglStructure) return undefined;
        const atomIndices = nglSelectionToAtomIndices(centering, topologyManager, nglStructure, subset);
        if (!atomIndices || atomIndices.length === 0) {
          console.error(`Centering selection "${centering}" matches no atoms`);
          return null;
        }
        return atomIndices;
      }, [centering, topologyManager, nglStructure, subset]);

      // Keep the distance tooltip function in a reference so the hover handler is not reset
      const distanceTooltipRef = useRef(distanceTooltip);
      distanceTooltipRef.current = distanceTooltip;
      // Keep the hover display function in a reference for the same reason
      const onHoverDisplayRef = useRef(onHoverDisplay);
      onHoverDisplayRef.current = onHoverDisplay;

      // Show our tooltip with the corresponding values when the mouse hovers an atom/bond, as in the NGL viewer
      useEffect(() => {
        if (!molstar || !topologyManager) return;
        const tooltip = tooltipRef.current;
        const container = parentRef.current;
        // Hover single atoms, as NGL does, rather than whole residues
        molstar.managers.interactivity.setProps({ granularity: 'element' });
        // Save a timeout before displaying the tooltip
        // This way we can kill the display in case the mouse is out before the timeout is over
        let timeout;
        // Set a function that both prevents the tooltip if it is about to appear and hides it is already displayed
        const hideTooltip = () => {
          clearTimeout(timeout);
          tooltip.style.display = 'none';
        };
        // Atom indices of the loaded topology must be translated to whole system indices in partial systems
        const partialSystem = subset && subset.partialSystem;
        const describe = atom => {
          const atomIndex = toWholeAtomIndex(partialSystem, atom.index);
          return (
            <AtomDescription
              atomIndex={atomIndex}
              atomName={atom.name}
              residueName={atom.residueName}
              residue={topologyManager.getAtomByIndex(atomIndex).residue}
            />
          );
        };
        const subscription = molstar.behaviors.interaction.hover.subscribe(({ current, page }) => {
          hideTooltip();
          // A link between two atoms (see AtomPairsShape), or an atom or bond
          const atomPair = getHoveredAtomPair(current.loci);
          const atoms = atomPair ? atomPair.atoms : getHoveredAtoms(current.loci);
          if (!atoms || !page) return;
          timeout = setTimeout(() => {
            const [atom1, atom2] = atoms;
            const [index1, index2] = atoms.map(atom => toWholeAtomIndex(partialSystem, atom.index));
            let description;
            // When we hover a distance
            if (atomPair) {
              const custom = distanceTooltipRef.current && distanceTooltipRef.current(index1, index2);
              description = custom || (
                <>
                  <div>{`Distance ${index1} - ${index2} (${atomPair.length.toFixed(2)} Å)`}</div>
                  <hr style={{ color: 'lightGrey' }} />
                  {describe(atom1)}
                  <hr style={{ color: 'lightGrey' }} />
                  {describe(atom2)}
                </>
              );
            }
            // When we hover a bond
            else if (atom2) {
              description = (
                <>
                  <div>{`Bond ${index1} - ${index2}`}</div>
                  <hr style={{ color: 'lightGrey' }} />
                  {describe(atom1)}
                  <hr style={{ color: 'lightGrey' }} />
                  {describe(atom2)}
                </>
              );
            }
            // When we hover an atom
            else {
              description = describe(atom1);
              if (onHoverDisplayRef.current)
                description = onHoverDisplayRef.current(index1, description);
            }
            setTooltipContent(description);
            // Handle tooltip position
            // WARNING: It is important to make the display block before calculating the position
            // This is because the position is calculated from the tooltip size, which would be 0 otherwise
            tooltip.style.display = 'block';
            // Molstar gives the mouse position relative to the canvas, despite calling it 'page'
            // The tooltip position is calculated from the mouse position in the window
            const canvas = molstar.canvas3dContext.canvas.getBoundingClientRect();
            const mouse = { x: canvas.left + page[0], y: canvas.top + page[1] };
            const { x, y } = setTooltipPosition(container, tooltip, mouse, 3);
            tooltip.style.top = y + 'px';
            tooltip.style.left = x + 'px';
          }, 400); // Wait 0,4 secs before showing the tooltip
        });
        // Remove the tooltip when the mouse is out of the viewer container
        container.addEventListener('mouseleave', hideTooltip, false);
        return () => {
          subscription.unsubscribe();
          hideTooltip();
          container.removeEventListener('mouseleave', hideTooltip);
        };
      }, [molstar, topologyManager, subset]);

      // Keep the atom selection callbacks in references so the click handler is not reset every render
      const onAtomSelectRef = useRef(onAtomSelect);
      onAtomSelectRef.current = onAtomSelect;
      const isAtomSelectableRef = useRef(isAtomSelectable);
      isAtomSelectableRef.current = isAtomSelectable;
      const atomsSelectable = Boolean(onAtomSelect);

      // Molstar focuses the clicked residue with plain left clicks, moving the camera and showing its surroundings
      // Selecting an atom already focuses it, and both camera movements together end in a sudden jump
      // When atoms are selectable, plain left clicks are taken from molstar then (see the effect below)
      // Other clicks (e.g. right or ctrl + left clicks) keep their default actions
      // Pages either let select atoms or not, so molstar defaults are not restored
      useEffect(() => {
        if (!molstar || !atomsSelectable) return;
        molstar.state.updateBehavior(PluginBehaviors.Representation.FocusLoci, params => {
          params.bindings = { ...params.bindings, clickFocus: Binding.Empty };
        });
        molstar.state.updateBehavior(PluginBehaviors.Camera.FocusLoci, params => {
          params.bindings = NoPrimaryFocusLociBindings;
        });
      }, [molstar, atomsSelectable]);

      // When atoms are selectable, change the cursor to a pointer when hovering a selectable atom
      // Then report the atom index to the parent component when a selectable atom is clicked, as in the NGL viewer
      useEffect(() => {
        if (!molstar || !atomsSelectable) return;
        const canvas = molstar.canvas3dContext.canvas;
        const partialSystem = subset && subset.partialSystem;
        // Find the whole system index of the selectable atom of the main component under the mouse, if any
        // Bonds are also accepted, in which case the first atom of the bond is used
        const getSelectableAtom = loci => {
          const atoms = getHoveredAtoms(loci);
          if (!atoms) return null;
          // Atom indices are those of the main topology, so atoms of other topologies may not be selected
          // Every frame is a new model, but all frames share the atoms of their topology
          const mainPipeline = trajectoryPipelineRef.current;
          const mainStructure = mainPipeline && mainPipeline.structure && mainPipeline.structure.data;
          if (!mainStructure) return null;
          if (loci.structure.model.atomicHierarchy !== mainStructure.model.atomicHierarchy) return null;
          const atomIndex = toWholeAtomIndex(partialSystem, atoms[0].index);
          const isSelectable = isAtomSelectableRef.current;
          if (isSelectable && !isSelectable(atomIndex)) return null;
          return atomIndex;
        };
        const hoverSubscription = molstar.behaviors.interaction.hover.subscribe(({ current }) => {
          canvas.style.cursor = getSelectableAtom(current.loci) === null ? 'default' : 'pointer';
        });
        const clickSubscription = molstar.behaviors.interaction.click.subscribe(({ current, button, modifiers }) => {
          if (button !== ButtonsType.Flag.Primary || !ModifiersKeys.areNone(modifiers)) return;
          const atomIndex = getSelectableAtom(current.loci);
          if (atomIndex !== null) {
            onAtomSelectRef.current(atomIndex);
            return;
          }
          // Otherwise focus the clicked residue as molstar does
          if (Loci.isEmpty(current.loci)) return;
          const loci = Loci.normalize(current.loci, 'residue');
          const { focus } = molstar.managers.structure;
          if (focus.current && Loci.areEqual(focus.current.loci, loci)) focus.clear();
          else focus.setFromLoci(loci);
          molstar.managers.camera.focusLoci(Loci.normalize(current.loci, 'element'));
        });
        return () => {
          hoverSubscription.unsubscribe();
          clickSubscription.unsubscribe();
          canvas.style.cursor = 'default';
        };
      }, [molstar, atomsSelectable, subset]);

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
      // DEV-ONLY: the last built bundle components, to check they keep their atoms during playback
      const bundleComponentsRef = useRef(null);
      const [rebuildRetries, setRebuildRetries] = useState(0);
      // Set while a full rebuild is in flight, to tell the user
      const [building, setBuilding] = useState(false);

      // Handle the upper left corner viewer logs, as in the NGL viewer
      const viewerLogs = useMemo(() => {
        if (downloadError) return downloadError;
        if (!topologyManager) return 'Waiting for the main topology';
        if (!trajectories.length && !noTrajectory) return `No trajectory available`;
        if (!builtStructure) return `Waiting for the main component`;
        if (building) return `Rendering...`;
        return undefined; // Show nothing when everything was finished and fine
      }, [downloadError, topologyManager, trajectories, noTrajectory, builtStructure, building]);

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
      // Every topology is parsed once into a model, which is saved by the topology urlpath
      // Components find the model of their topology by this urlpath (see the trajectories effect)
      useEffect(() => {
        // Stop here if we are still loading topologies
        if (anyLoadingTopology) return;
        // Get the molstar reference
        if (!molstar) return;
        // Load each topology
        topologies.forEach(async topology => {
          if (!topology.file) return;
          // Skip topologies already parsed or being parsed
          // Note that parsing is async, so its model may not be in the state yet
          if (parsedTopologiesRef.current.get(topology.urlpath) === topology.file) return;
          parsedTopologiesRef.current.set(topology.urlpath, topology.file);
          // Download and apply data
          const data = await molstar.builders.data.rawData(
            { data: topology.file },
            { state: { isGhost: true } },
          );
          const trajectory = await molstar.builders.structure.parseTrajectory(data, 'pdb');
          // WARNING: Do not modify this model
          // Components with trajectories build their own models from it and their coordinates
          const model = await molstar.builders.structure.createModel(trajectory);
          // Save the model reference by the topology urlpath
          setTopologyModels(previous => ({ ...previous, [topology.urlpath]: model.ref }));
        });
      }, [molstar, anyLoadingTopology, topologies]);

      // Load the components in molstar
      // Every component has its own pipeline: the model of its topology, the coordinates of its trajectory,
      // if any, and the structure the representations are built on. Components which are 'only topology'
      // (e.g. pockets) or have no trajectory get their structure from the topology itself
      // Once trajectory bytes start arriving, build the playback pipeline immediately so the trajectory
      // can play while the rest of it keeps downloading, mirroring the NGL viewer's incremental behaviour
      // (see payload-to-ngl-file/updateNGLFile). This effect reruns on every downloaded chunk; most of
      // those reruns just grow the already-built trajectory in place (mutating the live molstar
      // Coordinates/Trajectory data directly) instead of rebuilding the whole
      // coords->trajectory->model->structure->representations pipeline, which would be far too expensive
      // to redo on every network chunk. A component is only rebuilt when its model, its trajectory or its
      // centering changes, and representations are rebuilt alone when only they change.
      // Only the main (first) component is played, as in the NGL viewer
      useEffect(() => {
        // Wait for the molstar reference to be available
        if (!molstar || !components || components.length === 0) return;
        // This wrapper function is the most correct way to call awaits inside a use effect
        const wrap = async () => {
          // If the trajectory must be centered then wait until we know around which atoms
          if (centeringAtomIndices === undefined) return;

          const mainComponent = components[0];
          const pipelines = pipelinesRef.current;

          // Set what every component needs: the model of its topology and its trajectory, if any
          // Components which are not ready yet (topology or trajectory still downloading) are left for later
          // A component which was already built keeps its current pipeline meanwhile
          const inputs = new Map();
          for (const comp of components) {
            const modelRef = topologyModels[comp.topologyURL];
            if (!modelRef) continue;
            if (comp.onlyTopology) {
              inputs.set(comp.name, { modelRef, urlpath: null });
              continue;
            }
            // NGL joins several trajectories in a component, but no page uses more than one
            if (!comp.framedURLs || comp.framedURLs.length === 0) continue;
            if (comp.framedURLs.length > 1)
              console.warn(`Molstar viewer: only the first trajectory of component "${comp.name}" is loaded`);
            const urlpath = comp.framedURLs[0];
            const trajectory = trajectories.find(trajectory => trajectory.urlpath === urlpath);
            if (!trajectory) continue;
            // If the trajectory has no atom count then read it from the already-parsed structure
            // This may happen when we request coordinates using resindices or chaindices
            const modelAtoms = molstar.state.data.cells.get(modelRef).obj.data.atomicHierarchy.atoms._rowCount;
            const atoms = trajectory.atoms || modelAtoms;
            // Only the first 'loadedBytes' bytes of the payload buffer are downloaded
            const bytesPerFrame = atoms * BYTES_PER_ATOM;
            const fitLength = Math.floor(trajectory.loadedBytes / bytesPerFrame) * bytesPerFrame;
            // If there is not a whole frame yet then wait
            if (fitLength === 0) continue;
            inputs.set(comp.name, {
              modelRef,
              urlpath,
              trajectory,
              atoms,
              fitLength,
              // The trajectory is centered around atoms of the main topology
              centering: comp.topologyURL === mainComponent.topologyURL ? centeringAtomIndices : null,
            });
          }

          // Check if all required data of the main trajectory is already downloaded
          const mainInput = inputs.get(mainComponent.name);
          if (mainInput && mainInput.trajectory) {
            const totalFrames = mainInput.fitLength / (mainInput.atoms * BYTES_PER_ATOM);
            expectedFramesRef.current = mainInput.trajectory.frames;
            isCompleteRef.current = totalFrames === mainInput.trajectory.frames;
          }

          // A component is rebuilt the first time, or if its model, its trajectory or its centering changed
          // Not on every new chunk of the same trajectory
          const isStale = (pipeline, input) => !pipeline ||
            pipeline.modelRef !== input.modelRef ||
            pipeline.urlpath !== input.urlpath ||
            pipeline.centering !== input.centering;
          const staleNames = [...inputs.keys()].filter(name => isStale(pipelines.get(name), inputs.get(name)));
          // Components which are not anymore are discarded
          const removedNames = [...pipelines.keys()].filter(name => !components.some(comp => comp.name === name));
          // When only the representations change, they are rebuilt alone
          // This keeps the parsed coordinates and the current frame, as the NGL viewer does
          // They are also rebuilt once NGL has parsed the topology, to represent the selections only NGL understands
          const lastBuild = representationsBuildRef.current;
          const needsRepresentationsRebuild = staleNames.length > 0 || removedNames.length > 0 || !lastBuild ||
            lastBuild.representations !== representations ||
            lastBuild.nglStructure !== nglStructure;

          // Build the pipeline of a component, up to the structure the representations are built on
          const buildPipeline = async (name, input) => {
            const { modelRef, urlpath } = input;
            // Components with no trajectory represent the topology itself
            if (!urlpath) {
              // Ask for the model as-is: the default is 'assembly', which for an MD topology
              // searches for symmetry that isn't there, logs a warning, and falls back to exactly
              // this anyway
              const structure = await molstar.builders.structure.createStructure(
                modelRef,
                { name: 'model', params: {} },
              );
              return { modelRef, urlpath, centering: input.centering, rootRefs: [structure.ref], structure };
            }

            // Load the whole frames downloaded so far
            const coords = await molstar
              .build()
              .toRoot()
              .apply(TrajectoryFromCustomData, {
                data: input.trajectory.payload.slice(0, input.fitLength),
                natoms: input.atoms,
                centering: input.centering,
              })
              .commit();

            const molstarTrajectory = await molstar
              .build()
              .toRoot()
              .apply(
                TrajectoryFromModelAndCoordinates,
                {
                  modelRef,
                  coordinatesRef: coords.ref,
                },
                { dependsOn: [modelRef, coords.ref] },
              )
              .commit();

            // Get the current trajectory model
            // From now on, this is the model to be modified and not the topology model
            // NOTE: keep this as molstar's own ModelFromTrajectory. AnimateModelIndex finds the
            // node to advance by selecting that exact transformer, so replacing it with a custom
            // equivalent (as interpolating between frames would need) leaves the animation with
            // nothing to drive: playback then silently does nothing, with no error anywhere.
            // Such a replacement has to land together with its own playback driver
            const newModel = await molstar.builders.structure.createModel(
              molstarTrajectory,
            );

            // Ask for the model as-is (see above)
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

            return {
              modelRef,
              urlpath,
              centering: input.centering,
              // Deleting the trajectory root cascades to its model/structure/representations
              // descendants (parent-child tree edges), unlike the coords->trajectory dependsOn edge
              rootRefs: [coords.ref, molstarTrajectory.ref],
              modelFromTrajectory: newModel,
              baseModel: molstar.state.data.cells.get(modelRef).obj.data,
              coordsData: coords.data,
              trajectoryData: molstarTrajectory.data,
              parsedBytes: input.fitLength,
              structure: frozenSecondaryStructure.selector,
            };
          };

          // DEV-ONLY: bundle components address atoms by unit id + element index, and molstar
          // only reuses a bundle while its stored hash still matches the structure's. The hash
          // covers unit ids and element arrays but not coordinates, and a coordinate-only remap
          // preserves both, so it should hold for every frame of a trajectory. If that ever
          // stopped being true the component would be quietly replaced by an EMPTY structure
          // and its representation would just vanish - no error, nothing in the console - so
          // check it explicitly rather than relying on someone noticing a missing membrane
          const checkBundleComponents = () => {
            const check = bundleComponentsRef.current;
            if (!check || check.reported) return;
            for (const built of check.components) {
              const current = built.component.data;
              if (current && current.elementCount === built.elementCount) continue;
              check.reported = true; // Report once, not once per frame
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
          const subscribeProgress = newModel => {
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
          };

          // Get the molstar color theme of a representation painted with an NGL color scheme, if so
          // Schemes are made for the whole system, so in partial systems they are adapted, as in the NGL viewer
          // NGL is needed to calculate the colors, so representations are colored by chain until it is ready
          // The scheme is either a 'custom' color with the scheme id apart or the color itself (e.g. lipid-inter)
          const getCustomColorTheme = (representation, sameTopology) => {
            const { color, customScheme } = representation;
            const scheme = color === 'custom' ? customScheme : isNglScheme(color) ? color : null;
            if (!scheme || !sameTopology || !nglStructure) return;
            const schemeId = subset
              ? toPartialColorScheme(subset.partialSystem, topologyManager, scheme)
              : scheme;
            return nglSchemeToTheme(nglStructure, schemeId);
          };

          // Build one molstar component + representation per data representation
          // (mirrors what the NGL viewer does with the same `representations`/`components` props)
          // Every representation is built on the structure of its component, or the main component
          // Return the references of the built nodes, which are to be deleted to rebuild them
          const buildRepresentations = async () => {
            // Fall back to a single lightweight cartoon over the whole structure when there is
            // no representations data yet (e.g. still loading) or none was provided at all
            const reps = representations && representations.length > 0
              ? representations
              : [{ selection: 'all', type: 'cartoon', color: 'chainid' }];

            const builtRefs = [];
            // Built bundle components, kept only so the dev-only sanity check above can notice if
            // one of them ever silently empties out during playback (see the check for why)
            const builtBundleComponents = [];

            for (const [repIndex, representation] of reps.entries()) {
              if (representation.show === false) continue;
              // Find the structure of the representation component, if it is already built
              const componentName = representation.component || mainComponent.name;
              const pipeline = pipelines.get(componentName);
              if (!pipeline) continue;
              const structure = pipeline.structure;
              // Selections are translated with the main topology (see nglSelectionToAtomIndices)
              // Components with other topologies (e.g. pockets) only understand our own selections
              const comp = components.find(comp => comp.name === componentName);
              const sameTopology = comp && comp.topologyURL === mainComponent.topologyURL;

              // NGL distance representations link pairs of whole system atom indices instead (e.g. allostery)
              // Their selection is ignored, as in NGL
              if (representation.type === 'distance') {
                const atomPairs = (representation.other && representation.other.atomPair) || [];
                const partialSystem = sameTopology && subset ? subset.partialSystem : null;
                const built = await buildAtomPairs(molstar, structure, toPartialAtomGroups(partialSystem, atomPairs), {
                  label: representation.name || 'Distances',
                  color: representation.color,
                  colorTheme: getCustomColorTheme(representation, sameTopology),
                  opacity: representation.opacity,
                  radius: representation.other && representation.other.radiusSize,
                });
                builtRefs.push(built.ref);
                continue;
              }
              const atomIndices = nglSelectionToAtomIndices(
                representation.selection, topologyManager,
                sameTopology ? nglStructure : null, sameTopology ? subset : null);
              const built = await buildRepresentation(molstar, structure, atomIndices, {
                // 'label' is what molstar names this node in the state tree and in its per-node
                // update timing log; without it every component is just 'Selection'
                label: representation.name || representation.selection,
                // The key is what tryCreateComponent tags the node with, and equal keys
                // UPDATE the same node instead of adding a second one. Names are not
                // guaranteed unique (a representation with no name falls back to its
                // selection, and different representations may share a selection), so
                // disambiguate with the index
                key: `${representation.name || representation.selection}#${repIndex}`,
                type: representation.type,
                color: representation.color,
                colorTheme: getCustomColorTheme(representation, sameTopology),
                opacity: representation.opacity,
              });
              if (!built) continue;
              builtRefs.push(built.ref);
              if (built.bundleComponent) builtBundleComponents.push(built.bundleComponent);
            }
            bundleComponentsRef.current = { components: builtBundleComponents, reported: false };
            return builtRefs;
          };

          if (needsRepresentationsRebuild) {
            // Skip if a previous rebuild triggered by an earlier chunk is still in flight
            // It will be retried once the current rebuild is done (see skippedRebuildRef)
            if (buildingRef.current) {
              skippedRebuildRef.current = true;
              return;
            }
            buildingRef.current = true;
            setBuilding(true);
            try {
              // Discard the previous representations first, then the pipelines which are to be rebuilt
              // Otherwise every rebuild would stack a new duplicate on top of the previous one
              const update = molstar.build();
              if (lastBuild) lastBuild.representationRefs.forEach(ref => update.delete(ref));
              for (const name of [...removedNames, ...staleNames]) {
                const pipeline = pipelines.get(name);
                if (!pipeline) continue;
                pipeline.rootRefs.forEach(ref => update.delete(ref));
                pipelines.delete(name);
              }
              await update.commit();
              // Build the new pipelines
              for (const name of staleNames) {
                const pipeline = await buildPipeline(name, inputs.get(name));
                pipelines.set(name, pipeline);
                if (name === mainComponent.name && pipeline.modelFromTrajectory)
                  subscribeProgress(pipeline.modelFromTrajectory);
              }
              const representationRefs = await buildRepresentations();
              representationsBuildRef.current = { representations, nglStructure, representationRefs };
              const mainPipeline = pipelines.get(mainComponent.name) || null;
              trajectoryPipelineRef.current = mainPipeline;
              if (staleNames.includes(mainComponent.name)) setBuiltStructure(mainPipeline.structure);
            } finally {
              buildingRef.current = false;
              setBuilding(false);
              if (skippedRebuildRef.current) {
                skippedRebuildRef.current = false;
                setRebuildRetries(retries => retries + 1);
              }
            }
          }

          // Grow the already-built trajectories in place with just the newly downloaded bytes
          // AnimateModelIndex/ModelFromTrajectory both re-read frameCount live on every tick,
          // so mutating these live objects directly is picked up automatically, with no need
          // to rebuild or recommit anything
          for (const [name, input] of inputs) {
            const current = pipelines.get(name);
            if (!current || !current.trajectoryData || current.urlpath !== input.urlpath) continue;
            if (input.fitLength <= current.parsedBytes) continue;
            const newBytes = input.trajectory.payload.slice(current.parsedBytes, input.fitLength);
            const previousFrameCount = current.coordsData.frames.length;
            const newFrames = parseCoordinateFrames(
              newBytes, input.atoms, previousFrameCount, current.centering);
            current.coordsData.frames.push(...newFrames);

            const deltaCoords = Coordinates.create(newFrames, Time(1, 'step'), Time(0, 'step'));
            const deltaTrajectory = Model.trajectoryFromModelAndCoordinates(current.baseModel, deltaCoords);
            current.trajectoryData.frames.push(...deltaTrajectory.frames);
            current.trajectoryData.frameCount = current.trajectoryData.frames.length;
            current.trajectoryData.duration = current.trajectoryData.frames.length;

            current.parsedBytes = input.fitLength;
          }

          // Keep the animation's params in sync with the latest download state on every chunk
          // This is the only place the 'once' -> 'loop' mode switch happens once the trajectory
          // finishes downloading, and it must happen here, proactively, rather than only when
          // playback has already stalled: if completion happens while still mid-playback (still
          // in 'once' mode), nothing else would ever catch it once it later hits the last frame
          // and stops for good, since there is no further chunk left to rerun this effect and
          // resume it - this was the exact scenario that got stuck playing to a halt
          // There is nothing to play if there must be no trajectory (e.g. a single frame)
          const mainPipeline = pipelines.get(mainComponent.name);
          if (!noTrajectory && mainPipeline && mainPipeline.trajectoryData && playing && isInView) {
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
        topologyModels,
        trajectories,
        components,
        representations,
        nglStructure,
        subset,
        centeringAtomIndices,
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
        // NGL rotates the scene once it has been focused the first time
        if (isFirstFocus && rotateX) rotation = rotateSceneAroundX(rotation, ROTATE_X_ANGLE);
        const duration = isFirstFocus ? 0 : FOCUS_TRANSITION_DURATION;
        focusCamera(molstar.canvas3d.camera, structure, sphere, rotation, duration);
      }, [molstar, builtStructure, focus, curatedOrientation, rotateX, topologyManager, nglStructure, subset]);

      // The nodes of the built highlights, to remove them when they change
      const highlightRefsRef = useRef([]);
      // Highlights are built one after the other, since they may change faster than they are built
      const highlightsQueueRef = useRef(Promise.resolve());
      // Represent the highlights on the main component structure
      useEffect(() => {
        if (!molstar || !builtStructure) return;
        highlightsQueueRef.current = highlightsQueueRef.current.then(async () => {
          // Discard the previous highlights, unless they were removed along with a previous structure
          const update = molstar.build();
          highlightRefsRef.current.forEach(ref => {
            if (molstar.state.data.cells.has(ref)) update.delete(ref);
          });
          await update.commit();
          highlightRefsRef.current = [];
          // The structure may be gone if it is being rebuilt, then highlights are built on the new one
          if (!builtStructure.data) return;
          for (const [index, highlight] of highlights.entries()) {
            const atomIndices = nglSelectionToAtomIndices(
              highlight.selection, topologyManager, nglStructure, subset);
            const built = await buildRepresentation(molstar, builtStructure, atomIndices, {
              label: highlight.label || 'Highlight',
              key: `*highlight#${index}`,
              type: highlight.type,
              // NGL colors representations by element by default, but cartoons by chain
              color: highlight.color || (highlight.type === 'cartoon' ? 'chainid' : 'element'),
              opacity: highlight.opacity,
              sizeFactor: highlight.sizeFactor,
            });
            if (built) highlightRefsRef.current.push(built.ref);
          }
        }).catch(error => console.error(error));
      }, [molstar, builtStructure, highlights, nglStructure, subset, topologyManager]);

      // The nodes of the built distances and angles, to remove them when they change
      const measurementRefsRef = useRef([]);
      // Measurements are built one after the other, as highlights
      const measurementsQueueRef = useRef(Promise.resolve());
      // Draw the selected distances and angles on the main component structure, as in the NGL viewer
      // Their atoms are whole system atom indices or NGL selections of a single atom (e.g. '12:A.CA')
      useEffect(() => {
        if (!molstar || !builtStructure) return;
        measurementsQueueRef.current = measurementsQueueRef.current.then(async () => {
          // Discard the previous measurements, unless they were removed along with a previous structure
          const update = molstar.build();
          measurementRefsRef.current.forEach(ref => {
            if (molstar.state.data.cells.has(ref)) update.delete(ref);
          });
          await update.commit();
          measurementRefsRef.current = [];
          // The structure may be gone if it is being rebuilt, then measurements are built on the new one
          const structure = builtStructure.data;
          if (!structure) return;
          // Get the loci of a measured atom
          const getLoci = atom => {
            const selection = typeof atom === 'number' ? `@${atom}` : atom;
            const atomIndices = nglSelectionToAtomIndices(selection, topologyManager, nglStructure, subset);
            if (!atomIndices || atomIndices.length === 0) return null;
            const bundle = StructureElement.Bundle.fromExpression(structure, atomIndicesToExpression(atomIndices));
            const loci = StructureElement.Bundle.toLoci(bundle, structure);
            return StructureElement.Loci.isEmpty(loci) ? null : loci;
          };
          // Labels are painted in the opposite color of the background
          const labelParams = { textColor: Color(darkBackground ? 0xffffff : 0x000000) };
          const { measurement } = molstar.managers.structure;
          const measure = async (atoms, add) => {
            const loci = atoms.map(getLoci);
            // Atoms which are not loaded (e.g. in partial systems) can not be measured
            if (loci.some(atomLoci => !atomLoci)) return;
            const built = await add(...loci);
            if (built) measurementRefsRef.current.push(built.selection.ref);
          };
          for (const atoms of selectedDistances || []) {
            await measure(atoms, (a, b) => measurement.addDistance(a, b, {
              lineParams: { linesColor: Color(DISTANCE_COLOR) },
              labelParams,
            }));
          }
          for (const atoms of selectedAngles || []) {
            await measure(atoms, (a, b, c) => measurement.addAngle(a, b, c, { labelParams }));
          }
        }).catch(error => console.error(error));
      }, [
        molstar, builtStructure, selectedDistances, selectedAngles, darkBackground,
        nglStructure, subset, topologyManager,
      ]);

      // The node of the drawn mesh, to remove it when it changes
      const meshRefRef = useRef(null);
      // Meshes are drawn one after the other, as highlights
      const meshQueueRef = useRef(Promise.resolve());
      // Draw the mesh, if any, as in the NGL viewer
      useEffect(() => {
        if (!molstar || !mesh) return;
        const [position, colorData, name = 'test', normalsData = null] = mesh;
        meshQueueRef.current = meshQueueRef.current.then(async () => {
          const update = molstar.build();
          if (meshRefRef.current) update.delete(meshRefRef.current);
          meshRefRef.current = null;
          if (position && position.length > 0) {
            const shape = update.toRoot().apply(MeshShape, { name, position, colorData, normalsData });
            shape.apply(StateTransforms.Representation.ShapeRepresentation3D);
            meshRefRef.current = shape.ref;
          }
          await update.commit();
        }).catch(error => console.error(error));
      }, [molstar, mesh]);

      // Focus the highlighted atoms or residues with the camera, as in the NGL viewer
      useEffect(() => {
        const focused = highlights.find(highlight => highlight.focus);
        if (focused) setFocus({ sele: focused.selection });
      }, [highlights]);

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
            // The main component may have no trajectory at all (e.g. only topology)
            if (!(molstar && pipeline && pipeline.trajectoryData)) return 1;
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
            data-loading={viewerLogs}
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
