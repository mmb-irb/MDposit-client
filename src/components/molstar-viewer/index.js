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
import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { TrajectoryFromModelAndCoordinates } from 'molstar/lib/mol-plugin-state/transforms/model';
import { AnimateModelIndex } from 'molstar/lib/mol-plugin-state/animation/built-in/model-index';
import { createStructureRepresentationParams } from 'molstar/lib/mol-plugin-state/helpers/structure-representation-params';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { Color } from 'molstar/lib/mol-util/color';
/*  Might require extra configuration,
see https://webpack.js.org/loaders/sass-loader/ for example.
create-react-app should support this natively. */
//import "molstar/lib/mol-plugin-ui/skin/light.scss";

// Load the parser for trajectory coordinates in our format to molstar format
import { TrajectoryFromCustomData } from './molstar-parser';

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
    // DANI: No se que hace esto pero he visto que alguien lo ponía así que yo también
    remoteState: 'none',
  },
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

      // Setup molstar
      useEffect(() => {
        // This wrapper function is the most correct way to call awaits inside a use effect
        const wrap = async () => {
          // Create the plugin
          const molstarInstance = await createPluginUI(
            parentRef.current,
            molstarSpec,
          );
          setMolstar(molstarInstance);
        };
        wrap();
        // Cleanup function
        return () => {
          if (!molstar) return;
          molstar.dispose();
          molstar = null;
        };
      }, []);

      // Set the molstar model reference
      const [modelReference, setModelReference] = useState(null);

      // Track the root node of the previously built trajectory/structure/representations
      // so it can be discarded before rebuilding, instead of stacking duplicates on every rerun
      const previousTrajectoryRootRef = useRef(null);

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
      // Once the trajectories are downloaded, load them in corresponding viewer representations
      // Every time the trajectory payloads change this useEffect must be rerun
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
          const lastFrameIndex = totalFrames - 1;

          // Check if all required data is already downloaded
          const completedTrajectory =
            totalFrames === trajectoryFinalExpectedFrames;
          if (!completedTrajectory) return;

          // Discard the previously built trajectory/structure/representations, if any
          // Otherwise every rerun of this effect would stack a new duplicate on top of the previous one
          if (previousTrajectoryRootRef.current) {
            await molstar
              .build()
              .delete(previousTrajectoryRootRef.current)
              .commit();
            previousTrajectoryRootRef.current = null;
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
          previousTrajectoryRootRef.current = coords.ref;

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
      ]);

      // play/pause button effect
      useEffect(() => {
        // If molstar has not been yet initiated then stop here
        if (!molstar) return;

        // If there is no trajectory then there is nothing to play
        if (noTrajectory) return;

        // Play
        if (playing && isInView) {
          molstar.managers.animation.play(AnimateModelIndex, {
            // Select the time it takes to switch between frames
            //duration: { name: 'fixed', params: { durationInS: 10 } },
            //duration: { name: 'computed', params: { targetFps: 10 } },
            duration: { name: 'sequential', params: { maxFps: 10 } },
            // Select the mode it switches frames
            //mode: { name: 'once', params: { direction: 'forward' } }
            mode: { name: 'loop', params: { direction: 'forward' } },
            //mode: { name: 'palindrome', params: {} }
          });
        }
        // Pause
        else {
          molstar.managers.animation.stop();
        }
      }, [molstar, playing, isInView, noTrajectory, bounce]);

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
            if (!(molstar && trajectories.length)) return -1;
            try {
              return stageRef.current.compList[0].trajList[0].trajectory
                .currentFrame;
            } catch (_) {
              return -1;
            }
          },
          set currentFrame(value) {
            if (!(molstar && trajectories.length)) return;
            try {
              const total = this.totalFrames;
              let frame = value;
              if (frame < 0) frame = 0;
              if (frame >= total) frame = total - 1;
              stageRef.current.compList[0].trajList[0].trajectory.setFrame(
                frame,
              );
            } catch (_) {
              /* */
            }
          },
          get totalFrames() {
            if (!(molstar && trajectories.length)) return 1;
            try {
              return stageRef.current.compList[0].trajList[0].trajectory.frames
                .length;
            } catch (_) {
              return 1;
            }
          },
          get totalExpectedFrames() {
            try {
              return stageRef.current.compList[0].trajList[0].expectedFrames;
            } catch (_) {
              return 1;
            }
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
        </>
      );
    },
  ),
);

export default MolstarViewer;
