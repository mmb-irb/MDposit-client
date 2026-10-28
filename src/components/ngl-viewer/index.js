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
// Hook to download viewer data from the API according to the components configuration
import { useInView } from 'react-intersection-observer';
import { clamp } from 'lodash-es';
import cn from 'classnames';
// About NGL versions
// We are stuck in version 2.0.0-dev.37
// Current versions of NGL do not load trajectory coordinates, starting at version 2.1.0
// I don't know where the problem is, but there are no error logs and I have spent a few hours already
// Previous version 2.0.1 had a bug not showing surfaces and returning "Worker.onerror molsurf"
// This bug starts at version 2.0.0-dev.40, the first one released already minified
// NGL builds its workers by stringifying its own functions, and our build minifier turns one of them anonymous
// The worker script is then invalid JavaScript, so surfaces never show
// The ngl.test.js tests run the real NGL, but they can not catch this since they do not use the build minifier
import {
  autoLoad, Stage, Shape, ColormakerRegistry, Matrix3, Matrix4, Vector3, MouseActions, Selection,
} from 'ngl';

import { frame } from 'timing-functions';

import { setNGLFile, updateNGLFile } from './payload-to-ngl-file';

// Improved 'element' color scheme (distinguishes coarse-grain beads instead of white)
import getElementColorSchemeId from './element-colormaker';

// PDB parser which skips the bond guessing that topology bonds replace anyway
import { PDB_WITH_TOPOLOGY_BONDS } from './pdb-parser-with-topology-bonds';
import {
  getPartialSystem,
  toPartialAtomIndex,
  toWholeAtomIndex,
  toPartialSelection,
  toPartialAtomGroups,
  toPartialColorScheme,
} from './partial-system';

import { ProjectCtx } from '../../contexts';

import { setTooltipPosition } from '../../utils/tooltip-position-manager';
import AtomDescription from '../atom-description';

import { appendBuffer } from '../../utils/auxiliar-functions';

import { interpolateSpeed } from '../../utils/player-speed';

import style from './style.module.css';

// Make a deep copy of an object even with cyclic references
import { cloneDeep } from 'lodash-es';

// Used to just wait
import { sleep } from 'timing-functions';

const DEFAULT_ORIENTATION_TRANSITION_DURATION = 750; // 750 ms

const CHAIN_SELECTION = 'polymer and not hydrogen ';

const isValidColor = colorName => {
  var s = new Option().style;
  s.color = colorName;
  return s.color === colorName;
};

// Set the number of bytes per element in trajectory data
const BYTES_PER_COORDINATE = 4; // float 32
const COORDINATES_PER_ATOM = 3; // x, y and z
const BYTES_PER_ATOM = BYTES_PER_COORDINATE * COORDINATES_PER_ATOM;


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

// Set representation types for the different types of highlights
const defaultHighlightTypes = {
  atoms: 'spacefill',
  residues: 'ball+stick',
  chains: 'ball+stick',
  selections: 'ball+stick',
};

// Edges of a cube with side 1 and one corner at the origin
// This cube is transformed to draw the simulation box
const UNIT_CUBE_EDGES = [
  [[0, 0, 0], [1, 0, 0]], [[0, 0, 0], [0, 1, 0]], [[0, 0, 0], [0, 0, 1]],
  [[1, 1, 0], [0, 1, 0]], [[1, 1, 0], [1, 0, 0]], [[1, 1, 0], [1, 1, 1]],
  [[1, 0, 1], [0, 0, 1]], [[1, 0, 1], [1, 1, 1]], [[1, 0, 1], [1, 0, 0]],
  [[0, 1, 1], [1, 1, 1]], [[0, 1, 1], [0, 0, 1]], [[0, 1, 1], [0, 1, 0]],
];

// Linear interpolation from start (t = 0) to stop (t = 1), as NGL does
const lerp = (start, stop, t) => start + (stop - start) * t;

// Get the centroid of the current coordinates in a NGL structure
const getCentroid = structure => {
  const { x, y, z, count } = structure.atomStore;
  let sx = 0, sy = 0, sz = 0;
  for (let a = 0; a < count; a++) {
    sx += x[a];
    sy += y[a];
    sz += z[a];
  }
  return new Vector3(sx / count, sy / count, sz / count);
};

