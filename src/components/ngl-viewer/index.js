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
import { debounce, clamp } from 'lodash-es';
import cn from 'classnames';
import { autoLoad, Stage, ColormakerRegistry, Matrix4 } from 'ngl';

import { frame } from 'timing-functions';

import payloadToNGLFile from './payload-to-ngl-file';
import getFrames from './get-frames';

import { AccessionCtx, ProjectCtx, PdbCtx } from '../../contexts';

import {
  getAtomResidue,
  absolute2sourceResidue,
  complexNumerationParser,
  source2modelResidue,
  model2sourceResidue,
} from '../../utils/topology-manager';

import { setTooltipPosition } from '../../utils/tooltip-position-manager';

import style from './style.module.css';

// To get frames
import { BASE_PATH_PROJECTS } from '../../utils/constants';
// This function extracts the atom and frame counts from the content-range header
// DEPRECATED: This data know is extracted from the 'files' metadata in the project context
//import extractCounts from './extract-counts';
import axios from 'axios';

const DEFAULT_NUMBER_OF_FRAMES = 25;
const DEFAULT_ORIENTATION_TRANSITION_DURATION = 750; // 750 ms

const CHAIN_SELECTION = 'polymer and not hydrogen ';

const isValidColor = colorName => {
  var s = new Option().style;
  s.color = colorName;
  return s.color === colorName;
};

const frameRangeFormat = /\?frames=(?<start>\d+):(?<end>\d+)(:(?<step>\d+))?/;
const parseFrameRange = frameRange => {
  // Search in the function's parameter value "string" by using a specified regexp format: STEP_FORMAT
  const parsed = frameRangeFormat.exec(frameRange);
  if (!parsed) return null;
  // The 'frameRangeFormat' has 3 defined groups: start, end and step
  // Use the value from the 3 groups to define and save the desired frames
  const start = +parsed.groups.start;
  const end = Math.max(+parsed.groups.end, start); // If the end is less than the start then just use the start
  const step = +(parsed.groups.step || 1);
  const frames = Math.floor((end - start) / step) + 1;
  return { start, end, step, frames };
};

// Join 2 ArrayBuffer
// https://stackoverflow.com/questions/10786128/appending-arraybuffers
function appendBuffer(buffer1, buffer2) {
  var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
  tmp.set(new Uint8Array(buffer1), 0);
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
  return tmp.buffer;
}

