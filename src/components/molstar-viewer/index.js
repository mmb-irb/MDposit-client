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
import { Coordinates, Model, Time } from 'molstar/lib/mol-model/structure';
/*  Might require extra configuration,
see https://webpack.js.org/loaders/sass-loader/ for example.
create-react-app should support this natively. */
//import "molstar/lib/mol-plugin-ui/skin/light.scss";

// Load the parser for trajectory coordinates in our format to molstar format
import { TrajectoryFromCustomData, parseCoordinateFrames } from './molstar-parser';

import { ProjectCtx } from '../../contexts';

import { rangedSelectionParser } from '../../utils/auxiliar-functions';

//import { setTooltipPosition } from '../../utils/tooltip-position-manager';

import style from './style.module.css';

// Used to just wait
import { sleep } from 'timing-functions';

// Load the molstar plugin context in a global and accessible place
//window.molstar = PluginUIContext;

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

// Set the number of bytes per element in trajectory data
const BYTES_PER_COORDINATE = 4; // float 32
const COORDINATES_PER_ATOM = 3; // x, y and z
const BYTES_PER_ATOM = BYTES_PER_COORDINATE * COORDINATES_PER_ATOM;

// Set the viewer player speed limits
// The actual 'speed' input limits are 0-100
// The speed set as the time to wait before moving to the next frame in miliseconds
const minimumSpeed = 0;
const maximumSpeed = 100;
const slowestTimeout = 1000;
const fastestTimeout = 50;
const interpolateSpeed = currentSpeed => (
  slowestTimeout + (currentSpeed - minimumSpeed) *
  ((fastestTimeout - slowestTimeout) / (maximumSpeed - minimumSpeed))
);

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
  licorice: { type: 'line' },
  spacefill: { type: 'spacefill' },
  surface: { type: 'molecular-surface' },
  line: { type: 'line' },
  point: { type: 'point' },
  base: { type: 'ball-and-stick' },
};
const DEFAULT_REPRESENTATION_TYPE = { type: 'ball-and-stick' };
const getRepresentationType = typeName =>
  REPRESENTATION_TYPES[typeName] || DEFAULT_REPRESENTATION_TYPE;

// Map this app's NGL-style color names to molstar color themes
const COLOR_THEMES = {
  chainid: 'chain-id',
  element: 'element-symbol',
  resname: 'residue-name',
};
// Plain color names/values with no direct molstar theme equivalent are rendered as a uniform color
const NAMED_COLORS = {
  grey: 0x808080,
  gray: 0x808080,
  purple: 0x800080,
};
const getColorTheme = colorName => {
  const themeName = COLOR_THEMES[colorName];
  if (themeName) return { name: themeName };
  const namedColor = NAMED_COLORS[colorName];
  if (namedColor !== undefined)
    return { name: 'uniform', params: { value: Color(namedColor) } };
  return { name: 'chain-id' };
};

// Matches the "(:chain and (ranges))" chunks produced by topology.residueIndices2Ngl
// e.g. "(:A and (1, 3-5)) or (:B and (1))"
const NGL_CHAIN_SELECTION_REGEX = /\(:(\S+) and \(([^)]+)\)\)/g;

// Translate one of this app's NGL selection strings into a flat list of atom indices
// Returns null when the selection targets the whole structure (no filtering needed)
// Only understands the chain/residue-range grammar produced by topology.residueIndices2Ngl,
// which is what every default representation (protein, ligands, membrane/lipids, ions, ...) uses
// Arbitrary/custom NGL selections are not supported and fall back to representing the whole structure
const nglSelectionToAtomIndices = (selection, topologyManager) => {
  if (!selection || selection === 'all') return null;
  const atomIndices = [];
  let matched = false;
  let match;
  NGL_CHAIN_SELECTION_REGEX.lastIndex = 0;
  while ((match = NGL_CHAIN_SELECTION_REGEX.exec(selection))) {
    matched = true;
    const [, chainName, ranges] = match;
    for (const residueNumber of rangedSelectionParser(ranges)) {
      try {
        const residue = topologyManager.getResidueByParameters(chainName, residueNumber);
        atomIndices.push(...residue.atomIndices);
      } catch (error) {
        console.warn('Molstar viewer: could not resolve residue for selection', selection, error);
      }
    }
  }
  if (!matched) return null;
  return atomIndices;
};