const NGLViewer = memo(
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
        initialFocus, // The ngl selection to be focused by the camera initially
        darkBackground,
        perspective,
        speed,
        centering,
        xSelection, // To display planes for density analysis
        rotateX,   // To rotate the stage so the Z axis goes from bottom to top
        xAxisStep,
        // Simulation boxes of the loaded frames, to be displayed (see useBoxData)
        boxes,
        // Final components and representations prepared for the viewer
        components,
        representations,
        // Viewer data incluting both structure and coordinates
        topologies,
        trajectories,
        anyLoadingTopology,
        anyLoadingTrajectory,
        // Message of a failed topology or trajectory download, if any
        downloadError,
        // Set the highlight representations types
        highlightTypes = defaultHighlightTypes,
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

      // Set the curated orientation in NGL format
      const curatedOrientation = useMemo(() => {
        // If we do not have metadata yet then stop
        if (!metadata) return;
        const ori = metadata.ORIENTATION;
        // If no curated orientation is set in metadata then stop
        if (!ori) return;
        // The matrix 4 resorts values in the input list
        // In order to make it match the original focus display we must sort them before
        const sortedOrientation = [
          ori[0], ori[4], ori[8], ori[12],
          ori[1], ori[5], ori[9], ori[13],
          ori[2], ori[6], ori[10], ori[14],
          ori[3], ori[7], ori[11], ori[15],
        ];
        return new Matrix4().set(...sortedOrientation);
      }, [metadata])

      // Save the main component once it is staged
      // This components is used by several functions
      const [mainComponent, setMainComponent] = useState(null);
      const [mainNglFile, setMainNglFile] = useState(null);
      // The last automatic camera focus
      const [focus, setFocus] = useState(initialFocus);
      // Set the initial focus
      useEffect(() => {
        //console.log(initialFocus);
        setFocus(initialFocus);
      }, [initialFocus]);
      // Keep the initial focus also as a reference to recover it without triggering hooks
      const initialFocusRef = useRef(initialFocus);
      initialFocusRef.current = initialFocus;

      // references
      const containerRef = useRef(null);
      const stageRef = useRef(null);
      const tooltipRef = useRef(null);
      const firstTime = useRef(true);

      // in-view hook
      const [inViewRef, isInView] = useInView();

      // Set the content of the tooltip in JSX format
      const [tooltipContent, setTooltipContent] = useState(null);

      // Set the NGL parsed topologies
      const [ parsedTopologies, setParsedTopologies ] = useState([]);
      // Store the URLs of those topologies already started to be parsed
      // This is to avoid processing twice the same topology
      // Note that the processing is async, so we can not rely in the parsedTopologies state
      // A topology may be parsing and not be included in this state yet for a brief moment
      const alreadyParsedTopologies = useRef(new Set());
      // Update the parsed topologies every time the downloaded topologies change
      useEffect(() => {
        // Wait for the main topology to know if NGL bonds are to be replaced by topology bonds
        if (!topologyManager) return;
        // Iterate downloaded topologies
        topologies.forEach(topology => {
          // If the topology still has not the data then skip it
          if (!topology.file) return;
          // If the topology is already among the parsed topologies then skip it
          if (topology.url in alreadyParsedTopologies.current) return;
          alreadyParsedTopologies.current.add(topology.url);
          // Parse the structure to a NGL file
          const stringBlob = new Blob( [ topology.file ], { type: 'text/plain'} );
          const ext = topologyManager.atomBonds ? PDB_WITH_TOPOLOGY_BONDS : 'pdb';
          autoLoad(stringBlob, { defaultRepresentation: false, ext })
            // Once the parse has been completed update the parsed topologies state
            .then(prasedFile => {
              // Copy the content of the topology object
              const newParsedTopology = { ...topology };
              // Replace the original file by the parsed file
              newParsedTopology.file = prasedFile;
              // Now push it to the parsed topologies
              setParsedTopologies(previous => [...previous, newParsedTopology]);
            })
            // If there is any problem then log it to the console
            .catch(error => { console.error(error) });
        });
        setParsedTopologies(previousParsedTopologies => {
          // Set a new array to trigger the render when setting the new state
          const newParsedTopologies = [ ...previousParsedTopologies ];
          return newParsedTopologies;
        });
      }, [topologies, topologyManager]);

      // Set a state to keep track of the current working tasks in the viewer
      // This is useful to update the upper left corner logs in the viewer
      const [runningTasks, setRunningTasks] = useState(0);

      // Update the running tasks count
      const handleTasksChange = useCallback(
        value => {
          setRunningTasks(current => current + value);
        },
        [setRunningTasks],
      );

      // Stage creation and removal on mounting and unmounting
      useEffect(() => {
        // set-up
        // NGL defaults its background to black, which would be painted for a
        // frame or two before the background effect below gets a chance to run
        const stage = new Stage(containerRef.current, {
          backgroundColor: darkBackground ? 'black' : 'white',
        });
        // wait for a render to screen, then
        frame().then(() => {
          if (!stage) return;
          // make sure NGL knows the size it has available
          stage.handleResize();
        });
        // Set a signal function to handle the update of running tasks count
        stage.tasks.signals.countChanged.add(handleTasksChange);
        // Save the stage reference
        stageRef.current = stage;
        // clean-up
        return () => {
          // NOTE: following line causes to fail when loading a new viewer with
          // NOTE: previous structure data
          // stageRef.current.removeAllComponents();
          stage.dispose();
          // NGL dispose (2.0.0-dev.37) leaves the viewer render loop and the mouse observer loop running forever
          // Both loops request their next frame through these methods, so replacing them ends the loops
          stage.viewer.animate = () => {};
          stage.mouseObserver._listen = () => {};
          // It does not remove the mouse observer listeners from the document either
          // These listeners would keep the whole stage alive
          stage.mouseObserver.dispose();
          // Nor does it release the WebGL context
          // Browsers limit live contexts, so every remount would cost one more until garbage collected
          stage.viewer.renderer.forceContextLoss();
          stageRef.current = null;
        };
      }, []);

      // Handle the upper left corner viewer logs
      const viewerLogs = useMemo(() => {
        if (downloadError) return downloadError;
        if (!topologyManager) return 'Waiting for the main topology';
        if (!mainComponent) return `Waiting for the main component`;
        if (!trajectories.length && !noTrajectory)
          return `No trajectory available`;
        if (runningTasks > 0) return `Rendering...`;
        return undefined; // Show nothing when everything was finished and fine
      }, [
        downloadError,
        mainComponent,
        trajectories,
        noTrajectory,
        runningTasks,
      ]);

      // background (with transition)
      useEffect(() => {
        const beginning = Date.now();
        let duration = 1000;
        // The very first background is already set in the Stage parameters
        // Do not animate it, or we would wait a frame before painting it
        if (firstTime.current) {
          firstTime.current = false;
          return;
        }
        (async () => {
          while (true) {
            await frame(); // async, should check if we still have the viewer
            if (!stageRef.current) return;
            let currentTick = Date.now() - beginning;
            // exit condition from 'while (true)' loop
            // if we've gone over the full time of the animation
            if (currentTick > duration) break;
            if (darkBackground) currentTick = duration - currentTick;
            const color = `#${Math.round((currentTick * 0xff) / duration)
              .toString('16')
              .padStart(2, '0')
              .repeat(3)}`;
            stageRef.current.viewer.setBackground(color);
          }
          await frame(); // async, should check if we still have the viewer
          if (!stageRef.current) return;
          // make sure we're set to the final colour
          // (in case the transition was stopped halfway through)
          stageRef.current.viewer.setBackground(
            darkBackground ? 'black' : 'white',
          );
        })();
        // set duration to 0 to cancel possibly ongoing loop
        return () => (duration = 0);
      }, [darkBackground]);

      // perspective
      useEffect(() => {
        stageRef.current &&
          stageRef.current.viewer &&
          stageRef.current.viewer.setCamera &&
          stageRef.current.viewer.setCamera(
            perspective ? 'perspective' : 'orthographic',
          );
      }, [perspective]);

      // frames
      // Update the controls progress
      useEffect(() => {
        // Check if we are prepared to add the frame change handler and if t is required
        if (!onProgress || noTrajectory || !mainNglFile) return;
        // Get the frame count of the final number of frames (once the whole trajectory is loaded)
        const frameCount = mainNglFile.expectedFrames;
        // Set the actual function to handle frame change internally in the component
        const frameHandler = frame => {
          //console.log('NGL frameCount: ' + frameCount);
          const progress = clamp(frame / (frameCount - 1), 0, 1);
          onProgress(progress);
        };
        // Add the frame handler to the component signals
        mainNglFile.signals.frameChanged.add(frameHandler);
        // Set a cleanup function to remove the frame handler when there is need
        return () => {
          mainNglFile.signals.frameChanged.remove(frameHandler);
        };
      }, [mainNglFile, noTrajectory, onProgress]);

      // DEV-ONLY: measure the actual playback framerate, shown in a small on-screen badge so the
      // 'speed' slider's effect can be visually verified. Kept independent from the onProgress
      // effect above since onProgress may not be passed. Stripped in production builds since
      // import.meta.env.DEV is statically known then, so this whole effect is dead-code-eliminated
      const [debugFps, setDebugFps] = useState(0);
      useEffect(() => {
        if (!import.meta.env.DEV) return;
        if (noTrajectory || !mainNglFile) return;
        const frameTimes = [];
        const frameHandler = () => {
          const now = Date.now();
          frameTimes.push(now);
          if (frameTimes.length > 10) frameTimes.shift();
          if (frameTimes.length < 2) return;
          const elapsedSeconds = (frameTimes[frameTimes.length - 1] - frameTimes[0]) / 1000;
          if (elapsedSeconds <= 0) return;
          setDebugFps((frameTimes.length - 1) / elapsedSeconds);
        };
        mainNglFile.signals.frameChanged.add(frameHandler);
        return () => {
          mainNglFile.signals.frameChanged.remove(frameHandler);
        };
      }, [mainNglFile, noTrajectory]);

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

      // PDB file, base structure
      // Set the representations in each component
      useEffect(() => {
        if (!components || !representations || !topologyManager) return;
        components.forEach((comp, c) => {
          // Set the NGL component
          let stageComp = stageRef.current.compList.find(stc => stc.myName == comp.name);
          if (!stageComp) {
            // Find the topology which matches the component urlpath
            // If a component has no urlpath it will match a topology with no urlpath: the default topology
            const urlpath = comp.topologyURL || null;
            const topology = parsedTopologies.find(topology => topology.urlpath === urlpath);
            // If the topology has not been loaded yet then we have a problem
            // DANI: Todas las topologías deben estar ya listas antes de cargarlas, lee los mensajes de arriba
            if (!topology) return;
            // Stop here if it is not downloaded yet
            if (topology.error)
              throw new Error(`Topology from '${urlpath}' returned error ${topology.error}`);
            if (!topology.file)
              throw new Error(`Topology data from '${urlpath}' is missing`);
            // Atom occupancy is a field which is not used anywhere but in the electrostatic representation
            // The electrostatic surface scheme color does not work if the occupancy is 0 (ngl code, not ours)
            // We set all occupancies to 1, since some topologies may have all occupancies as 0 by default
            topology.file.atomStore.occupancy = new Array(
              topology.file.atomStore.occupancy.length,
            ).fill(1);
            // Take in count if the topology contains a subset of the atoms
            const partialSystem = getPartialSystem(comp.atomIndices, topologyManager.atomCount);
            // Set atom bonds according to our topology
            let safeBonds = topologyManager.atomBonds;
            if (safeBonds) {
              if (partialSystem) {
                // Convert atom indices in order to adapt safe bonds to the partial system
                safeBonds = partialSystem.wholeIndices.map(
                  atomIndex => safeBonds[atomIndex]
                    .map(bondAtomIndex => toPartialAtomIndex(partialSystem, bondAtomIndex))
                    .filter(bondAtomIndex => bondAtomIndex !== null));
              }
              // Get the NGL internal bonds handler
              const bondStore = topology.file.bondStore;
              // Remove default bonds
              bondStore.length = 0;
              bondStore.count = 0;
              bondStore.atomIndex1 = new Int32Array;
              bondStore.atomIndex2 = new Int32Array;
              bondStore.bondOrder = new Int32Array;
              // Add every bond in the topology
              // Every bond is listed in both of its atoms, so add it only from the lower index atom
              safeBonds.forEach((bondedAtomsIndices, atomIndex) => {
                const atom1 = topology.file.getAtomProxy(atomIndex);
                bondedAtomsIndices.forEach(bondedAtomIndex => {
                  if (bondedAtomIndex < atomIndex) return;
                  const atom2 = topology.file.getAtomProxy(bondedAtomIndex);
                  // The '1' stands for the bond order (idk what this is)
                  bondStore.addBond(atom1, atom2, 1);
                });
              });
            }
            // Add the topology to the NGL
            // The structure object stores data which is component exclusive (e.g. the current frame coordinates)
            // If other components use the same topology then make a deep copy of it to prevent NGL internal bugs
            // Otherwise skip the copy, since it takes ~300 ms in big systems (~95k atoms)
            const isSharedTopology = components.filter(other => (other.topologyURL || null) === urlpath).length > 1;
            const componentObject = isSharedTopology ? cloneDeep(topology.file) : topology.file;
            stageComp = stageRef.current.addComponentFromObject(componentObject);
            stageComp.myName = comp.name;
            if (!stageComp) return;
            stageComp.onlyTopology = comp.onlyTopology;
            // Atom indices from outside are always whole system indices
            // Keep the partial system, if any, to translate them
            stageComp.partialSystem = partialSystem;
            // Keep the structure centroid before any trajectory frame overwrites its coordinates
            // The structure is the first frame, which is used to place the simulation box
            stageComp.structureCentroid = getCentroid(stageComp.structure);
            setMainComponent(stageComp);
            // Set the camera on the first component now, before the first render, so it is not painted off-center
            // The focus effect further does the same, but after a render where the camera is still at the origin
            // Frame the initial focus already if it is in this component, so the camera does not jump to it after
            if (c === 0) {
              if (curatedOrientation) stageRef.current.animationControls.orient(curatedOrientation, 0);
              const initialFocus = initialFocusRef.current;
              stageComp.autoView(initialFocus && !initialFocus.comp
                ? toPartialSelection(partialSystem, initialFocus.sele)
                : '', 0);
            }
          }

          // Get current component representations
          const componentRepresentations = representations.filter(rep => rep.component === comp.name);

          // Set each representation
          // Delete previous representations which are not requested anymore
          const registredNames = [];
          componentRepresentations.forEach((rep, r) => {
            // The name here is used to indetify previous existing representations
            const name = r + '-' + rep.name;
            registredNames.push(name);

            // Adapt a few representation values to the context
            const show = rep.show
            let sele = rep.selection;
            // DANI: This solves a lot of silent and shaddy errors
            // DANI: If you select 'all' or '*' you may see wrong bonding patterns
            // DANI: If there are no bonds and you represent in licorice or ball+stick the NGL may crash
            // DANI: However, if you type a wrong selection then everythin is represented properly
            // DANI: And that is exactly the behaviour we want when we type all, so this is the solution
            if (sele === 'all' || sele === '*') sele = 'patata';
            // In the other hand, if the selection is empty then all would be represented by default
            // A selection should never be empty so if it happens then it is a bug
            // To avoid showing everythin in a buggy representation we set an empty selection as None
            if (sele === '' || sele == null) sele = 'None';
            sele = toPartialSelection(stageComp.partialSystem, sele);
            const type = rep.type
            const color = rep.color;
            const opacity = show ? rep.opacity : 0;

            const customColorScheme = rep.customScheme;

            // If the representation is selected then the color is yellow
            const colorScheme = rep.name === selectedRepresentation
              ? ColormakerRegistry.addSelectionScheme(
                  [['yellow', 'all']],
                  'custom label',
                )
              // If the colorScheme is in the passed custom schemes use it
              : customColorScheme && color === 'custom'
                ? toPartialColorScheme(stageComp.partialSystem, topologyManager, customColorScheme)
                // If the colorScheme is a defined color, create a custom colorScheme for this color
                : isValidColor(color)
                  ? ColormakerRegistry.addSelectionScheme(
                      [[color, 'all']],
                      'custom label',
                    )
                  // Use our improved element scheme so non-standard atom names
                  // (e.g. coarse-grain beads) get distinct colors instead of white
                  : color === 'element'
                    ? getElementColorSchemeId()
                    // Otherwise let the color scheme as it is
                    : color;

            // Set some additional parameters which are to be modified depending on the type
            const colorDomain = type === 'surface' ? [-200, 200] : undefined;
            const surfaceType = type === 'surface' ? 'av' : undefined;
            //const background = type === 'surface' && opacity < 1 ? true : false;
            const depthWrite = type === 'surface' && opacity < 1 ? false : true;

            // Join all parameters into a single input object
            const parameters = {
              sele,
              name,
              opacity,
              colorScheme,
              colorDomain,
              surfaceType,
              side: 'front',
              //background,
              depthWrite,
              //opaqueBack: true,
              //forceTransparent: true,
              ...rep.other,
            };

            // Find the previous representation
            const previousRepresentation = stageComp.reprList.find(
              previous => previous.name === name,
            );

            // Update the previous representation if exists
            if (previousRepresentation) {
              const previousType = previousRepresentation.repr.type;
              const previousSelection =
                previousRepresentation.repr.selection.string;
              // If the 'drawingMethod' has been changed we have to remake the whole representation
              // WARNING: Representations with 'trace' type must be remade always
              // WARNING: Reseting their parameters returns a fatal error. It is an internal NGL bug.
              if (
                previousType !== type ||
                previousSelection !== sele ||
                previousType === 'trace'
              ) {
                stageComp.removeRepresentation(previousRepresentation);
                stageComp.addRepresentation(type, parameters);
              }
              // Otherwise it is faster just to update the parameters
              else {
                previousRepresentation.setParameters(parameters);
              }
            }
            // If there is no previous representation then set a new one
            else {
              stageComp.addRepresentation(type, parameters);
            }

            // Add a floating label over the representation when it is specified
            const label = rep.label;
            if (label) {
              const labelName = rep.label + '-' + name;
              // Find the equivalent previous label
              const previous = stageComp.annotationList.find(
                annotation => annotation.name === labelName,
              );
              //console.log(previous);
              // If the representation is shown
              if (show) {
                // If there is a previous representation then just update the label
                // The rest should be always the same
                if (previous) {
                  previous.element.label = rep.label;
                }
                // If there is not previous label then set it
                else {
                  var elm = document.createElement('div');
                  elm.innerText = rep.label;
                  elm.style.color = '#76FF03';
                  elm.style.backgroundColor = '#607D8B';
                  elm.style.padding = '8px';
                  // get the geometrical center of the representation
                  const center = stageComp.reprList[r].repr.structureView.center;
                  const annotation = stageComp.addAnnotation(center, elm);
                  annotation.name = labelName;
                }
              }
              // If the representation is hidden
              else {
                // If there is a previous representation then remove it
                if (previous) {
                  stageComp.removeAnnotation(previous);
                }
              }
            }

            // Set this representation as the focus if it is selected
            if (rep.name === selectedRepresentation) {
              setFocus({ comp: c, sele: rep.selection });
              //focused = true;
            }
          });

          // Delete all representations which are not required anymore
          // WARNING: It is very important to save apart the stageComp.reprList
          // WARNING: Do not iterate over stageComp.reprList while removing representations
          // WARNING: If so, representations would jump of index in the list
          const previousRepresentations = [...stageComp.reprList];
          previousRepresentations.forEach(rep => {
            const name = rep.name;
            // Representations with name starting with '*' are never removed by this way
            // Those representations are automatic highlights
            if (name.charAt(0) === '*') return;
            for (const registredName of registredNames) {
              if (name === registredName) return;
            }
            // If the name is not in the list the representation must be removed
            stageComp.removeRepresentation(rep);
          });

          // If nothing has been focused at the end then focus the whole first component
          setFocus(previous => {
            if (previous) return previous; // This will not trigger any rerender
            return { comp: 0, sele: 'all' };
          });
        });
      }, [
        components,
        representations,
        parsedTopologies,
        selectedRepresentation,
        setMainComponent,
        topologyManager,
        curatedOrientation,
      ]);

      // Highlight specific atoms
      useEffect(() => {
        if (!topologyManager) return;
        // DANI: He tenido que quitar la condicion de 'instanceof Set' porque sino no me entraba en el heatmap
        //if (!(selectedAtoms instanceof Set) || !selectedAtoms) {
        if (!mainComponent || !selectedAtoms) return;

        // Set a representation name
        // This is useful to find previous representations in further renders
        const nameHighlight = '*highlightedAtoms';
        const previousHighlightRepresentation = mainComponent.reprList.find(
          representation => representation.name === nameHighlight,
        );
        if (previousHighlightRepresentation) {
          mainComponent.removeRepresentation(
            previousHighlightRepresentation,
          );
        }

        // Name for residues representation
        const nameContextHighlight = '*highlightedAtomResidues';
        const previousContextRepresentation = mainComponent.reprList.find(
          representation => representation.name === nameContextHighlight,
        );
        if (previousContextRepresentation) {
          mainComponent.removeRepresentation(
            previousContextRepresentation,
          );
        }

        const atoms = Array.from(selectedAtoms);
        if (!atoms.length) return;

        // ngl starts counting at 0
        const seleHighlight = `@${atoms.map(atomIndex => atomIndex).join(',')}`;

        mainComponent.addRepresentation(highlightTypes.atoms, {
          sele: toPartialSelection(mainComponent.partialSystem, seleHighlight),
          opacity: 0.5,
          scale: 1.5,
          name: nameHighlight,
          // The enlarged highlight must not hide nearby atoms from mouse clicks
          disablePicking: true,
        });

        const otherResidueAtomsSelection = Array.from(
          new Set(
            // 'atoms' are in abolsute numeration
            atoms.map(atomIndex => {
              const atom = topologyManager.getAtomByIndex(atomIndex);
              const atomIndices = atom.residue.atomIndices;
              const nglAtomSelection = '@' + atomIndices.join(',');
              return nglAtomSelection;
            }),
          ),
        ).join(' or ');

        mainComponent.addRepresentation(
          highlightTypes.residues,
          {
            sele: toPartialSelection(mainComponent.partialSystem, otherResidueAtomsSelection),
            name: nameContextHighlight,
          },
        );

        // Focus the highlighted zone with the camera
        setFocus({ comp: 0, sele: otherResidueAtomsSelection });
      }, [
        mainComponent,
        topologyManager,
        selectedAtoms,
        darkBackground,
        highlightTypes,
      ]);

      // Highlight specific residues
      useEffect(() => {
        if (!topologyManager || !mainComponent || !selectedResidueIndices) return;
        // Set a representation name. This is useful to find this representation further
        const nameHighlight = '*highlightedResidues';
        const previousHighlightRepresentation = mainComponent.reprList.find(
          representation => representation.name === nameHighlight,
        );
        if (previousHighlightRepresentation)
        mainComponent.removeRepresentation(
            previousHighlightRepresentation,
          );
        // If there are no selected residues at all we stop here
        if (selectedResidueIndices.length === 0) return;
        // Get the residues input
        const residueNglSelections = selectedResidueIndices.map(
          residueIndex =>
            topologyManager.getResidueByIndex(residueIndex).nglSelection,
        );
        // Transform the residues list into an NGL selection
        const overallNglSelection = Array.from(
          new Set(residueNglSelections),
        ).join(' or ');
        // Represent the previous selection in ball+sticks drawing method
        mainComponent.addRepresentation(
          highlightTypes.residues,
          {
            sele: overallNglSelection,
            name: nameHighlight,
          },
        );

        // Focus the highlighted zone with the camera
        setFocus({ comp: 0, sele: overallNglSelection });
      }, [
        mainComponent,
        selectedResidueIndices,
        topologyManager,
        highlightTypes,
      ]);

      // Highlight specific chains
      // DANI: NO Probado
      useEffect(() => {
        if (!mainComponent || !selectedChains) return;
        // Set a representation name. This is useful to find this representation further
        const nameHighlight = '*highlightedChains';
        const previousHighlightRepresentation = mainComponent.reprList.find(
          representation => representation.name === nameHighlight,
        );
        if (previousHighlightRepresentation)
        mainComponent.removeRepresentation(
            previousHighlightRepresentation,
          );

        // Get the residues input
        const chains = selectedChains.map(c => ':' + c);
        if (!chains.length) return;
        // Transform the residues list into an NGL selection
        const nglSelection = Array.from(new Set(chains)).join(' or ');

        // Represent the previous selection in ball+sticks drawing method
        mainComponent.addRepresentation(highlightTypes.chains, {
          sele: nglSelection,
          name: nameHighlight,
        });
        // Focus the highlighted zone with the camera
        setFocus({ comp: 0, sele: nglSelection });
      }, [mainComponent, selectedChains, highlightTypes]);

      // Highlight specific free NGL selections
      useEffect(() => {
        if (!mainComponent || !snapRepresentations) return;
        const currentRepresentations = mainComponent.reprList;
        snapRepresentations.forEach(snapRepresentation => {
          mainComponent.addRepresentation(snapRepresentation.type, {
            sele: toPartialSelection(mainComponent.partialSystem, snapRepresentation.selection),
            name: snapRepresentation.name,
            color: snapRepresentation.color,
            opacity: snapRepresentation.opacity,
          });
        });
        return () => {
          snapRepresentations.forEach(snapRepresentation => {
            // Find if the current snap representation already exists by its name
            const previousSnapRepresentation = currentRepresentations.find(
              currentRepresentation =>
                currentRepresentation.name === snapRepresentation.name,
            );
            // If so, remove it
            if (previousSnapRepresentation)
            mainComponent.removeRepresentation(previousSnapRepresentation);
          });
        };
      }, [mainComponent, snapRepresentations]);

      // Add specific NGL representations which are added or removed apart from the main component
      // They are faster to update but they are not shown in the representations manager
      useEffect(() => {
        if (!mainComponent || !selectedCustom) return;
        // Set a representation name. This is useful to find this representation further
        const nameHighlight = '*highlightedCustom';
        const previousHighlightRepresentation = mainComponent.reprList.find(
          representation => representation.name === nameHighlight,
        );
        if (previousHighlightRepresentation)
        mainComponent.removeRepresentation(
            previousHighlightRepresentation,
          );

        if (!selectedCustom.length) return;
        // Transform the residues list into an NGL selection
        const nglSelection = Array.from(new Set(selectedCustom)).join(' or ');

        // Represent the previous selection in ball+sticks drawing method
        mainComponent.addRepresentation(
          highlightTypes.selections,
          {
            sele: toPartialSelection(mainComponent.partialSystem, nglSelection),
            name: nameHighlight,
          },
        );
        // Focus the highlighted zone with the camera
        setFocus({ comp: 0, sele: nglSelection });
      }, [mainComponent, selectedCustom, highlightTypes]);

      // Highlight specific distances
      // When 'selectedDistances' is numeric it is taken as atoms
      // When 'selectedDistances' is string it is taken as residues
      // In both cases it works with residue indices
      useEffect(() => {
        if (!mainComponent || !selectedDistances) return;
        // Set a representation name. This is useful to find this representation further
        const name = '*distance';
        const previousRepresentation = mainComponent.reprList.find(
          representation => representation.name === name,
        );
        // Remove the previous representation
        if (previousRepresentation)
        mainComponent.removeRepresentation(
            previousRepresentation,
          );

        // Display the new distance representation
        mainComponent.addRepresentation('distance', {
          atomPair: toPartialAtomGroups(mainComponent.partialSystem, selectedDistances),
          color: 'skyblue',
          labelUnit: 'angstrom',
          name: name,
          // Label color is the opposite of the background color
          labelColor: darkBackground ? 16777215 : 1, // 16777215 is white, 1 is black
        });
      }, [mainComponent, selectedDistances, darkBackground]);
      
      // Display a plane
      useEffect(() => {
        if (!mainComponent || !xSelection) return;
        // Set a representation name. This is useful to find this representation further
        const name = '*density';
        const previousComponent= stageRef.current.compList.find(
          component => component  .name === name,
        );
        // Remove the previous representation
        if (previousComponent)
          stageRef.current.removeComponent(
            previousComponent,
          );
        else {
          stageRef.current.viewer.rotationGroup.rotateY(-1.6);
        };
        var shape = new Shape("shape", {radialSegments: 10 });
        const boxCenter = mainComponent.object.center;
        const bBox = mainComponent.object.boundingBox;
        shape.addBox(
          [boxCenter.x, boxCenter.y, xSelection*xAxisStep - xAxisStep/2], 
          [0, 0, 0], 
          bBox.max.x - bBox.min.x, 
          [0, bBox.max.y - bBox.min.y, 0], 
          [0, 0, 0.01]
        );
        shape.addBox(
          [boxCenter.x, boxCenter.y, xSelection*xAxisStep + xAxisStep/2], 
          [0, 0, 0], 
          bBox.max.x - bBox.min.x, 
          [0, bBox.max.y - bBox.min.y, 0], 
          [0, 0, -0.01]
        );
        var shapeComp = stageRef.current.addComponentFromObject(shape, {name: name});
        var rep = shapeComp.addRepresentation("buffer", {opacity: 0.1 , roughness: 1});
        // console.log(stageRef.current.viewer.rotationGroup.rotation);
      }, [mainComponent, xSelection]);
      
      // Display the simulation box
      // The box is drawn once as a unit cube, which is then transformed to the box of the current frame
      useEffect(() => {
        if (!mainComponent || !boxes) return;
        const name = '*box';
        const shape = new Shape(name);
        const color = darkBackground ? [0.8, 0.8, 0.8] : [0.3, 0.3, 0.3];
        UNIT_CUBE_EDGES.forEach(([from, to]) => shape.addWideline(from, to, color));
        const boxComponent = stageRef.current.addComponentFromObject(shape, { name });
        boxComponent.addRepresentation('buffer', { linewidth: 2, disablePicking: true });
        // Boxes have no origin, as in Gromacs, since periodic images do not depend on it
        // Then we place the box where the original box would be: around the imaged system
        // Fitted coordinates are the original coordinates rotated (R) and translated
        // Then the fitted origin is the fitted centroid minus the original centroid rotated
        // The original centroid is unknown, so we use the centroid of the first frame (i.e. the structure)
        // Note that the first frame is the fit reference, so it is not modified by the fit
        // Boxes are rotated as coordinates were rotated by the fit, so R = B1^-1 Bf
        // WARNING: Use NGL math classes, since NGL uses an old three version (e.g. there is no Matrix3.invert)
        const trajectory = mainComponent.trajList[0] && mainComponent.trajList[0].trajectory;
        const firstCentroid = mainComponent.structureCentroid;
        // Box vectors are rows (a, b, c), so transpose them to have them as columns
        const reference = new Matrix3().set(...boxes.reference).transpose();
        const referenceInverse = new Matrix3().getInverse(reference, true);
        const getVectors = frame => boxes.boxes.subarray(frame * 9, (frame + 1) * 9);
        // The player interpolates coordinates between frames, but the frame change signal only passes the frame
        // Wrap the trajectory interpolation to know the previous frame and the interpolation step too
        // Atoms are interpolated linearly from the previous frame (ip) to the frame (i), so are box vectors
        // NOTE: The player only uses linear interpolation (see the smooth effect), never splines
        let interpolation = null;
        const originalInterpolate = trajectory && trajectory._interpolate;
        if (trajectory) trajectory._interpolate = (i, ip, ipp, ippp, t, type) => {
          interpolation = { previousFrame: ip, step: t };
          originalInterpolate.call(trajectory, i, ip, ipp, ippp, t, type);
          interpolation = null;
        };
        const updateBox = frame => {
          const vectors = interpolation
            ? getVectors(frame).map((value, v) =>
              lerp(getVectors(interpolation.previousFrame)[v], value, interpolation.step))
            : getVectors(frame);
          const box = new Matrix3().set(...vectors).transpose();
          const rotation = box.multiply(referenceInverse);
          const centroid = getCentroid(mainComponent.structure);
          const origin = firstCentroid.clone().applyMatrix3(rotation).negate().add(centroid);
          // Transform the unit cube: x = origin + u·a + v·b + w·c
          boxComponent.setTransform(new Matrix4().set(
            vectors[0], vectors[3], vectors[6], origin.x,
            vectors[1], vectors[4], vectors[7], origin.y,
            vectors[2], vectors[5], vectors[8], origin.z,
            0, 0, 0, 1,
          ));
        };
        updateBox(trajectory ? Math.max(trajectory.currentFrame, 0) : 0);
        if (trajectory) trajectory.signals.frameChanged.add(updateBox);
        return () => {
          if (trajectory) {
            trajectory.signals.frameChanged.remove(updateBox);
            trajectory._interpolate = originalInterpolate;
          }
          if (stageRef.current) stageRef.current.removeComponent(boxComponent);
        };
      }, [mainComponent, mainNglFile, boxes, darkBackground]);

      // Rotate the stage
      useEffect(() => {
        if (!mainComponent || !rotateX) return;
        stageRef.current.viewer.rotationGroup.rotateX(-1.57);
      }, [mainComponent, rotateX]);

      // Highlight specific angles
      useEffect(() => {
        if (!mainComponent || !selectedAngles) return;
        // Set a representation name. This is useful to find this representation further
        const name = '*angles';
        const previousRepresentation = mainComponent.reprList.find(
          representation => representation.name === name,
        );
        if (previousRepresentation)
        mainComponent.removeRepresentation(
            previousRepresentation,
          );

        mainComponent.addRepresentation('angle', {
          atomTriple: toPartialAtomGroups(mainComponent.partialSystem, selectedAngles),
          name: name,
          labelColor: darkBackground ? 16777215 : 1, // 16777215 is white, 1 is black
        });
      }, [mainComponent, selectedAngles, darkBackground]);

      // DCD file, trajectory
      // Once the trajectories are downloaded, load them in corresponding NGL representations
      // Every time the trajectory payloads change this useEffect must be rerun
      useEffect(() => {
        // Check if trajectories are
        if (parsedTopologies.length === 0 || trajectories.length === 0 || !components) return;
        components.forEach((comp, c) => {
          // Find the topology which matches the component urlpath
          // If a component has no urlpath it will match a topology with no urlpath: the default topology
          const topologyUrlpath = comp.topologyURL || null;
          const topology = parsedTopologies.find(topology => topology.urlpath === topologyUrlpath);
          if (!topology) return;

          // DANI: Aquí me he quedado
          // DANI: Con la linea de arriba funciona (a veces) con la de abajo no funciona cuando yo pensaba que funcionaría
          // DANI: Si sigues tirando del hilo se puede hacer que las topologías vayan cargando a medida que llegan
          // DANI: y no todas de golpe al final
          //const stageComp = stageRef.current.compList[c];
          const stageComp = stageRef.current.compList.find(stc => stc.myName == comp.name);

          // Wait if the topology has not been loaded yet
          if (!stageComp) return;
          // Abort if the component is marked as 'only topology'
          if (comp.onlyTopology) return;
          // Find the trajectory payload from the component urls and join them
          const trajectoryPayloads = [];
          // Save the combined urls of all trajectories and their lengths
          // This is used in further renders to know if current trajectory is new or the same
          let combinedURL = '';
          let combinedProgress = '';
          // Record also the atoms for each trajectory and check that they match
          let trajectoryAtoms;
          let trajectoryFinalExpectedFrames = 0;
          // Record also the frames for each trajectory and add them
          for (const framedUrlpath of comp.framedURLs) {
            const trajectory = trajectories.find(trajectory => trajectory.urlpath === framedUrlpath);
            // If the trajectory is not downloaded yet then exit
            if (!trajectory) return;
            // Get atom counts from different trajectories and check they match
            // If the trajectory has no atom count then read it from the already-parsed structure
            // This may happen when we request coordinates using resindices or chaindices
            if (!trajectoryAtoms) trajectoryAtoms = trajectory.atoms || topology.file.atomStore.count;
            if (trajectoryAtoms !== (trajectory.atoms || topology.file.atomStore.count))
              throw new Error( `Atoms number in the different trajectories do not match`);
            // Add the final expected frames for all frames in the component
            trajectoryFinalExpectedFrames += trajectory.frames;
            // Add the main data to the array of payloads
            // Substract data from not completed frames
            // The payload buffer is shared with the download so it is not copied here
            const payload = trajectory.payload;
            const bytesPerFrame = trajectoryAtoms * BYTES_PER_ATOM;
            const fitLength = Math.floor(trajectory.loadedBytes / bytesPerFrame) * bytesPerFrame;
            trajectoryPayloads.push({ payload, fitLength });
            combinedURL += trajectory.url;
            combinedProgress += '/' + fitLength;
          }

          // Check if we are loading the same trajectory than before
          const sameTrajectory = stageComp.combinedURL === combinedURL;

          // If we are loading a different trajectory then remove all possibly already existing trajectories
          // This return an error in console: "updateStructure: traj disposed"
          // This may be a bug but it is actually working
          // See https://github.com/arose/ngl/issues/680
          if (!sameTrajectory)
            stageComp.trajList.forEach(
              stageComp.removeTrajectory.bind(stageComp),
            );

          // If both URL and progress are matching then exit here
          if (sameTrajectory && stageComp.combinedProgress === combinedProgress)
            return;

          // Save current URL in the staged component
          stageComp.combinedURL = combinedURL;
          stageComp.combinedProgress = combinedProgress;

          // Join all payloads into a single trajectory
          // Only the first 'totalBytes' bytes of the total payload are whole downloaded frames
          let totalPayload;
          let totalBytes;
          if (trajectoryPayloads.length === 0) return;
          else if (trajectoryPayloads.length === 1) {
            totalPayload = trajectoryPayloads[0].payload;
            totalBytes = trajectoryPayloads[0].fitLength;
          }
          // DANI: Esto no está bien ahora que hay streaming
          // DANI: Si hubiese dos trayectorias combinadas sus frames quedarían entrelazadas
          // DANI: Pero las trayectorias combinadas no se usan, así que no me merece la pena mantenerlo
          else {
            totalPayload = trajectoryPayloads
              .map(({ payload, fitLength }) => payload.slice(0, fitLength))
              .reduce((cb, nb) => appendBuffer(cb, nb));
            totalBytes = totalPayload.byteLength;
          }
          // If the total payload is empty then stop here
          if (totalBytes === 0) return;
          // Calculate how many frames are there in total
          const bytesPerFrame = trajectoryAtoms * BYTES_PER_ATOM;
          const totalFrames = totalBytes / bytesPerFrame;
          const lastFrameIndex = totalFrames - 1;
          // Check if all required data is already downloaded
          const completedTrajectory =
            totalFrames === trajectoryFinalExpectedFrames;

          // Get the atom indices whom the trajectory coordinates belong to, in case it is passed
          const trajectoryAtomIndices = comp.atomIndices;

          // Make sure the number of atoms is as expected
          if (trajectoryAtomIndices && trajectoryAtomIndices.length !== trajectoryAtoms)
            throw new Error('Unexpected number of trajectory atoms');

          // If centering was requested then get the indices of the atoms to center the trajectory around
          let centeringAtomIndices = null;
          if (centering) {
            const partialCentering = toPartialSelection(stageComp.partialSystem, centering);
            centeringAtomIndices = topology.file.getAtomIndices(new Selection(partialCentering));
            if (centeringAtomIndices.length === 0)
              throw new Error(`Centering selection "${centering}" matches no atoms`);
          }

          // Get the current NGL loaded trajectories
          const compTrajectories = stageComp.trajList;

          // If there is a trajectory already update it with new data
          if (compTrajectories.length > 0) {
            // There must be only one trajectory
            if (compTrajectories.length > 1)
              throw new Error(`Multiple trajectories in one component`);
            const nglFile = compTrajectories[0];
            const nglTrajectory = nglFile.trajectory;
            updateNGLFile(
              nglTrajectory,
              topology.file,
              totalPayload,
              trajectoryAtoms,
              totalFrames,
              trajectoryAtomIndices,
              centeringAtomIndices,
            );
            // Adjust some parameters after the trajectory data has been changed
            nglTrajectory._frameCount = totalFrames;
            if (c === 0) {
              // Save the expected frames number here in the NGL file
              // This is further use by the frame change handler
              nglFile.expectedFrames = trajectoryFinalExpectedFrames;
              const nglPlayer = nglTrajectory.player;
              // Set animation player parameters
              const timeout = interpolateSpeed(speed);
              nglPlayer.setParameters({
                end: lastFrameIndex,
                interpolateStep: 100 / trajectoryFinalExpectedFrames, // This must be set every time
                mode: completedTrajectory ? 'loop' : 'once',
                timeout: timeout,
              });
              // If the trajectory was paused because it had no more frames to load then resume it
              if (!noTrajectory && playing && !nglPlayer.isRunning) {
                const currentFrame = nglTrajectory._currentFrame;
                const endingFrame = lastFrameIndex;
                if (currentFrame < endingFrame) nglPlayer.play();
              }
            }
          }
          // If there is not trajectory yet then create a new NGL trajectory
          else {
            // Transform the binary trajectory data to an NGL friendly format
            const file = setNGLFile(
              topology.file,
              totalPayload,
              trajectoryAtoms,
              totalFrames,
              trajectoryAtomIndices,
              centeringAtomIndices,
            );
            if (!file) return;
            const nglFile = stageComp.addTrajectory(file);
            const nglTrajectory = nglFile.trajectory;
            // Add the frame change handler only if it is the main component
            if (c === 0) {
              // Save the expected frames number here in the NGL file
              // This is further use by the frame change handler
              nglFile.expectedFrames = trajectoryFinalExpectedFrames;
              // Set animation player parameters
              const timeout = interpolateSpeed(speed);
              nglTrajectory.player.setParameters({
                interpolateStep: 100 / trajectoryFinalExpectedFrames,
                mode: completedTrajectory ? 'loop' : 'once',
                timeout: timeout,
              });
              // Update the main NGL file
              setMainNglFile(nglFile);
            }
            // Set trajectory frame
            nglTrajectory.setFrame(0);
          }
          // If the trajectory is to be centered then refocus now
          // Otherwise we may loose the structure from outside the view of the camera
          // Keep the initial focus if any, but set a new object so the focus is triggered again
          if (centering) {
            const initialFocus = initialFocusRef.current;
            setFocus(initialFocus ? { ...initialFocus } : { comp: 0, sele: 'all' });
          }
        });
      }, [
        parsedTopologies,
        trajectories,
        components,
        noTrajectory,
        setMainNglFile,
        setFocus,
        centering,
        // This playing here is just to avoid the warning
        // I can't disable the warning with "// eslint-disable-line react-hooks/exhaustive-deps"
        // This is because the automatic formatter puts the warning one line down because it is stupid
        // Anyway the warning is also stupid, because using the playing as dependency is counterproductive
        // To sum up: when eslint gets smarter and stops complaining you can remove playing from dependencies
        playing,
        // It is the same with the speed that with the playing
        speed,
      ]);

      // Add a signaled handler to the main NGl file, which contains the mian trajectory
      useEffect(() => {
        // Set a function to make the trajectory never stop at any interpolation step
        // If it is stopped in the middle of an interpolation then jump to the next frame
        if (!mainNglFile) return;
        const nglTrajectory = mainNglFile.trajectory;
        const goToNextFrame = () => {
          const currentFrame = nglTrajectory._currentFrame;
          nglTrajectory.setFrame(currentFrame);
        };
        nglTrajectory.player.signals.haltedRunning.add(goToNextFrame);
        // Removing NGL without removing signals from the trajectory player is fatal
        // This raises the error "Uncaught TypeError: this._bindings is undefined"
        // Set a cleanup function to prevent fatal errors
        return () => {
          nglTrajectory.player.signals.haltedRunning.remove(goToNextFrame);
        }
      }, [mainNglFile]);

      // play/pause
      useEffect(() => {
        if (!mainNglFile) return;
        const { player } = mainNglFile.trajectory;
        player.setParameters({
          // Set the interpolate step according to the total number of frames to show 1 by 1
          interpolateStep: 100 / mainNglFile.trajectory.frameCount,
          // Set the animation to go forward and then backward instead of restart if required
          direction: bounce ? 'bounce' : 'forward',
        });
        // WARNING: Pausing the player when there is no trajectory may seem redundant
        // However, if not paused, the surface representations never stop to be calculated
        if (noTrajectory) player.pause();
        else player[playing && isInView ? 'play' : 'pause']();
        // Removing NGL while the animation is playing is fatal
        // This raises the error "Uncaught TypeError: this._bindings is undefined"
        // Set a cleanup function to prevent fatal errors
        return () => player.pause();
      }, [
        mainNglFile,
        playing,
        isInView,
        noTrajectory,
        bounce,
      ]);

      // Handle the speed
      // The speed is also self-regulated by NGL
      // If the topology is too big to reach the required speed it will work as fast as possible
      useEffect(() => {
        // Get the current trajectory
        if (!mainComponent) return;
        const nglFile = mainComponent.trajList[0];
        if (!nglFile) return;
        // Set the player speed
        // The 'speed' input ranges from 0 to 100
        // The NGL 'timeout' parameter stands from the time to wait before moving to the next frame in miliseconds
        //const timeout = 500 / (Math.log2(speed + 1) + 1);
        const timeout = interpolateSpeed(speed);
        nglFile.trajectory.player.setParameters({ timeout: timeout });
      }, [mainComponent, speed]);

      // spinning
      useEffect(() => {
        if (
          stageRef.current &&
          stageRef.current.spinAnimation &&
          spinning === stageRef.current.spinAnimation.paused
        ) {
          stageRef.current.toggleSpin();
        }
      }, [spinning]);

      // smoothing, player interpolation
      useEffect(() => {
        if (!mainNglFile) return;
        mainNglFile.trajectory.player.parameters.interpolateType = smooth ? 'linear' : '';
      }, [mainNglFile, smooth]);

      // to avoid sometimes when it's not rendering after loading
      useEffect(() => {
        if (!(mainComponent && trajectories.length)) return;
        handleResize();
        return handleResize.cancel;
      }, [mainComponent, trajectories, handleResize]);

      // Highlight the selected chain region
      // This useEffect seems to be special:
      // It is run just once but some parts inside keep running on change events
      // listen to change event from nightingale component
      useEffect(() => {
        if (!mainComponent || !topologyManager) return;
        const handler = ({ detail }) => {
          // escape case for event listener
          if (!detail || !(detail.eventtype === 'click' || detail.eventtype === 'reset')) return;
          let highlight = '';
          for (const manager of document.querySelectorAll('protvista-manager')) {
            // get highlight value for each manager
            const thisHiglight = manager.attributeValues.get('highlight');
            // Get the chain letter to know which chain has been selected
            const chain = manager.attributes.chain.value;
            // if none, escape
            if (!thisHiglight) continue;
            // Start and end values are in model numeration
            // DANI: This is totally by chance. I didn't program this previous part
            const [start, end] = thisHiglight.split(':');
            const sourceStart = topologyManager.getResidueByParameters(chain, +start);
            const sourceEnd = topologyManager.getResidueByParameters(chain, +end);
            if (sourceStart.chainName !== sourceEnd.chainName)
              throw new Error(`Range from multiple chains is not supported`);
            highlight += ` or :${sourceStart.chainName} and ${sourceStart.number}-${sourceEnd.number}`;
          }
          highlight = highlight.substr(4); // remove initial ' or '

          const previousStructureRepresentation = mainComponent &&
          mainComponent.reprList.find(
              representation => representation.name === 'structure',
            );
          if (previousStructureRepresentation)
          mainComponent.removeRepresentation(previousStructureRepresentation);
          // no highlight, then default coloring
          if (!highlight) {
            mainComponent.addRepresentation('cartoon', {
              sele: CHAIN_SELECTION,
              name: 'structure',
              opacity: 1,
            });
            if (curatedOrientation) {
              stageRef.current.animationControls.orient(
                curatedOrientation,
                DEFAULT_ORIENTATION_TRANSITION_DURATION,
              );
            }
            return;
          }

          // otherwise, highlight accordingly
          const colorSchemeID = ColormakerRegistry.addSelectionScheme(
            [['yellow', highlight], ['white', '*']],
            'custom label',
          );
          mainComponent.addRepresentation('cartoon', {
            sele: CHAIN_SELECTION,
            name: 'structure',
            opacity: 1,
            color: colorSchemeID,
          });
          mainComponent.autoView(
            highlight,
            DEFAULT_ORIENTATION_TRANSITION_DURATION,
          );
        };
        window.addEventListener('change', handler);
        return () => window.removeEventListener('change', handler);
      }, [mainComponent, topologyManager, curatedOrientation]);

      // Keep the distance tooltip function in a reference so the hover handler is not reset
      const distanceTooltipRef = useRef(distanceTooltip);
      distanceTooltipRef.current = distanceTooltip;
      // Keep the hover display function in a reference for the same reason
      const onHoverDisplayRef = useRef(onHoverDisplay);
      onHoverDisplayRef.current = onHoverDisplay;

      // Customize the NGL tooltip
      useEffect(() => {
        if (!topologyManager) return;
        // Set a new tooltip
        const tooltip = tooltipRef.current;
        // WARNING: The following line is dangerous since you are manipulating the DOM outside of React
        // If the tooltip component is not child of the viewer and you change to molstar then you have the following error:
        // Node.removeChild: The node to be removed is not a child of this node
        containerRef.current.appendChild(tooltip);

        // Remove the original tooltip
        stageRef.current.mouseControls.remove('hoverPick');

        // Set a function which is used further to write a formatted output message to refer an atom
        // The component is required to know if it contains a partial system
        const formatOutput = (atom, component) => {
          // In partial systems NGL atom and residue indices do not match the whole system indices
          // Get the residue from the whole system atom index then
          const partialSystem = component.partialSystem;
          const atomIndex = toWholeAtomIndex(partialSystem, atom.index);
          // a.residueIndex starts at 0
          // WARNING: a.residueIndex is correct but we must convert it to source first
          // In some cases 1 residue can have multiple residue indices
          // (e.g. hydrogens at the end)
          const residue = partialSystem
            ? topologyManager.getAtomByIndex(atomIndex).residue
            : topologyManager.getResidueByIndex(atom.residueIndex);
          return (
            <AtomDescription
              atomIndex={atomIndex}
              atomName={atom.atomname}
              residueName={atom.resname}
              residue={residue}
            />
          );
        };

        // Save a timeout before displaying the tooltip
        // This way we can kill the display in case the mouse is out before the timeout is over
        let timeout;

        // Set a function that both prevents the tooltip if it is about to appear and hides it is already displayed
        const hideTooltip = () => {
          clearTimeout(timeout);
          tooltip.style.display = 'none';
        };

        // Show our tooltip with the corresponding values when the mouse hovers an atom/bond
        stageRef.current.signals.hovered.add(function(pickingProxy) {
          // When mouse is over something (i.e. bonds or atoms)
          if (pickingProxy) {
            // Set a timeout for the hover to do not be instantaneous
            hideTooltip();
            timeout = setTimeout(() => {
              // handle tooltip text
              let description;
              const bond = pickingProxy.bond;
              const atom = pickingProxy.atom;
              const distance = pickingProxy.distance;
              const component = pickingProxy.component;
              // Get the whole system index of an atom from the hovered component
              const wholeIndex = atom => toWholeAtomIndex(component.partialSystem, atom.index);
              // When we hover a distance
              if (distance) {
                const atom1 = distance.atom1;
                const atom2 = distance.atom2;
                const custom = distanceTooltipRef.current &&
                  distanceTooltipRef.current(wholeIndex(atom1), wholeIndex(atom2));
                description = custom || (
                  <>
                    <div>{`Distance ${wholeIndex(atom1)} - ${wholeIndex(atom2)} (${atom1.distanceTo(atom2).toFixed(2)} Å)`}</div>
                    <hr style={{ color: 'lightGrey' }} />
                    {formatOutput(atom1, component)}
                    <hr style={{ color: 'lightGrey' }} />
                    {formatOutput(atom2, component)}
                  </>
                );
              }
              // When we hover a bond
              else if (bond) {
                const atom1 = bond.atom1;
                const atom2 = bond.atom2;
                description = (
                  <>
                    <div>{`Bond ${wholeIndex(atom1)} - ${wholeIndex(atom2)}`}</div>
                    <hr style={{ color: 'lightGrey' }} />
                    {formatOutput(atom1, component)}
                    <hr style={{ color: 'lightGrey' }} />
                    {formatOutput(atom2, component)}
                  </>
                );
              }
              // When we hover an atom
              else if (atom) {
                description = formatOutput(atom, component);
                if (onHoverDisplayRef.current)
                  description = onHoverDisplayRef.current(wholeIndex(atom), description);
              }
              setTooltipContent(description);
              // Handle tooltip position
              // WARNING: It is important to make the display block before calculating the position
              // This is because the position is calculated from the tooltip size, which would be 0 otherwise
              tooltip.style.display = 'block';
              const { x, y } = setTooltipPosition(
                containerRef.current,
                tooltip,
                pickingProxy.mouse.position,
                3,
              );
              tooltip.style.top = y + 'px';
              tooltip.style.left = x + 'px';
            }, 400); // Wait 0,4 secs before showing the tooltip
          }
          // When mouse is over nothing
          else {
            hideTooltip();
          }
        });

        // Remove the tooltip when the mouse is out of the NGL viewer container
        containerRef.current.addEventListener('mouseleave', hideTooltip, false);

        // Cleaning function
        return () => {
          tooltip.remove();
          containerRef.current.removeEventListener('mouseleave', hideTooltip);
        };
      }, [topologyManager, setTooltipContent]);

      // Keep the atom selection callback in a reference so the click handler is not reset every render
      const onAtomSelectRef = useRef(onAtomSelect);
      onAtomSelectRef.current = onAtomSelect;
      const isAtomSelectableRef = useRef(isAtomSelectable);
      isAtomSelectableRef.current = isAtomSelectable;
      const atomsSelectable = Boolean(onAtomSelect);

      // When atoms are selectable, change the cursor to a pointer when hovering a selectable atom
      // Then report the atom index to the parent component when a selectable atom is clicked
      useEffect(() => {
        if (!atomsSelectable || !mainComponent) return;
        const stage = stageRef.current;
        const canvas = containerRef.current.querySelector('canvas');
        // Find the index of the selectable atom of the main component under the mouse, if any
        // Bonds are also accepted, in which case the closest atom of the bond is used
        const getPickedAtom = pickingProxy => {
          if (!pickingProxy || pickingProxy.component !== mainComponent) return null;
          const atom = pickingProxy.atom || pickingProxy.closestBondAtom;
          if (!atom) return null;
          // Return the whole system atom index
          const atomIndex = toWholeAtomIndex(mainComponent.partialSystem, atom.index);
          const isSelectable = isAtomSelectableRef.current;
          if (isSelectable && !isSelectable(atomIndex)) return null;
          return atomIndex;
        };
        let hoveredAtomIndex = null;
        const handleHover = pickingProxy => {
          const atomIndex = getPickedAtom(pickingProxy);
          if (atomIndex === hoveredAtomIndex) return;
          hoveredAtomIndex = atomIndex;
          if (canvas) canvas.style.cursor = atomIndex === null ? 'default' : 'pointer';
        };
        // Replace the default left click action, which moves the camera to the clicked element
        // Selecting an atom already focuses it, and both camera movements together end in a sudden jump
        // Note that this action is triggered by plain left clicks only
        // Other clicks (e.g. right or ctrl + left clicks for measurements) keep their default actions
        const handleClick = (stage, pickingProxy) => {
          const atomIndex = getPickedAtom(pickingProxy);
          if (atomIndex !== null) onAtomSelectRef.current(atomIndex);
          else MouseActions.movePick(stage, pickingProxy);
        };
        // Reset the cursor when the mouse leaves the viewer
        const handleLeave = () => handleHover(null);
        stage.signals.hovered.add(handleHover);
        stage.mouseControls.remove('clickPick-left', MouseActions.movePick);
        stage.mouseControls.add('clickPick-left', handleClick);
        containerRef.current.addEventListener('mouseleave', handleLeave, false);
        // Cleaning function
        return () => {
          stage.signals.hovered.remove(handleHover);
          stage.mouseControls.remove('clickPick-left', handleClick);
          stage.mouseControls.add('clickPick-left', MouseActions.movePick);
          if (containerRef.current)
            containerRef.current.removeEventListener('mouseleave', handleLeave);
          if (canvas) canvas.style.cursor = 'default';
        };
      }, [atomsSelectable, mainComponent]);

      // Track when the first focus has been performed, since first focus is instantaneous
      const firstFocus = useRef(true);
      // Focus the specified ngl selection with the camera automatically
      useEffect(() => {
        if (!focus) return;
        // The selected region may be in any component, not only the main component
        // If a component name is passed then search for it
        const comp = focus.comp
          ? stageRef.current.compList.find(c => c.myName === focus.comp)
          : mainComponent;
        if (!comp) return;
        let transition = DEFAULT_ORIENTATION_TRANSITION_DURATION;
        // First transition is instantaneous
        if (firstFocus.current) {
          transition = 0;
          // if an original orientation was aleady defined
          // (manually created, and stored in the API)
          if (curatedOrientation) {
            // use it to set the initial orientation
            stageRef.current.animationControls.orient(
              curatedOrientation,
              0,
            );
          }
          firstFocus.current = false;
        }
        comp.autoView(toPartialSelection(comp.partialSystem, focus.sele), transition);
      }, [mainComponent, focus, curatedOrientation]);

      // Expose public methods and getters/setters
      useImperativeHandle(
        ref,
        () => ({
          autoResize: handleResize,
          drawMesh(position, colorData, name = "test", normalsData = null) {
            const previousComponent = stageRef.current.compList.find(
              (component) => component.name === name
            );
            if (previousComponent) {
              stageRef.current.removeComponent(previousComponent);
            }
            if (!position || position.length === 0) return;
            const shape = new Shape(name, { disableImpostor: true });
            let colors;

            // New API path: explicit RGB triplets per coordinate.
            if (Array.isArray(colorData) && colorData.length === position.length) {
              colors = new Float32Array(colorData);
            } else {
              // Backward-compatible path for previous color offset input.
              const colorOffset = Array.isArray(colorData) ? colorData : [0, 0];
              colors = new Float32Array(position.length);
              colors = colors.map((v, i) => {
                if (i > colorOffset[1] && i % 3 === 2) {
                  return 1.0;
                } else if (i > colorOffset[0] && i <= colorOffset[1] && i % 3 === 1) {
                  return 1.0;
                } else if (i <= colorOffset[0] && i % 3 === 0) {
                  return 1.0;
                }
                return 0.0;
              });
            }

            const normals = Array.isArray(normalsData) && normalsData.length === position.length
              ? new Float32Array(normalsData)
              : undefined;

            shape.addMesh(position, colors, undefined, normals);
            var shapeComp = stageRef.current.addComponentFromObject(shape, { name: name });
            var rep = shapeComp.addRepresentation("buffer", { opacity: 1., roughness: 1 });
          },
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
            if (!curatedOrientation) return;
            stageRef.current.animationControls.orient(
              curatedOrientation,
              DEFAULT_ORIENTATION_TRANSITION_DURATION,
            );
          },
          get currentFrame() {
            if (!(mainComponent && trajectories.length)) return -1;
            try {
              return mainComponent.trajList[0].trajectory.currentFrame;
            } catch (_) {
              return -1;
            }
          },
          set currentFrame(value) {
            if (!(mainComponent && trajectories.length)) return;
            try {
              const total = this.totalFrames;
              let frame = value;
              if (frame < 0) frame = 0;
              if (frame >= total) frame = total - 1;
              mainComponent.trajList[0].trajectory.setFrame(frame);
            } catch (_) {
              /* */
            }
          },
          get totalFrames() {
            if (!(mainComponent && trajectories.length)) return 1;
            try {
              return mainComponent.trajList[0].trajectory.frames
                .length;
            } catch (_) {
              return 1;
            }
          },
          get totalExpectedFrames() {
            try {
              return mainComponent.trajList[0].expectedFrames;
            } catch (_) {
              return 1;
            }
          },
        }),
        [mainComponent, trajectories, handleResize],
      );

      // workaround to have multiple ref logic on one element
      // https://github.com/thebuilder/react-intersection-observer/issues/186#issuecomment-468641525
      const handleRef = node => {
        // If node does not exist then do not assign null to containerRef
        // This way cleanup functions from some useEffects can properly clean the last reference
        if (!node) return;
        inViewRef(node);
        containerRef.current = node;
      };

      // Finally, render the ngl window
      return (
        <>
          <div
            ref={handleRef}
            className={cn(className, style.container, {
              [style['loading-structure']]: !mainComponent,
              [style['loading-trajectory']]:
                !noTrajectory && anyLoadingTrajectory,
              [style['light-theme']]: !darkBackground,
            })}
            // Display loading status data in the upper left corner of the NGL window
            data-loading={viewerLogs}
          >
            <div ref={tooltipRef} className={style.tooltip}>
              {tooltipContent}
            </div>
          </div>
          {import.meta.env.DEV && (
            <div style={debugFpsBadgeStyle}>{debugFps.toFixed(1)} fps</div>
          )}
        </>
      );
    },
  ),
);
NGLViewer.displayName = 'NGLViewer'
export default NGLViewer;
