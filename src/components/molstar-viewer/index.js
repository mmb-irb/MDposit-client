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
/*  Might require extra configuration,
see https://webpack.js.org/loaders/sass-loader/ for example.
create-react-app should support this natively. */
//import "molstar/lib/mol-plugin-ui/skin/light.scss";

// Load the parser for trajectory coordinates in our format to molstar format
import { TrajectoryFromCustomData } from './molstar-parser';

import { ProjectCtx } from '../../contexts';

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
          molstarInstance = await createPluginUI(
            parentRef.current,
            molstarSpec,
          );
          // If we were unmounted while creating it then nobody else will dispose it
          if (unmounted) molstarInstance.dispose();
          else setMolstar(molstarInstance);
        };
        wrap();
        // Cleanup function
        // Disposing stops the plugin render loop and releases its WebGL context
        return () => {
          unmounted = true;
          if (molstarInstance) molstarInstance.dispose();
        };
      }, []);

      // Set the molstar model reference
      const [modelReference, setModelReference] = useState(null);

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

          // Only the first 'loadedBytes' bytes of the payload buffer are downloaded
          const payload = trajectory.payload;
          const bytesPerFrame = trajectoryAtoms * BYTES_PER_ATOM;
          const fitLength =
            Math.floor(trajectory.loadedBytes / bytesPerFrame) * bytesPerFrame;

          // If the total payload is empty then stop here
          if (fitLength === 0) return;

          // Calculate how many frames are there in total
          const totalFrames = fitLength / bytesPerFrame;
          const lastFrameIndex = totalFrames - 1;

          // Check if all required data is already downloaded
          const completedTrajectory =
            totalFrames === trajectoryFinalExpectedFrames;
          if (!completedTrajectory) return;

          // Copy the downloaded frames only once they are all here
          const totalPayload = payload.slice(0, fitLength);

          // Load coordinates as they are parsed
          const coords = await molstar
            .build()
            .toRoot()
            .apply(TrajectoryFromCustomData, {
              data: totalPayload,
              natoms: trajectory.atoms,
            })
            .commit();

          // Get the current loaded trajectories
          // DANI: No te fies de este número
          // DANI: Aquí aparecen todas las trayectorias declaradas, incluido aquellas que no han sido 'aplicadas'
          const loadedTrajectories =
            molstar.managers.structure.hierarchy.current.trajectories;

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

          // Set the default representation
          // Use a lightweighted representation type
          const structure = await molstar.builders.structure.createStructure(
            newModel,
          );
          const components = molstar.build().to(structure);
          const lightRepresentation = createStructureRepresentationParams(
            molstar,
            void 0,
            {
              type: 'cartoon',
              typeParams: {
                // Quality options: custom, auto, highest, higher, high, medium, low, lower, lowest
                // https://github.com/molstar/molstar/blob/0e197b18857d59c27f51d4aa0226cd772bc872ca/src/mol-geo/geometry/base.ts
                // DANI: 'lowest' se ve muy feo y no mejora mucho el rendimiento
                quality: 'lower',
                ignoreHydrogens: 'all',
                ignoreHydrogensVariant: 'all',
                ignoreLight: true,
              },
            },
          );

          components.apply(
            StateTransforms.Representation.StructureRepresentation3D,
            lightRepresentation,
          );
          await components.commit();

          // DANI: Hay 2 presets: 'default' y 'all-models'. Aparecen siempre, aunque tu no los hayas creado
          //const currentPresets = molstar.builders.structure.hierarchy.getPresetsWithOptions(molstarTrajectory);
          //console.log(currentPresets);

          // DANI: El apply preset puede hacerse a 'default' o a 'all-models'
          // DANI: El 'all-models' te representa todas las frames superpuestas (y tarda)
          // await molstar.builders.structure.hierarchy.applyPreset(
          //   molstarTrajectory,
          //   'default',
          // );

          // If there is a trajectory already update it with new data
          if (loadedTrajectories.length > 0) {
            //if (loadedTrajectories.length > 1) throw new Error('Molstar error: There should be only 1 trajectory');
            //console.log('already loaded traj!!');
          }
          // If there is not trajectory yet then create a new trajectory
          else {
            //console.log('loading for the first time');
          }
        };
        wrap();
      }, [molstar, modelReference, topologies, trajectories, comps, noTrajectory]);

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
            data-loading={downloadError || undefined}
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