const NGLViewer = memo(
  forwardRef(
    (
      {
        className,
        playing,
        spinning,
        smooth,
        onProgress,
        projection,
        nFrames = DEFAULT_NUMBER_OF_FRAMES,
        selectedAtoms, // Atom index of the atom and residue to be represented
        selectedResidues, // Residue complex numerations from residues to be represented
        selectedChains, // Chain letters from chains to be represented
        selectedCustom, // Free NGL selections to be directly represented
        selectedDistances, // Groups of 2 atoms or residues to be represented as a distance
        selectedAngles, // Groups of 3 atoms to be represented as an angle
        selectedRepresentation, // String name of a representation to be painted in yellow color (only 1)
        noTrajectory, // True when only specific frames must be loaded
        initialFocus, // The ngl selection to be focused by the camera initially
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
        // Customized ngl representation coloring methods
        customColorSchemes,
      },
      ref,
    ) => {
      // Save the components object into a local constant which can be modified
      const comps = useMemo(() => components, [components]);

      // If no URL is provided then use the main trajectory (the 'md.imaged.rot.xtc' file) // URL to find the trajectory data in the API
      // True when we just want to display a static structure // Requeste number of frames to display
      // data from context
      const accession = useContext(AccessionCtx);
      const { metadata, files, curatedOrientation } = useContext(ProjectCtx);
      const pdbData = useContext(PdbCtx);

      const [isFirstCompStaged, setIsFirstCompStaged] = useState(false);
      // The last automatic camera focus
      const [focus, setFocus] = useState(initialFocus);

      useMemo(() => {
        //console.log(initialFocus);
        setFocus(initialFocus);
      }, [initialFocus]);

      // references
      const containerRef = useRef(null);
      const stageRef = useRef(null);
      const firstTime = useRef(true);
      // curatedOrientation might be null
      const originalOritentationRef = useRef(
        curatedOrientation ? new Matrix4().set(...curatedOrientation) : null,
      );

      // in-view hook
      const [inViewRef, isInView] = useInView();

      // Download topologies ----------------------------------------------------------------------

      // Download all requested topologies: Each component may have a different structure URL.
      // Set the first component topology as the 'pdbData'
      // If a topologyURL is provided, download data form the API
      // Otherwise, use the context pdbData (i.e. the 'md.imaged.rot.dry.pdb' file)

      const [topologies, setTopologies] = useState([]);

      // Find if there are new topology to be requested in the components:
      // Collect the topology on each component
      // If the component has no topology specified use the main topology
      useMemo(() => {
        setTopologies(currentTopologies => {
          const newTopologies = [];
          comps.forEach(comp => {
            const url = comp.topologyURL;
            // Some urls may be missing
            // This happens when the component wants the default topology from the pdbData
            if (!url)
              newTopologies.push({
                loading: false,
                file: pdbData.file,
                error: null,
              });
            // Check if the url is new
            // Else, skip this url since it is already downloaded
            const current = currentTopologies.find(topology => {
              return topology.url === url;
            });
            if (current) return;
            // Add the topology to the list, so it will be requested to the API
            newTopologies.push({
              url: url,
              loading: true,
              file: null,
              error: null,
            });
          });
          return [...currentTopologies, ...newTopologies];
        });
      }, [comps, setTopologies, pdbData.file]);

      // Download all requested topologies from the API
      useEffect(() => {
        let didCancel = false;
        // Make an API request from each url
        topologies.forEach((topology, t) => {
          // Check if the requested url has the data already downloaded
          // If so, skip this request
          if (topology && topology.file) return;
          // get the topology URL
          const url = topology.url;
          // If there is no URL load the context pdbData
          if (!url)
            // WARNING: The '[...previous]' is essential to make the array object change
            // This is important, since the 'topologies' object is used as a dependendy further
            // And if we do not change the array then the change is not detected
            setTopologies(previous => {
              const current = previous[t];
              current.loading = false;
              current.file = pdbData.file;
              return [...previous];
            });
          // If there is an URL
          else {
            // 'autoLoad' is the built in function from NGL to load data
            autoLoad(url, { defaultRepresentation: false, ext: 'pdb' })
              // If the request was sucessful
              .then(
                file =>
                  !didCancel &&
                  setTopologies(previous => {
                    const current = previous[t];
                    current.loading = false;
                    current.file = file;
                    return [...previous];
                  }),
              )
              // If the request failed
              .catch(
                error =>
                  !didCancel &&
                  setTopologies(previous => {
                    const current = previous[t];
                    current.loading = false;
                    current.error = error;
                    return [...previous];
                  }),
              );
          }
        });
        return () => (didCancel = true);
      }, [topologies, pdbData]);

      const mainComponent = comps[0];
      const mainTopology = topologies.find(topology => {
        return topology.url === mainComponent.topologyURL;
      });
      const { loading: loadingPDB, file: pdbFile } = mainTopology || {
        loading: false,
        file: pdbData.file,
      };

      // Download trajectories ------------------------------------------------------------------------------------------------

      // First we find all trajectory URLs (i.e. all requests to API)
      // Then we ask the API skipping repeated URLs

      // Find out if this is a PCA projection
      const isProjection = Number.isFinite(projection);

      // Set a function to modify an url by adding the frames range according to nFrames
      // The only exception are those trajectories whose frame number is lower than nFrames

      // Set variable to store trajectory data and loading status
      const [trajectories, setTrajectories] = useState([]);

      // Find if there are new trajectories to be requested in the components:
      // Collect trajectories on each component
      // If the component has no trajectory specified use the main trajectory
      // If the component is not the main component and has no frame specified, use the first frame
      // Only the main component (the first) is allowed to load multiple frames by the moment
      useMemo(() => {
        // Finally update the trajectories state
        setTrajectories(currentTrajectories => {
          // Save the new trajectories
          const newTrajectories = [];

          // Set the url to ask the API
          // Here, if you ask for the trajectory.bin instead of just trajectory, you get the whole file
          // This is because the only route of the API accepting frames selection is the "trajectory" endpoint
          // Other paths such as "trajectory.bin" will be processed as "/:files"
          const baseUrl = `${BASE_PATH_PROJECTS}${accession}/files/trajectory`;

          comps.forEach((comp, c) => {
            if (comp.onlyTopology) return;

            // Set the first component as the 'principal' component
            const isPrincipal = c > 0;
            const requestedFrame = comp.frame;

            // Get the trajectory urls
            // If the component has no trajectory url specified then use the main trajectory url alone
            let urls = comp.trajectoryURLs || [baseUrl];

            // Add the frames number of all the component requested trajectories
            comp.frameCount = 0;

            urls.forEach((url, u) => {
              // Frames are added to any url which is missing the frames range according to nFrames
              // The only exception are those trajectories whose frame number is lower than nFrames
              let finalUrl = url;

              // Check if the url is already framed
              const framed = parseFrameRange(url);

              // Get the name of the trajectory file inside the database
              // i.e. the end of the requested URL
              // The exception is the API endpoint 'trajectory', which uses the 'trajectory.bin' file
              let trajectoryFilename = url.split('/').slice(-1)[0];
              if (framed)
                trajectoryFilename = trajectoryFilename.split('?frames=')[0];
              if (trajectoryFilename === 'trajectory')
                trajectoryFilename = 'trajectory.bin';

              // Get the 'files' summary of the required trajectory
              const trajectoryMetadata = files.find(file => {
                return file.filename === trajectoryFilename;
              }).metadata;

              // Get the number of frames in the whole trajectory
              const trajectoryFrames = trajectoryMetadata.frames;

              // Set the number of frames to be requested from the whole trajectory
              let requestedFrames = nFrames;
              if (nFrames > trajectoryFrames)
                requestedFrames = trajectoryFrames;
              if (requestedFrame) requestedFrames = 1;
              else if (framed) requestedFrames = framed.frames;
              // Components which are not the principal must include a 'frame' value
              else if (isPrincipal && trajectoryFrames > 1)
                throw new Error(
                  `Only the main component is allowed to load multiple frames`,
                );

              // Now modify the url if it is not framed yet
              if (!framed) {
                // Get the string frames range according to nFrames
                const framesRange = getFrames(
                  trajectoryFrames,
                  requestedFrames,
                  requestedFrame,
                );

                // Add the frames range to the original url
                if (framesRange) finalUrl = url + `?frames=${framesRange}`;
              }

              // Set the component framed url if it doesn't exists
              if (!comp.framedURLs) comp.framedURLs = [];

              // Save this final url in the framedURL in the component
              // Overwrite the previous framed url if exists
              comp.framedURLs[u] = finalUrl;

              // Add the requested frames number to the frame count
              comp.frameCount += requestedFrames;

              // Check if the requested url is already in the list
              // If so, skip this request
              // If not, save the request url and proceed
              const current = currentTrajectories.find(trajectory => {
                return trajectory.url === finalUrl;
              });
              if (!current) {
                newTrajectories.push({
                  url: finalUrl,
                  frames: requestedFrames,
                  // Add also the atoms number, which is used further
                  atoms: trajectoryMetadata.atoms,
                  loading: true,
                });
              }
            });
          });
          return [...currentTrajectories, ...newTrajectories];
        });
      }, [accession, comps, files, nFrames]);

      // Download the requested trajectory data (frames)
      useEffect(() => {
        // Ask the API through axios (https://www.npmjs.com/package/axios)
        // Some extra load features are passed through axios
        // Set a cancel 'token'
        const source = axios.CancelToken.source();
        let didCancel = false;

        trajectories.forEach(trajectory => {
          // Check if the requested url has the data already downloaded
          // If so, skip this request
          if (trajectory && trajectory.payload) return;

          // Set the loading status as true
          trajectory.loading = true;

          trajectory.progress = 0;
          // Set a function to track the download progress
          const onDownloadProgress = progressEvent => {
            // Check if progress is measurable. If so, mesure it.
            if (progressEvent.lengthComputable)
              trajectory.progress = progressEvent.loaded / progressEvent.total;
          };

          // Send a request to the API in a Promise/await manner
          axios(trajectory.url, {
            cancelToken: source.token,
            onDownloadProgress,
            responseType: 'arraybuffer',
          })
            // If the request has succeed
            .then(response => {
              if (didCancel) return;
              // 'counts' include the number of atoms and the real number of frames
              //trajectory.counts = extractCounts(response);
              // Save the main data in the ref
              trajectory.payload = response.data;
              trajectory.loading = false;
              // We create a new object to force the trajectory data load in ngl (trajectories dependent)
              setTrajectories([...trajectories]);
            })
            // Otherwise
            .catch(error => {
              if (didCancel) return;
              console.error('Error while loading the trajectory: ' + error);
            });
        });
        return () => {
          // Cancel the request
          source.cancel();
          didCancel = true;
        };
      }, [trajectories]);

      const trajectoryLoadingStatus = useMemo(() => {
        const everyLoading = trajectories.map(trajectory => trajectory.loading);
        const trajectoryLoadingStatus = everyLoading.some(l => l === true);

        return trajectoryLoadingStatus;
      }, [trajectories]);

      // Get the current progress of all trajectory downloads
      const everyProgress = trajectories.map(trajectory => trajectory.progress);
      const trajectoryProgress = useMemo(() => {
        const sum = everyProgress.reduce((a, b) => a + b, 0);
        const trajectoryProgress = sum / everyProgress.length;

        return trajectoryProgress;
      }, [everyProgress]);

      // Stage creation and removal on mounting and unmounting
      useEffect(() => {
        // set-up
        stageRef.current = new Stage(containerRef.current);
        // wait for a render to screen, then
        frame().then(() => {
          if (!stageRef.current) return;
          // make sure NGL knows the size it has available
          stageRef.current.handleResize();
        });
        // clean-up
        return () => {
          // NOTE: following line causes to fail when loading a new viewer with
          // NOTE: previous structure data
          // stageRef.current.removeAllComponents();
          stageRef.current.dispose();
          stageRef.current = null;
        };
      }, []);

      // background (with transition)
      useEffect(() => {
        const beginning = Date.now();
        let duration = 1000;
        if (firstTime.current) {
          duration = 0;
          firstTime.current = false;
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
      const handleFrameChange = useCallback(
        frame => {
          if (noTrajectory) return; // En pruebas
          if (!stageRef.current.compList[0].trajList[0]) return;
          if (!onProgress) return;
          const progress = clamp(
            frame /
              (stageRef.current.compList[0].trajList[0].trajectory.frameCount -
                1),
            0,
            1,
          );
          onProgress(progress);
        },
        [noTrajectory, onProgress],
      );

      // Resize logic
      // declare handler
      const handleResize = useCallback(
        debounce(() => {
          if (!stageRef.current) return;
          const canvas = containerRef.current.querySelector('canvas');
          if (canvas) canvas.style.height = '';
          stageRef.current.handleResize();
        }, 500),
        [],
      );
      // connect the handle to events
      useEffect(() => {
        window.addEventListener('resize', handleResize);
        return () => {
          handleResize.cancel();
          window.removeEventListener('resize', handleResize);
        };
      }, [handleResize]);

      // PDB file, base structure
      // Set the representations in each component
      useEffect(() => {
        // Keep the count of each representation in each component
        // It is not the same that any iteration index
        let repCounter = 0;

        if (!pdbFile) return;
        // Atom occupancy is a field which is not used anywhere but in the electrostatic representation
        // The electrostatic surface scheme color does not work if the occupancy is 0 (ngl code, not ours)
        // We set all occupancies to 1, since some topologies may have all occupancies as 0 by default
        pdbFile.atomStore.occupancy = new Array(
          pdbFile.atomStore.occupancy.length,
        ).fill(1);

        // All topologies must be ready before we start loading the components to stage
        // DANI: Esto es tentador quitarlo para que las topologías vayan cargando cuando llegan
        // DANI: No obstante, es un percal, hay que hacerlo con tiempo
        // DANI: Los components de stageRef.current.compList deben estar en orden
        if (topologies.some(t => t.loading)) return;

        comps.forEach((comp, c) => {
          // Set the NGL component
          let stageComp = stageRef.current.compList[c];
          if (!stageComp) {
            // Find the topology which matches the component url
            // If a component has no url it will match a topology with no url: the default topology
            const topology = topologies.find(topology => {
              return topology.url === comp.topologyURL;
            });
            if (!topology)
              throw new Error(`Topology from '${comp.topologyURL}' is missing`);
            // Stop here if it is not downloaded yet
            if (topology.error)
              throw new Error(
                `Topology from '${comp.topologyURL}' returned error ${topology.error}`,
              );
            if (!topology.file)
              throw new Error(
                `Topology data from '${comp.topologyURL}' is missing`,
              );
            // Add the topology to the NGL
            stageRef.current.addComponentFromObject(topology.file);
            stageComp = stageRef.current.compList[c];
            stageComp.onlyTopology = comp.onlyTopology;
            setIsFirstCompStaged(true);
          }

          // Set each representation
          // Save all current representation names so we can delete previous representations which are not requested anymore
          const registredNames = [];
          comp.representations.forEach((rep, r) => {
            // The name here is used to indetify previous existing representations
            const name = r + '-' + rep.name;
            registredNames.push(name);

            // Adapt a few representation values to the context

            const show =
              !showRepresentations || showRepresentations[repCounter];

            const sele = nglSelections[repCounter];

            const type = drawingMethods[repCounter];

            const colorScheme =
              rep.name === selectedRepresentation
                ? // If the representation is selected then the color is yellow
                  ColormakerRegistry.addSelectionScheme(
                    [['yellow', 'all']],
                    'custom label',
                  )
                : // If the colorScheme is in the passed custom schemes use it
                customColorSchemes &&
                  customColorSchemes[coloringMethods[repCounter]]
                ? customColorSchemes[coloringMethods[repCounter]]
                : // If the colorScheme is a defined color, create a custom colorScheme for this color
                isValidColor(coloringMethods[repCounter])
                ? ColormakerRegistry.addSelectionScheme(
                    [[coloringMethods[repCounter], 'all']],
                    'custom label',
                  )
                : // Otherwise let the color scheme as it is
                  coloringMethods[repCounter];

            const colorDomain = type === 'surface' ? [-200, 200] : undefined;

            const surfaceType = type === 'surface' ? 'av' : undefined;

            const opacity = show ? opacities[repCounter] : 0;

            // Join all parameters into a single input object
            const parameters = {
              sele,
              name,
              opacity,
              colorScheme,
              colorDomain,
              surfaceType,
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
              if (previousType !== type || previousSelection !== sele) {
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
              const name = rep.label + '-' + repCounter;
              // Find the equivalent previous label
              const previous = stageComp.annotationList.find(
                annotation => annotation.name === name,
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
                  const center =
                    stageComp.reprList[r].repr.structureView.center;
                  const annotation = stageComp.addAnnotation(center, elm);
                  annotation.name = name;
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

            repCounter += 1;
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

          // if an original orientation was aleady defined
          // (manually created, and stored in the API)
          /*
          if (originalOritentationRef.current) {
            // use it to set the initial orientation
            stageRef.current.animationControls.orient(
              originalOritentationRef.current,
              0,
            );
          } else {
            originalOritentationRef.current = stageRef.current.viewerControls.getOrientation();
          }
          */

          // If nothing has been focused at the end then focus the whole first component
          setFocus(previous => {
            if (previous) return previous; // This will not trigger any rerender
            return { comp: 0, sele: 'all' };
          });
        });
      }, [
        pdbFile,
        isProjection,
        comps,
        drawingMethods,
        coloringMethods,
        opacities,
        topologies,
        selectedRepresentation,
        showRepresentations,
        nglSelections,
        customColorSchemes,
      ]);

      // Highlight specific atoms
      useEffect(() => {
        // DANI: He tenido que quitar la condicion de 'instanceof Set' porque sino no me entraba en el heatmap
        //if (!pdbFile || !(selectedAtoms instanceof Set) || !(selectedAtoms)) {
        if (!pdbFile || !selectedAtoms) {
          return;
        }

        // Set a representation name
        // This is useful to find previous representations in further renders
        const nameHighlight = '*highlightedAtoms';
        const previousHighlightRepresentation = stageRef.current.compList[0].reprList.find(
          representation => representation.name === nameHighlight,
        );
        if (previousHighlightRepresentation) {
          stageRef.current.compList[0].removeRepresentation(
            previousHighlightRepresentation,
          );
        }

        // Name for residues representation
        const nameContextHighlight = '*highlightedAtomResidues';
        const previousContextRepresentation = stageRef.current.compList[0].reprList.find(
          representation => representation.name === nameContextHighlight,
        );
        if (previousContextRepresentation) {
          stageRef.current.compList[0].removeRepresentation(
            previousContextRepresentation,
          );
        }

        const atoms = Array.from(selectedAtoms);
        if (!atoms.length) return;

        // ngl starts counting at 0
        const seleHighlight = `@${atoms
          .map(atomNumber => atomNumber)
          .join(',')}`;

        stageRef.current.compList[0].addRepresentation('spacefill', {
          sele: seleHighlight,
          opacity: 0.5,
          scale: 1.5,
          name: nameHighlight,
        });

        const seleContext = Array.from(
          new Set(
            atoms.map(
              atomsNumber => {
                const { atomCount, atomOffset } = getAtomResidue(
                  atomsNumber,
                  pdbFile,
                );
                const atomIndexes = [...Array(atomCount).keys()].map(
                  i => atomOffset + i,
                );
                const nglAtomSelection = '@' + atomIndexes.join(',');
                return nglAtomSelection;
              },
              // 'atoms' are in abolsute numeration
              /*
              atomsNumber =>
                absolute2sourceResidue(
                  getAtomResidue(atomsNumber, pdbFile).index,
                  pdbFile,
                ).nglSelection
              */
            ),
          ),
        ).join(' or ');

        stageRef.current.compList[0].addRepresentation('ball+stick', {
          sele: seleContext,
          name: nameContextHighlight,
        });

        // Focus the highlighted zone with the camera
        setFocus({ comp: 0, sele: seleContext });
      }, [pdbFile, selectedAtoms, darkBackground]);

      // Highlight specific residues
      useEffect(() => {
        if (!pdbFile || !selectedResidues) {
          return;
        }
        // Set a representation name. This is useful to find this representation further
        const nameHighlight = '*highlightedResidues';
        const previousHighlightRepresentation = stageRef.current.compList[0].reprList.find(
          representation => representation.name === nameHighlight,
        );
        if (previousHighlightRepresentation)
          stageRef.current.compList[0].removeRepresentation(
            previousHighlightRepresentation,
          );

        // Get the residues input
        const residues = selectedResidues.map(
          residue => complexNumerationParser(residue).nglSelection,
        );
        if (!residues.length) return;
        // Transform the residues list into an NGL selection
        const nglSelection = Array.from(new Set(residues)).join(' or ');

        // Represent the previous selection in ball+sticks drawing method
        stageRef.current.compList[0].addRepresentation('ball+stick', {
          sele: nglSelection,
          name: nameHighlight,
        });

        // Focus the highlighted zone with the camera
        setFocus({ comp: 0, sele: nglSelection });
      }, [pdbFile, selectedResidues]);

      // Highlight specific chains
      // DANI: NO Probado
      useEffect(() => {
        if (!pdbFile || !selectedChains) {
          return;
        }
        // Set a representation name. This is useful to find this representation further
        const nameHighlight = '*highlightedChains';
        const previousHighlightRepresentation = stageRef.current.compList[0].reprList.find(
          representation => representation.name === nameHighlight,
        );
        if (previousHighlightRepresentation)
          stageRef.current.compList[0].removeRepresentation(
            previousHighlightRepresentation,
          );

        // Get the residues input
        const chains = selectedChains.map(c => ':' + c);
        if (!chains.length) return;
        // Transform the residues list into an NGL selection
        const nglSelection = Array.from(new Set(chains)).join(' or ');

        // Represent the previous selection in ball+sticks drawing method
        stageRef.current.compList[0].addRepresentation('ball+stick', {
          sele: nglSelection,
          name: nameHighlight,
        });
        // Focus the highlighted zone with the camera
        setFocus({ comp: 0, sele: nglSelection });
      }, [pdbFile, selectedChains]);

      // Highlight specific free NGL selections
      useEffect(() => {
        if (!pdbFile || !selectedCustom) {
          return;
        }
        // Set a representation name. This is useful to find this representation further
        const nameHighlight = '*highlightedCustom';
        const previousHighlightRepresentation = stageRef.current.compList[0].reprList.find(
          representation => representation.name === nameHighlight,
        );
        if (previousHighlightRepresentation)
          stageRef.current.compList[0].removeRepresentation(
            previousHighlightRepresentation,
          );

        if (!selectedCustom.length) return;
        // Transform the residues list into an NGL selection
        const nglSelection = Array.from(new Set(selectedCustom)).join(' or ');

        // Represent the previous selection in ball+sticks drawing method
        stageRef.current.compList[0].addRepresentation('ball+stick', {
          sele: nglSelection,
          name: nameHighlight,
        });
        // Focus the highlighted zone with the camera
        setFocus({ comp: 0, sele: nglSelection });
      }, [pdbFile, selectedCustom]);

      // Highlight specific distances
      // When 'selectedDistances' is numeric it is taken as atoms
      // When 'selectedDistances' is string it is taken as residues
      // In both cases it works with absolute numeration
      useEffect(() => {
        if (!pdbFile || !selectedDistances) {
          return;
        }
        //console.log(selectedDistances);
        // Set a representation name. This is useful to find this representation further
        const name = '*distance';
        const previousRepresentation = stageRef.current.compList[0].reprList.find(
          representation => representation.name === name,
        );
        // Remove the previous representation
        if (previousRepresentation)
          stageRef.current.compList[0].removeRepresentation(
            previousRepresentation,
          );

        // Display the new distance representation
        stageRef.current.compList[0].addRepresentation('distance', {
          atomPair: selectedDistances,
          color: 'skyblue',
          labelUnit: 'angstrom',
          name: name,
          // Label color is the opposite of the background color
          labelColor: darkBackground ? 16777215 : 1, // 16777215 is white, 1 is black
        });
      }, [pdbFile, selectedDistances, darkBackground]);

      // Highlight specific angles
      useEffect(() => {
        if (!pdbFile || !selectedAngles) {
          return;
        }
        // Set a representation name. This is useful to find this representation further
        const name = '*angles';
        const previousRepresentation = stageRef.current.compList[0].reprList.find(
          representation => representation.name === name,
        );
        if (previousRepresentation)
          stageRef.current.compList[0].removeRepresentation(
            previousRepresentation,
          );

        stageRef.current.compList[0].addRepresentation('angle', {
          atomTriple: selectedAngles,
          name: name,
          labelColor: darkBackground ? 16777215 : 1, // 16777215 is white, 1 is black
        });
      }, [pdbFile, selectedAngles, darkBackground]);

      // pause on loading
      // Make the NGL static while loading after user changes the frame number
      useEffect(() => {
        if (
          !(
            pdbFile &&
            stageRef.current.compList[0] &&
            stageRef.current.compList[0].trajList[0]
          )
        )
          return;
        stageRef.current.compList[0].trajList[0].trajectory.player.pause();
      }, [pdbFile, trajectoryLoadingStatus]);

      // DCD file, trajectory
      // Once the trajectories are downloaded, load them in corresponding NGL representations
      // Every time the trajectory payloads change this useEffect must be rerun
      useEffect(() => {
        // Check if trajectories are
        if (!trajectories || trajectories.length === 0) return;

        let frames = [];

        comps.forEach((comp, c) => {
          const stageComp = stageRef.current.compList[c];
          // Wait if the topology has not been loaded yet
          if (!stageComp) return;
          // Abort if the component is marked as 'only topology'
          if (stageComp.onlyTopology) return;

          // Find the trajectory payload from the component urls and join them
          const trajectoryPayloads = [];
          // Record also the atoms for each trajectory and check that they match
          let atoms;
          // Record also the frames for each trajectory and add them
          //let trajectoryFrames = 0;
          for (const url of comp.framedURLs) {
            const trajectory = trajectories.find(trajectory => {
              return trajectory.url === url;
            });
            if (!trajectory)
              throw new Error(
                `The url '${url}' has not been requested to the API`,
              );

            // Wait if the trajectory has not been downloaded yet
            if (trajectory.loading) return;

            // Get atoms and check they match
            if (!atoms) atoms = trajectory.atoms;
            if (atoms !== trajectory.atoms)
              throw new Error(
                `Atoms number in the different trajectories do not match`,
              );

            // Add the main data to the array of payloads
            trajectoryPayloads.push(trajectory.payload);
          }

          let totalPayload;
          if (trajectoryPayloads.length === 1)
            totalPayload = trajectoryPayloads[0];
          // Join all payloads into a single trajectory
          else
            totalPayload = trajectoryPayloads.reduce((cb, nb) =>
              appendBuffer(cb, nb),
            );

          // remove all possibly already existing trajectories
          // This return an error in console: "updateStructure: traj disposed"
          // This may be a bug but it is actually working
          // See https://github.com/arose/ngl/issues/680
          // DANI: Hay que revisar esto porque alomejor se puede ahorrar este paso si la trayectoria coincide
          stageComp.trajList.forEach(
            stageComp.removeTrajectory.bind(stageComp),
          );

          // Transform the binary trajectory data to an NGL friendly format
          const file = payloadToNGLFile(
            pdbFile,
            totalPayload,
            atoms,
            comp.frameCount,
            isProjection,
          );

          if (file) {
            const trajectoryFrames = stageComp.addTrajectory(file);
            trajectoryFrames.signals.frameChanged.add(handleFrameChange);
            trajectoryFrames.trajectory.setFrame(0);
            frames.push(trajectoryFrames);
          }
        });

        return () =>
          frames.forEach(frame =>
            frame.signals.frameChanged.remove(handleFrameChange),
          );
      }, [pdbFile, trajectories, handleFrameChange, isProjection, comps]);

      // play/pause
      const mainTraj =
        stageRef.current &&
        stageRef.current.compList[0] &&
        stageRef.current.compList[0].trajList[0];
      useEffect(() => {
        if (!(pdbFile && mainTraj)) return;
        const { player } = stageRef.current.compList[0].trajList[0].trajectory;
        // WARNING: Pausing the player when there is no trajectory may seem redundant
        // However, if not paused, the surface representations never stop to be calculated
        if (noTrajectory) player.pause();
        else player[playing && isInView ? 'play' : 'pause']();
        return () => player.pause();
      }, [pdbFile, mainTraj, playing, isInView, noTrajectory]);

      // speed
      useEffect(() => {
        stageRef.current &&
          stageRef.current.compList[0] &&
          stageRef.current.compList[0].trajList[0] &&
          stageRef.current.compList[0].trajList[0].trajectory.player.setParameters(
            { timeout: 500 / (Math.log2(speed + 1) + 1) },
          );
      }, [speed, trajectoryLoadingStatus]);

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
        if (!(pdbFile && mainTraj)) return;
        stageRef.current.compList[0].trajList[0].trajectory.player.parameters.interpolateType = smooth
          ? 'linear'
          : '';
      }, [pdbFile, mainTraj, smooth]);

      // to avoid sometimes when it's not rendering after loading
      useEffect(() => {
        if (!(pdbFile && trajectories.length)) return;
        handleResize();
        return handleResize.cancel;
      }, [pdbFile, trajectories, handleResize]);

      // Highlight the selected chain region
      // This useEffect seems to be special:
      // It is run just once but some parts inside keep running on change events
      // listen to change event from nightingale component
      useEffect(() => {
        const handler = ({ detail }) => {
          // escape case for event listener
          if (
            !detail ||
            !(detail.eventtype === 'click' || detail.eventtype === 'reset')
          ) {
            return;
          }
          let highlight = '';
          for (const manager of document.querySelectorAll(
            'protvista-manager',
          )) {
            // get highlight value for each manager
            const thisHiglight = manager.attributeValues.get('highlight');
            // Get the chain letter to know which chain has been selected
            const chain = manager.attributes.chain.value;
            if (!thisHiglight) {
              // if none, escape
              continue;
            }
            // Start and end values are in model numeration
            // DANI: This is totally by chance. I didn't program this previous part
            const [start, end] = thisHiglight.split(':');
            const sourceStart = model2sourceResidue(
              { chain, residue: start },
              pdbFile,
            );
            const sourceEnd = model2sourceResidue(
              { chain, residue: end },
              pdbFile,
            );
            if (sourceStart.chain !== sourceEnd.chain)
              throw new Error(`Range from multiple chains is not supported`);
            highlight += ` or :${sourceStart.chain} and ${sourceStart.residueNumber}-${sourceEnd.residueNumber}`;
          }
          highlight = highlight.substr(4); // remove initial ' or '

          const structureComponent = stageRef.current.compList[0];

          const previousStructureRepresentation =
            structureComponent &&
            structureComponent.reprList.find(
              representation => representation.name === 'structure',
            );
          if (previousStructureRepresentation) {
            structureComponent.removeRepresentation(
              previousStructureRepresentation,
            );
          }
          // no highlight, then default coloring
          if (!highlight) {
            structureComponent.addRepresentation('cartoon', {
              sele: CHAIN_SELECTION,
              name: 'structure',
              opacity: 1,
            });
            if (originalOritentationRef.current) {
              stageRef.current.animationControls.orient(
                originalOritentationRef.current,
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
          structureComponent.addRepresentation('cartoon', {
            sele: CHAIN_SELECTION,
            name: 'structure',
            opacity: 1,
            color: colorSchemeID,
          });
          structureComponent.autoView(
            highlight,
            DEFAULT_ORIENTATION_TRANSITION_DURATION,
          );
        };
        window.addEventListener('change', handler);
        return () => window.removeEventListener('change', handler);
      }, [pdbFile]);

      // Customize the NGL tooltip
      useEffect(() => {
        if (!pdbFile) return;
        // Set a new tooltip
        const tooltip = document.createElement('div');
        Object.assign(tooltip.style, {
          display: 'none',
          position: 'fixed',
          pointerEvents: 'none',
          backgroundColor: 'rgba( 0, 0, 0, 0.6 )',
          color: 'lightgrey',
          padding: '8px',
          fontFamily: 'sans-serif',
        });
        containerRef.current.appendChild(tooltip);

        // Remove the original tooltip
        stageRef.current.mouseControls.remove('hoverPick');

        // Set a function which is used further to write a formatted output message to refer an atom
        const formatOutput = atom => {
          // WARNING: a.residueIndex is correct but we must convert it to source first
          // In some cases 1 residue can have multiple absolute residue indexes
          // (e.g. hydrogens at the end)
          const sourceResidue = absolute2sourceResidue(
            atom.residueIndex,
            pdbFile,
          );
          const model = source2modelResidue(
            {
              chain: sourceResidue.chain,
              residue: sourceResidue.residueNumber,
              icode: sourceResidue.icode,
            },
            pdbFile,
            metadata,
          );
          return `Atom ${atom.index} (${atom.atomname})
            Chain ${model.chain} ${model ? '(' + model.chainName + ')' : ''}
            Residue ${model.chainResidue} (${atom.resname})`;
        };

        const hideTooltip = () => (tooltip.style.display = 'none');

        // Show our tooltip with the corresponding values when the mouse hovers an atom/bond
        stageRef.current.signals.hovered.add(function(pickingProxy) {
          // When we hover a bond
          if (pickingProxy) {
            // handle tooltip text
            let description;
            const bond = pickingProxy.bond;
            const atom = pickingProxy.atom;
            if (bond) {
              const atom1 = bond.atom1;
              const atom2 = bond.atom2;
              const bondLabel = `Bond ${atom1.index} - ${atom2.index}\n-----\n`;
              description =
                bondLabel + [atom1, atom2].map(formatOutput).join('\n-----\n');
            } else if (atom) {
              description = formatOutput(atom);
            }
            tooltip.innerText = description;
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
          } else {
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
      }, [pdbFile, metadata]);

      // Track when the first focus has been performed, since first focus is instantaneous
      const firstFocus = useRef(true);
      // Focus the specified ngl selection with the camera automatically
      useEffect(() => {
        if (!focus) return;
        const comp = stageRef.current.compList[focus.comp];
        if (!comp) return;
        let transition = DEFAULT_ORIENTATION_TRANSITION_DURATION;
        // First transition is instantaneous
        if (firstFocus.current) {
          transition = 0;
          firstFocus.current = false;
        }
        comp.autoView(focus.sele, transition);
      }, [isFirstCompStaged, focus]);

      // Expose public methods and getters/setters
      useImperativeHandle(
        ref,
        () => ({
          autoResize: handleResize,
          centerFocus() {
            setFocus({ comp: 0, sele: 'all' });
            /*
            if (!originalOritentationRef.current) return;
            stageRef.current.animationControls.orient(
              originalOritentationRef.current,
              DEFAULT_ORIENTATION_TRANSITION_DURATION,
            );
            */
          },
          get currentFrame() {
            if (!(pdbFile && trajectories.length)) return -1;
            try {
              return stageRef.current.compList[0].trajList[0].trajectory
                .currentFrame;
            } catch (_) {
              return -1;
            }
          },
          set currentFrame(value) {
            if (!(pdbFile && trajectories.length)) return;
            try {
              const total = this.totalFrames;
              let frame = value % total;
              if (frame < 0) frame = total - 1;
              stageRef.current.compList[0].trajList[0].trajectory.setFrame(
                frame,
              );
            } catch (_) {
              /* */
            }
          },
          get totalFrames() {
            if (!(pdbFile && trajectories.length)) return 1;
            try {
              return stageRef.current.compList[0].trajList[0].trajectory.frames
                .length;
            } catch (_) {
              return 1;
            }
          },
        }),
        [pdbFile, trajectories, handleResize],
      );

      // workaround to have multiple ref logic on one element
      // https://github.com/thebuilder/react-intersection-observer/issues/186#issuecomment-468641525
      const handleRef = node => {
        inViewRef(node);
        containerRef.current = node;
      };

      // Finally, render the ngl window
      return (
        <>
          <div
            ref={handleRef}
            className={cn(className, style.container, {
              [style['loading-pdb']]: loadingPDB,
              [style['loading-trajectory']]:
                !noTrajectory && trajectoryLoadingStatus,
              [style['light-theme']]: !darkBackground,
            })}
            // Display loading status data in the upper left corner of the NGL window
            data-loading={
              loadingPDB
                ? `Loading structure`
                : !pdbFile
                ? `No structure available`
                : trajectoryLoadingStatus
                ? `Loading ${
                    loadingPDB
                      ? 'structure'
                      : `trajectory (${Math.round(trajectoryProgress * 100)}%)`
                  }…`
                : !trajectories.length && !noTrajectory
                ? `No trajectory available`
                : stageRef.current && stageRef.current.tasks.count > 0
                ? `Rendering...`
                : undefined // Show nothing when everything was finished and fine
            }
          />
        </>
      );
    },
  ),
);

export default NGLViewer;
