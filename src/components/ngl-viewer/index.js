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
} from '../../utils/topology-manager';

import style from './style.module.css';

// To get frames
import { BASE_PATH_PROJECTS } from '../../utils/constants';
import extractCounts from './extract-counts';
import axios from 'axios';

const DEFAULT_NUMBER_OF_FRAMES = 25;
const DEFAULT_ORIENTATION_TRANSITION_DURATION = 750; // 750 ms

const CHAIN_SELECTION = 'polymer and not hydrogen ';

const NGL_COLORS = ['red', 'blue', 'yellow', 'green'];

const NGLViewer = memo(
  forwardRef(
    (
      {
        trajectoryURL, // If no URL is provided then use the context pdbData (the 'md.imaged.rot.dry.pdb' file)
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
        initialFocus = { comp: 0, sele: CHAIN_SELECTION }, // The ngl selection to be focused by the camera initially
        darkBackground,
        perspective,
        speed,
        drawingMethods,
        coloringMethods,
        opacities,
        components,
        showRepresentations,
      },
      ref,
    ) => {
      // This is a workaround to include the 'components' object in useEffect hooks
      // The 'components' object is not a suitable dependency. It would re-render the hook all the time
      const componentsRef = JSON.stringify(components);

      // If no URL is provided then use the main trajectory (the 'md.imaged.rot.xtc' file) // URL to find the trajectory data in the API
      // True when we just want to display a static structure // Requeste number of frames to display
      // data from context
      const accession = useContext(AccessionCtx);
      const { metadata, curatedOrientation } = useContext(ProjectCtx);
      const pdbData = useContext(PdbCtx);

      // The last automatic camera focus
      const [focus, setFocus] = useState(initialFocus);
      // Track when the first focus has been performed
      const firstFocus = useRef(true);

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

      // Load all requested topologies: Each component may have a different structure URL.
      // Set the first component topology as the 'pdbData'
      // If a topologyURL is provided, download data form the API
      // Otherwise, use the context pdbData (i.e. the 'md.imaged.rot.dry.pdb' file)

      // Memoize the topolgy URLs into an array
      const topologyURLs = useMemo(() => {
        const comps = JSON.parse(componentsRef);
        return comps.map(comp => comp.topologyURL);
      }, [componentsRef]);

      /*
      const topologies = useNGLFiles(topologyURLs,
        {
          defaultRepresentation: false,
          ext: 'pdb',
        },
        pdbData.file);
        */
      const [topologies, setTopologies] = useState(
        topologyURLs.map(url => ({
          loading: true,
          file: null,
          error: null,
        })),
      );

      // Load all requested topologies from the API
      // WARNING: The '[...previous]' is essential to make the array object change
      // This is important, since the 'topologies' object is used as a dependendy further
      // And if we do not change the array then the change is not detected
      useEffect(() => {
        if (!topologyURLs) return;
        let didCancel = false;
        // Make an API request fro each url
        topologyURLs.forEach((url, i) => {
          // If there is no URL load the context pdbData
          if (!url)
            setTopologies(previous => {
              const current = previous[i];
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
                    const current = previous[i];
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
                    const current = previous[i];
                    current.loading = false;
                    current.error = error;
                    return [...previous];
                  }),
              );
          }
        });
        return () => (didCancel = true);
      }, [topologyURLs, pdbData]);

      const loadingTopologies = topologies.some(t => t.loading);
      const mainTopology = loadingTopologies
        ? { loading: true, file: null }
        : topologies[0];
      const { loading: loadingPDB, file: pdbFile } = mainTopology;

      const isProjection = Number.isFinite(projection);

      // Set variable to store trajectory data and loading status
      const trajectoryRef = useRef({
        payload: [],
        frameCount: [],
        loading: [],
      });

      // Hook for the trajectory data (frames)
      useEffect(
        () => {
          // Set the url to ask the API
          // Here, if you ask for the trajectory.bin instead of just trajectory, you get the whole file
          // This is because the only route of the API accepting frames selection is the "trajectory" endpoint
          // Other paths such as "trajectory.bin" will be processed as "/:files"
          const baseUrl = trajectoryURL
            ? trajectoryURL
            : `${BASE_PATH_PROJECTS}${accession}/files/trajectory`;

          // Ask the API through axios (https://www.npmjs.com/package/axios)
          // Some extra load features are passed through axios
          // Set a cancel 'token'
          const source = axios.CancelToken.source();
          let didCancel = false;

          // Convert the JSON reference back into the 'components' object
          const comps = JSON.parse(componentsRef);

          comps.forEach((comp, index) => {
            if (comp.onlyTopology) return;
            // DANI: Por si acaso algun otro componente no tiene 'frame'
            // DANI: Esto ahora no tendría sentido porque no se podría controlar la trayectoria
            if (index > 0 && comp.frame === undefined) {
              console.error(
                'Only the first component is allowed to load the trajectory',
              );
              comp.frame = 0;
            }
            // Save the number of frames asked when the load starts
            const frameCount = comp.frame ? 1 : nFrames;
            // Get the frames to be loaded in a standarized string format for the API
            const frames = getFrames(
              isProjection,
              metadata,
              frameCount,
              noTrajectory,
              comp.frame,
            );

            // Add the frame selection
            const url = frames ? baseUrl + `?frames=${frames}` : baseUrl;
            //const url = frames ? baseUrl + `?frames=1:1668:3` : baseUrl;
            //console.log(url);

            // Set the loading status as true
            trajectoryRef.current.loading[index] = true;

            trajectoryRef.current.progress = 0;
            // Set a function to track the download progress
            const onDownloadProgress = progressEvent => {
              // Check if progress is measurable. If so, mesure it.
              if (progressEvent.lengthComputable)
                trajectoryRef.current.progress =
                  progressEvent.loaded / progressEvent.total;
            };

            // Send a request to the API in a Promise/await manner
            axios(url, {
              cancelToken: source.token,
              onDownloadProgress,
              responseType: 'arraybuffer',
            })
              // If the request has succeed
              .then(response => {
                if (didCancel) return;
                // 'counts' include the number of atoms and the real number of frames
                trajectoryRef.current.counts = extractCounts(response);
                // Save inside the ref
                trajectoryRef.current.frameCount = parseInt(frameCount);
                trajectoryRef.current.payload[index] = response.data;
                trajectoryRef.current.loading[index] = false;
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
        },
        // Dependencies
        [
          trajectoryURL,
          projection,
          isProjection,
          metadata,
          noTrajectory,
          nFrames,
          accession,
          componentsRef,
        ],
      );
      const trajectoryLoadingStatus = [...trajectoryRef.current.loading].some(
        l => l === true,
      );
      const trajectoryPayload = trajectoryRef.current.payload;
      const trajectoryProgress = trajectoryRef.current.progress;
      const trajectoryFrames = trajectoryRef.current.frameCount;
      const trajectoryAtoms = trajectoryRef.current.counts
        ? trajectoryRef.current.counts.atoms
        : undefined;

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
      // Track when these representations are updated
      // The 'updater' is used to reload trajectory data into the representations when they are reseted
      //const [updater, toggler] = useToggleState(false);
      useEffect(() => {
        // If there is already a component then toggle
        //if (stageRef.current.compList.length > 0) toggler();

        // Keep the count of each representation in each component
        // (i.e. it is not the same that any iteration index)
        let repCounter = 0;

        // Convert the JSON reference back into the 'components' object
        const comps = JSON.parse(componentsRef);

        if (!pdbFile) return;
        // Atom occupancy is a field which is not used anywhere but in the electrostatic representation
        // The electrostatic surface scheme color does not work if the occupancy is 0 (ngl code, not ours)
        // We set all occupancies to 1, since some topologies may have all occupancies as 0 by default
        pdbFile.atomStore.occupancy = new Array(
          pdbFile.atomStore.occupancy.length,
        ).fill(1);

        if (loadingTopologies) return;

        comps.forEach((comp, c) => {
          // Set the NGL component
          let stageComp = stageRef.current.compList[c];
          if (!stageComp) {
            const topology = topologies[c];
            if (!topology.file) {
              console.error(
                `The topology file (${comp.topologyURL}) is missing with error: ${topology.error}`,
              );
              return;
            }
            stageRef.current.addComponentFromObject(topology.file);
            stageComp = stageRef.current.compList[c];
            stageComp.onlyTopology = comp.onlyTopology;
          }

          // Set each representation
          comp.representations.forEach((rep, r) => {
            const show =
              !showRepresentations || showRepresentations[repCounter];
            // Adapt a few representation values to the context
            const opacity = show ? opacities[repCounter] : 0;

            // If the colorScheme is a defined color, create a custom colorScheme for this color
            const colorScheme =
              rep.name === selectedRepresentation
                ? ColormakerRegistry.addSelectionScheme(
                    [['yellow', 'all']],
                    'custom label',
                  )
                : NGL_COLORS.includes(coloringMethods[repCounter])
                ? ColormakerRegistry.addSelectionScheme(
                    [[coloringMethods[repCounter], 'all']],
                    'custom label',
                  )
                : coloringMethods[repCounter];

            const colorDomain =
              drawingMethods[repCounter] === 'surface'
                ? [-200, 200]
                : undefined;

            const surfaceType =
              drawingMethods[repCounter] === 'surface' ? 'av' : undefined;

            // Find the previous representation
            const previousRepresentation = stageComp.reprList.find(
              previous => previous.name === rep.name,
            );
            // Update the previous representation if exists
            if (previousRepresentation) {
              const type = previousRepresentation.repr.type;
              // If the 'drawingMethod' has been changed we have to remake the whole representation
              if (type !== drawingMethods[repCounter]) {
                stageComp.removeRepresentation(previousRepresentation);
                stageComp.addRepresentation(drawingMethods[repCounter], {
                  sele: rep.selection,
                  name: rep.name,
                  opacity: opacity,
                  colorScheme: colorScheme,
                  colorDomain: colorDomain,
                  surfaceType: surfaceType,
                  ...rep.other,
                });
              }
              // Otherwise it is faster just to update the parameters
              else {
                previousRepresentation.setParameters({
                  sele: rep.selection,
                  name: rep.name,
                  opacity: opacity,
                  colorScheme: colorScheme,
                  colorDomain: colorDomain,
                  surfaceType: surfaceType,
                  ...rep.other,
                });
              }
            }
            // If there is no previous representation then set a new one
            else {
              stageComp.addRepresentation(drawingMethods[repCounter], {
                sele: rep.selection,
                name: rep.name,
                opacity: opacity,
                colorScheme: colorScheme,
                colorDomain: colorDomain,
                surfaceType: surfaceType,
                ...rep.other,
              });
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
                  console.log('eliminando ' + name);
                  stageComp.removeAnnotation(previous);
                }
              }
            }

            // Set this representation as the focus if it is selected
            if (rep.name === selectedRepresentation) {
              setFocus({ comp: c, sele: rep.selection });
            }

            repCounter += 1;
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
        });
      }, [
        pdbFile,
        isProjection,
        //components,
        componentsRef,
        drawingMethods,
        // We make eslint keep quiet or it complains about using spread syntax in the dependencies
        // eslint-disable-next-line react-hooks/exhaustive-deps
        ...drawingMethods,
        coloringMethods,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        ...coloringMethods,
        opacities,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        ...opacities,
        //toggler,
        loadingTopologies,
        topologies,
        selectedRepresentation,
        showRepresentations,
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
        const nameHighlight = 'highlighted';
        const previousHighlightRepresentation = stageRef.current.compList[0].reprList.find(
          representation => representation.name === nameHighlight,
        );
        if (previousHighlightRepresentation) {
          stageRef.current.compList[0].removeRepresentation(
            previousHighlightRepresentation,
          );
        }

        // Name for residues representation
        const nameContext = 'context';
        const previousContextRepresentation = stageRef.current.compList[0].reprList.find(
          representation => representation.name === nameContext,
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
              // 'atoms' are in abolsute numeration
              atomsNumber =>
                absolute2sourceResidue(
                  getAtomResidue(atomsNumber, pdbFile),
                  pdbFile,
                ).nglSelection,
            ),
          ),
        ).join(' or ');

        stageRef.current.compList[0].addRepresentation('ball+stick', {
          sele: seleContext,
          name: nameContext,
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
        const nameHighlight = 'highlightedResidues';
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
        const nameHighlight = 'highlightedChains';
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
        const nameHighlight = 'highlightedCustom';
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
        const name = 'distance';
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
        const name = 'angles';
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
      // Once the trajectory is loaded, introduce it into the representation
      useEffect(() => {
        let frames = [];

        trajectoryPayload.forEach((payload, index) => {
          const component = stageRef.current.compList[index];
          if (!component) return;
          if (component.onlyTopology) return;
          //console.log(component);

          // remove all possibly already existing trajectories
          // This return an error in console: "updateStructure: traj disposed"
          // This may be a bug but it is actually working
          // See https://github.com/arose/ngl/issues/680
          component.trajList.forEach(
            component.removeTrajectory.bind(component),
          );

          const file = payloadToNGLFile(
            pdbFile,
            payload,
            trajectoryAtoms,
            trajectoryFrames,
            isProjection,
          );

          if (file) {
            frames[index] = component.addTrajectory(file);
            //console.log(frames[index]);
            frames[index].signals.frameChanged.add(handleFrameChange);
            frames[index].trajectory.setFrame(0);
          }
        });

        return () =>
          frames.forEach(frame =>
            frame.signals.frameChanged.remove(handleFrameChange),
          );
      }, [
        pdbFile,
        trajectoryPayload,
        trajectoryAtoms,
        trajectoryFrames,
        handleFrameChange,
        isProjection,
        //updater, // For when representations are reseted
      ]);

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
        if (!(pdbFile && trajectoryPayload.length)) return;
        handleResize();
        return handleResize.cancel;
      }, [pdbFile, trajectoryPayload, handleResize]);

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
          let offset = 0;
          let highlight = '';
          const addOffsetMappingFn = item => +item + offset;
          for (const manager of document.querySelectorAll(
            'protvista-manager',
          )) {
            // get highlight value for each manager
            const thisHiglight = manager.attributeValues.get('highlight');
            const nextOffset = offset + +manager.dataset.chainLength;
            if (!thisHiglight) {
              // if none, escape
              offset = nextOffset;
              continue;
            }
            // Start and end values are in absolute numeration + 1
            // DANI: No se en que parte del código se establecen estos valores
            // DANI: Habría que mirar si se pueden estandarizar como numeración asboluta
            // DANI: De esa manera no habría que hacer el -1 más abajo, que queda muy feo.
            const [start, end] = thisHiglight
              .split(':')
              .map(addOffsetMappingFn);
            const sourceStart = absolute2sourceResidue(start - 1, pdbFile);
            const sourceEnd = absolute2sourceResidue(end - 1, pdbFile);
            if (sourceStart.chain !== sourceEnd.chain)
              throw new Error(`Range from multiple chains is not supported`);
            highlight += ` or :${sourceStart.chain} and ${sourceStart.residueNumber}-${sourceEnd.residueNumber}`;
            offset = nextOffset;
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
            stageRef.current.animationControls.orient(
              originalOritentationRef.current,
              DEFAULT_ORIENTATION_TRANSITION_DURATION,
            );
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
          zIndex: 10,
          pointerEvents: 'none',
          backgroundColor: 'rgba( 0, 0, 0, 0.6 )',
          color: 'lightgrey',
          padding: '8px',
          fontFamily: 'sans-serif',
        });
        document.body.appendChild(tooltip);

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
            const mp = pickingProxy.mouse.position;
            tooltip.style.bottom = window.innerHeight - mp.y + 3 + 'px';
            tooltip.style.left = mp.x + 3 + 'px';
            tooltip.style.display = 'block';
          } else {
            tooltip.style.display = 'none';
          }
        });
        // Cleaning function
        return () => tooltip.remove();
      }, [pdbFile, metadata, metadata.CHAINNAMES]);

      // Focus the specified ngl selection with the camera automatically
      useEffect(() => {
        const comp = stageRef.current.compList[focus.comp];
        if (!comp) return;
        let transition = DEFAULT_ORIENTATION_TRANSITION_DURATION;
        // First transition is instantaneous
        if (firstFocus.current) {
          transition = 0;
          firstFocus.current = false;
        }
        comp.autoView(focus.sele, transition);
      }, [focus.comp, focus.sele]);

      // Expose public methods and getters/setters
      useImperativeHandle(
        ref,
        () => ({
          autoResize: handleResize,
          centerFocus() {
            if (!originalOritentationRef.current) return;
            stageRef.current.animationControls.orient(
              originalOritentationRef.current,
              DEFAULT_ORIENTATION_TRANSITION_DURATION,
            );
          },
          get currentFrame() {
            if (!(pdbFile && trajectoryPayload.length)) return -1;
            try {
              return stageRef.current.compList[0].trajList[0].trajectory
                .currentFrame;
            } catch (_) {
              return -1;
            }
          },
          set currentFrame(value) {
            if (!(pdbFile && trajectoryPayload.length)) return;
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
            if (!(pdbFile && trajectoryPayload.length)) return 1;
            try {
              return stageRef.current.compList[0].trajList[0].trajectory.frames
                .length;
            } catch (_) {
              return 1;
            }
          },
        }),
        [pdbFile, trajectoryPayload, handleResize],
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
                : !trajectoryPayload.length && !noTrajectory
                ? `No trajectory available`
                : // Show nothing when everything was finished and fine
                stageRef.current && stageRef.current.tasks.count > 0
                ? `Rendering...`
                : undefined
            }
          />
        </>
      );
    },
  ),
);

export default NGLViewer;