// Build a molstar expression selecting exactly the given atom indices
// This relies on 'sourceIndex', the 0-based index of the atom in the loaded topology file,
// which matches the atom indices used everywhere else in this app (topology, trajectory coordinates)
const atomIndicesToExpression = atomIndices =>
  MS.struct.generator.atomGroups({
    'atom-test': MS.core.set.has([MS.core.type.set(atomIndices), MS.acp('sourceIndex')]),
  });

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
      // Mirrors 'molstar' for the cleanup function below, which otherwise closes over the stale
      // (always null) value from this effect's one-time initial render, since 'setMolstar' only
      // resolves asynchronously - meaning dispose() below would never actually run without it
      const molstarRef = useRef(null);

      // Setup molstar
      useEffect(() => {
        // This wrapper function is the most correct way to call awaits inside a use effect
        const wrap = async () => {
          // Create the plugin
          const molstarInstance = await createPluginUI({
            target: parentRef.current,
            render: renderReact18,
            spec: molstarSpec,
          });
          molstarRef.current = molstarInstance;
          setMolstar(molstarInstance);
        };
        wrap();
        // Cleanup function
        return () => {
          progressSubscriptionRef.current?.unsubscribe();
          molstarRef.current?.dispose();
          molstarRef.current = null;
        };
      }, []);

      // Set the molstar model reference
      const [modelReference, setModelReference] = useState(null);

      // Track the currently built trajectory/structure/representations pipeline
      // (root-level refs to discard on a real rebuild, and the live data objects that
      // can instead be grown in place while more trajectory data keeps streaming in)
      const trajectoryPipelineRef = useRef(null);
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

      // DEV-ONLY: measured actual playback framerate, shown in a small on-screen badge so the
      // 'speed' slider's effect can be visually verified. Stripped in production builds since
      // process.env.NODE_ENV is statically known then, so this whole branch is dead-code-eliminated
      const frameTimesRef = useRef([]);
      const lastRecordedModelIndexRef = useRef(null);
      const [debugFps, setDebugFps] = useState(0);
      // 'stateUpdated' fires more than once per real frame advance (representation/render
      // bookkeeping also touches this cell), so only count a tick when modelIndex actually changed
      const recordFrameTick = useCallback(modelIndex => {
        if (process.env.NODE_ENV !== 'development') return;
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
        const maxFps = Math.max(1, Math.min(60, Math.round(1000 / timeout)));
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

          let trajectoryAtoms;
          let trajectoryFinalExpectedFrames = 0;

          trajectoryAtoms = trajectory.atoms;
          if (trajectoryAtoms !== trajectory.atoms)
            throw new Error(
              `Atoms number in the different trajectories do not match`,
            );

          // Add the final expected frames for all frames in the component
          trajectoryFinalExpectedFrames += trajectory.frames;

          const payload = trajectory.payload;
          const bytesPerFrame = trajectoryAtoms * BYTES_PER_ATOM;
          const fitLength =
            Math.floor(payload.byteLength / bytesPerFrame) * bytesPerFrame;
          const totalPayload = payload.slice(0, fitLength);

          // If the total payload is empty then stop here
          if (totalPayload.byteLength === 0) return;

          // Calculate how many frames are there in total
          const totalFrames = totalPayload.byteLength / bytesPerFrame;

          // Check if all required data is already downloaded
          const completedTrajectory =
            totalFrames === trajectoryFinalExpectedFrames;
          expectedFramesRef.current = trajectoryFinalExpectedFrames;
          isCompleteRef.current = completedTrajectory;

          const pipeline = trajectoryPipelineRef.current;
          // A full rebuild is only required the first time, or if the represented model or the
          // representation set itself changed - not on every new chunk of the same trajectory
          const needsFullRebuild = !pipeline ||
            pipeline.modelReference !== modelReference ||
            pipeline.representations !== representations;

          if (needsFullRebuild) {
            // Skip if a previous rebuild triggered by an earlier chunk is still in flight
            // (the next chunk's rerun will catch up through the cheap growth path below)
            if (buildingRef.current) return;
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

              // Load coordinates as they are parsed
              const coords = await molstar
                .build()
                .toRoot()
                .apply(TrajectoryFromCustomData, {
                  data: totalPayload,
                  natoms: trajectory.atoms,
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
              const newModel = await molstar.builders.structure.createModel(
                molstarTrajectory,
              );

              // Set the default representations
              const structure = await molstar.builders.structure.createStructure(
                newModel,
              );

              // Build one molstar component + representation per data representation
              // (mirrors what the NGL viewer does with the same `representations`/`components` props)
              // Fall back to a single lightweight cartoon over the whole structure when there is
              // no representations data yet (e.g. still loading) or none was provided at all
              const reps = representations && representations.length > 0
                ? representations
                : [{ selection: 'all', type: 'cartoon', color: 'chainid' }];

              for (const representation of reps) {
                if (representation.show === false) continue;

                // Resolve which atoms this representation targets, and build a component for them
                let component;
                const atomIndices = nglSelectionToAtomIndices(representation.selection, topologyManager);
                if (atomIndices === null) {
                  // No filtering needed: represent the whole structure
                  component = structure;
                } else {
                  if (atomIndices.length === 0) continue;
                  component = await molstar.builders.structure.tryCreateComponentFromExpression(
                    structure,
                    atomIndicesToExpression(atomIndices),
                    representation.name || representation.selection,
                  );
                  // The selection matched no atoms in the loaded structure
                  if (!component) continue;
                }

                const { type, typeParams } = getRepresentationType(representation.type);
                const colorTheme = getColorTheme(representation.color);
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
                      ignoreLight: true,
                      ...typeParams,
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

              // Notify onProgress/currentFrame consumers whenever the current frame changes
              // (playback tick or manual scrub), by watching the frame-index-controlling node
              if (progressSubscriptionRef.current) progressSubscriptionRef.current.unsubscribe();
              progressSubscriptionRef.current = molstar.state.data.events.cell.stateUpdated.subscribe(
                event => {
                  if (event.ref !== newModel.ref) return;
                  const modelIndex = (newModel.cell && newModel.cell.transform.params.modelIndex) || 0;
                  recordFrameTick(modelIndex);
                  if (!onProgress) return;
                  const total = expectedFramesRef.current;
                  if (total <= 1) return;
                  onProgress(Math.min(1, Math.max(0, modelIndex / (total - 1))));
                },
              );

              trajectoryPipelineRef.current = {
                modelReference,
                representations,
                coordsRef: coords.ref,
                trajectoryRef: molstarTrajectory.ref,
                modelFromTrajectory: newModel,
                baseModel: molstar.state.data.cells.get(modelReference).obj.data,
                coordsData: coords.data,
                trajectoryData: molstarTrajectory.data,
                parsedBytes: totalPayload.byteLength,
              };
            } finally {
              buildingRef.current = false;
            }
          } else if (totalPayload.byteLength > pipeline.parsedBytes) {
            // Grow the already-built trajectory in place with just the newly downloaded bytes
            // AnimateModelIndex/ModelFromTrajectory both re-read frameCount live on every tick,
            // so mutating these live objects directly is picked up automatically, with no need
            // to rebuild or recommit anything
            const newBytes = totalPayload.slice(pipeline.parsedBytes);
            const previousFrameCount = pipeline.coordsData.frames.length;
            const newFrames = parseCoordinateFrames(newBytes, trajectoryAtoms, previousFrameCount);
            pipeline.coordsData.frames.push(...newFrames);

            const deltaCoords = Coordinates.create(newFrames, Time(1, 'step'), Time(0, 'step'));
            const deltaTrajectory = Model.trajectoryFromModelAndCoordinates(pipeline.baseModel, deltaCoords);
            pipeline.trajectoryData.frames.push(...deltaTrajectory.frames);
            pipeline.trajectoryData.frameCount = pipeline.trajectoryData.frames.length;
            pipeline.trajectoryData.duration = pipeline.trajectoryData.frames.length;

            pipeline.parsedBytes = totalPayload.byteLength;
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
        topologyManager,
        noTrajectory,
        playing,
        isInView,
        onProgress,
        getAnimationParams,
        recordFrameTick,
      ]);

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
          displayFocus() {
            const orientation = stageRef.current.viewerControls.getOrientation();
            const stringifiedArray = `[${orientation.elements.toString()}]`;
            console.log(stringifiedArray);
          },
          centerFocus() {
            setFocus({ comp: 0, sele: 'all' });
            // Use the provided orientation, if any
            // DANI: Sin hacer
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
            data-loading={undefined}
          />
          <div ref={tooltipRef} className={style.tooltip}>
            {tooltipContent}
          </div>
          {process.env.NODE_ENV === 'development' && (
            <div style={debugFpsBadgeStyle}>{debugFps.toFixed(1)} fps</div>
          )}
        </>
      );
    },
  ),
);

export default MolstarViewer;
