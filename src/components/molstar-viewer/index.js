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

import getFrames from './get-frames';

import { ProjectCtx, PdbCtx } from '../../contexts';

//import { setTooltipPosition } from '../../utils/tooltip-position-manager';

import style from './style.module.css';

// To get frames
import { BASE_PATH_PROJECTS, MAIN_STRUCTURE_FILENAME } from '../../utils/constants';

// Used to just wait
import { sleep } from 'timing-functions';

import https from 'https-browserify';
import http from 'stream-http';
import url from 'url';

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

const DEFAULT_NUMBER_OF_FRAMES = 25;
//const DEFAULT_ORIENTATION_TRANSITION_DURATION = 750; // 750 ms

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

// Set the number of bytes per element in trajectory data
const BYTES_PER_COORDINATE = 4; // float 32
const COORDINATES_PER_ATOM = 3; // x, y and z
const BYTES_PER_ATOM = BYTES_PER_COORDINATE * COORDINATES_PER_ATOM;

// Set the NGL player speed limits
// The actual 'speed' input limits are 0-100
// The speed set as the time to wait before moving to the next frame in miliseconds
const minimumSpeed = 0;
const maximumSpeed = 100;
const slowestTimeout = 1000;
const fastestTimeout = 50;
const interpolateSpeed = speed => {
  return (
    slowestTimeout +
    (speed - minimumSpeed) *
      ((fastestTimeout - slowestTimeout) / (maximumSpeed - minimumSpeed))
  );
};

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
        onLoad,
        bounce = false, // Set if the animation, when finished, starts again (false) or goes back (true)
        requestedFramesNumber = DEFAULT_NUMBER_OF_FRAMES, // The number of frames to be represented
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
        // Hooked values for changing representation parameters
        drawingMethods,
        coloringMethods,
        opacities,
        components,
        showRepresentations,
        nglSelections,
        // Set the highlight representations types
        highlightTypes = defaultHighlightTypes,
      },
      ref,
    ) => {
      // Save the components object into a local constant which can be modified
      const comps = useMemo(() => components, [components]);

      // If no URL is provided then use the main trajectory // URL to find the trajectory data in the API
      // True when we just want to display a static structure // Requeste number of frames to display
      // data from context
      const {
        accession,
        accessionAndMdNumber,
        fileDescriptors,
        curatedOrientation,
        topology: topologyManager,
        references: referenceData,
      } = useContext(ProjectCtx);
      const { file: pdbDataFile } = useContext(PdbCtx);

      const [isFirstCompStaged, setIsFirstCompStaged] = useState(false);
      // The last automatic camera focus
      const [focus, setFocus] = useState(initialFocus);

      useMemo(() => {
        //console.log(initialFocus);
        setFocus(initialFocus);
      }, [initialFocus]);

      // references
      const parentRef = useRef(null);
      const molstarRef = useRef(null);
      const containerRef = useRef(null);
      const stageRef = useRef(null);
      const tooltipRef = useRef(null);
      const firstTime = useRef(true);

      // in-view hook
      const [inViewRef, isInView] = useInView();

      // Set the content of the tooltip in JSX format
      const [tooltipContent, setTooltipContent] = useState(null);

      // Save all http requests so we can abort them all in case the whole component is unmounted
      const currentRequests = useRef([]);

      // Download topologies ----------------------------------------------------------------------

      // Download all requested topologies: Each component may have a different structure URL.
      // Set the first component topology as the 'pdbData'
      // If a topologyURL is provided, download data form the API
      // Otherwise, use the main structure

      // Set a state to store the topology requests
      const [requestedTopologies, setRequestedTopologies] = useState([]);
      // Set also a state to track whenever there is still a downloading topology
      const [anyLoadingTopology, setAnyLoadingTopology] = useState(false);

      // Find if there are new topology to be requested in the components:
      // Collect the topology on each component
      // If the component has no topology specified use the main topology
      useMemo(() => {
        setRequestedTopologies(previousRequestedTopologies => {
          const newRequestedTopologies = [];
          comps.forEach(comp => {
            const url = comp.topologyURL || null;
            // Check if the url is new
            // Else, skip this url since it has been requested already
            const allRequestedTopologies = [
              ...previousRequestedTopologies,
              ...newRequestedTopologies,
            ];
            const current = allRequestedTopologies.find(topology => {
              return topology.url === url;
            });
            if (current) return;
            // Some urls may be missing
            // This happens when the component wants the default topology from the pdbData
            if (url === null) {
              // Add a request with null url in order to get pdbData as a topology
              // Do it only once for all components
              newRequestedTopologies.push({
                //url: null,
                //loading: false,
                // DANI: hardcodeo temporal
                url: `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/files/${MAIN_STRUCTURE_FILENAME}`,
                loading: true,
                requested: false,
                error: null,
              });
            } else {
              // Add the topology to the list, so it will be requested to the API
              newRequestedTopologies.push({
                url: url,
                loading: true,
                requested: false,
                error: null,
              });
              setAnyLoadingTopology(true);
            }
          });
          return [...previousRequestedTopologies, ...newRequestedTopologies];
        });
      }, [comps, setRequestedTopologies, accession]);

      // Set a state to store the downloaded topologies
      const [topologies, setTopologies] = useState([]);

      // Download all requested topologies from the API
      useEffect(() => {
        // Make an API request from each url
        requestedTopologies.forEach((requestedTopology, t) => {
          // Check if the requested url has the data already downloaded
          // If so, skip this request
          if (requestedTopology.file) return;
          // If the topology failed to load do not try it again
          if (requestedTopology.error) return;
          // If the topology has been already requested do not request it again
          if (requestedTopology.requested) return;
          // If there is no URL load the context pdbData
          if (requestedTopology.url === null) {
            // WARNING: The '[...previous]' is essential to make the array object change
            // This is important, since the 'topologies' object is used as a dependency further
            // And if we do not change the array then the change is not detected
            setTopologies(previous => {
              requestedTopology.loading = false;
              // Then check the loading state of all requested topologies and update the overall loading state
              const anyLoading = requestedTopologies.some(t => t.loading);
              setAnyLoadingTopology(anyLoading);
              // The topology with the pdb data has not url
              const topology = { url: null, file: pdbDataFile };
              return [...previous, topology];
            });
          }
          // If there is an URL
          else {
            requestedTopology.requested = true;
            // Request the API
            // http exception is added for local testing in http://localhost
            const getter =
              requestedTopology.url.substring(0, 5) === 'https'
                ? https.get
                : http.get;
            let file = '';
            const request = getter(
              url.parse(requestedTopology.url),
              response => {
                // Get the whole response and then add it to the topologies
                response
                  .on('data', chunk => {
                    file += chunk;
                  })
                  .on('end', () => {
                    setTopologies(previous => {
                      requestedTopology.loading = false;
                      // Then check the loading state of all requested topologies and update the overall loading state
                      const anyLoading = requestedTopologies.some(
                        t => t.loading,
                      );
                      setAnyLoadingTopology(anyLoading);
                      const topology = {
                        url: requestedTopology.url,
                        file: file,
                      };
                      return [...previous, topology];
                    });
                  })
                  .on('error', error => {
                    requestedTopology.loading = false;
                    // Then check the loading state of all requested topologies and update the overall loading state
                    const anyLoading = requestedTopologies.some(t => t.loading);
                    setAnyLoadingTopology(anyLoading);
                    requestedTopology.error = error;
                  });
              },
            );
            // Save the request out of here in case we have to abort it further
            currentRequests.current.push(request);
          }
        });
      }, [requestedTopologies, pdbDataFile]);

      // Set the pdbFile
      const pdbFile = useMemo(() => {
        const mainComponent = comps[0];
        const mainTopology = topologies.find(topology => {
          return topology.url === mainComponent.topologyURL;
        });
        const { file: pdbFile } = mainTopology || {
          loading: false,
          file: pdbDataFile,
        };
        return pdbFile;
      }, [comps, topologies, pdbDataFile]);

      // Download trajectories ------------------------------------------------------------------------------------------------

      // First we find all trajectory URLs (i.e. all requests to API)
      // Then we ask the API skipping repeated URLs

      // Set a function to modify an url by adding the frames range according to requestedFramesNumber
      // The only exception are those trajectories whose frame number is lower than requestedFramesNumber

      // Set a state to store requested trajectories and their loading status
      const [requestedTrajectories, setRequestedTrajectories] = useState([]);
      // Set also a state to track whenever there is still a downloading trajectory
      const [anyLoadingTrajectory, setAnyLoadingTrajectory] = useState(false);

      // Find if there are new trajectories to be requested in the components:
      // Collect trajectories on each component
      // If the component has no trajectory specified use the main trajectory
      // If the component is not the main component and has no frame specified, use the first frame
      // Only the main component (the first) is allowed to load multiple frames by the moment
      useMemo(() => {
        // Send a request to the API with the url of the rgyr analysis
        const { loading, payload, error } = fileDescriptors;
        // If we do not have file descritors yet then stop here
        if (loading) return;
        // Throw it in case something went wrong with the donwload
        else if (error) throw error;
        else if (!payload) throw new Error('Something bad happened with file descriptors');
        // Finally update the trajectories state
        setRequestedTrajectories(currentTrajectories => {
          // Save the new requetsed trajectories
          const newTrajectories = [];

          // Set the url to ask the API
          // Here, if you ask for the trajectory.bin instead of just trajectory, you get the whole file
          // This is because the only route of the API accepting frames selection is the "trajectory" endpoint
          // Other paths such as "trajectory.bin" will be processed as "/:files"
          const baseUrl = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/files/trajectory`;

          comps.forEach((comp, c) => {
            if (comp.onlyTopology) return;

            // Set the first component as the 'principal' component
            const isPrincipal = c === 0;
            const requestedFrame = comp.frame;

            // Get the trajectory urls
            // If the component has no trajectory url specified then use the main trajectory url alone
            let urls = comp.trajectoryURLs || [baseUrl];

            // Add the frames number of all the component requested trajectories
            comp.frameCount = 0;

            urls.forEach((url, u) => {
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

              // Get the file descriptor of the required trajectory
              const trajectoryFileDescriptor = payload.find(file => {
                return file.filename === trajectoryFilename;
              });
              if (!trajectoryFileDescriptor)
                throw new Error(
                  `Trajectory "${trajectoryFilename}" is missing`,
                );
              const trajectoryMetadata = trajectoryFileDescriptor.metadata;

              // Get the number of frames in the whole trajectory
              const trajectoryFrames = trajectoryMetadata.frames;

              // Set the number of frames to be requested from the whole trajectory
              let requestedFrames = requestedFramesNumber;
              if (requestedFramesNumber > trajectoryFrames)
                requestedFrames = trajectoryFrames;
              if (Number.isFinite(requestedFrame)) requestedFrames = 1;
              else if (framed) requestedFrames = framed.frames;
              // Components which are not the principal must include a 'frame' value
              else if (!isPrincipal && trajectoryFrames > 1)
                throw new Error(
                  `Only the main component is allowed to load multiple frames`,
                );

              // Frames are added to any url which is missing the frames range according to requestedFramesNumber
              // The only exception are those trajectories whose frame number is lower than requestedFramesNumber
              let finalUrl = url;
              // Get the expected number of frames returned, which may not be exactly the requested number
              let returnedFrames;
              // In case the url is already frammed
              if (framed) {
                // Find maximum number of frames to be returned (trajectory frames or requetsed frames)
                const maximumFrames = Math.min(trajectoryFrames, framed.end);
                returnedFrames = Math.ceil(maximumFrames / framed.step);
              }
              // Modify the url if it is not framed yet
              else {
                // Get the string frames range according to requestedFramesNumber
                const { range: framesRange, frames: framesCount } = getFrames(
                  trajectoryFrames,
                  requestedFrames,
                  requestedFrame,
                );
                returnedFrames = framesCount;

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
                  frames: returnedFrames,
                  // Add also the atoms number, which is used further
                  atoms: trajectoryMetadata.atoms,
                  loading: true,
                  requested: false,
                });
                setAnyLoadingTrajectory(true);
              }
            });
          });
          // In case there are new requested trajectories we return a new array to trigger dependencies
          if (newTrajectories.length > 0)
            return [...currentTrajectories, ...newTrajectories];
          // Otherwise we return the previous array to do no trigger dependencies
          return currentTrajectories;
        });
      }, [accession, comps, fileDescriptors, requestedFramesNumber]);

      // Set a state to store trajectories data
      const [trajectories, setTrajectories] = useState([]);

      // Set a function to update the current loading progress
      const updateLoadingProgress = useCallback(() => {
        const mainComp = comps[0];
        // Get all trajectories to be used as the current main trajecotry
        const mainTrajectories = [];
        // Get the current trajectories state using a trick
        // DANI: si intentas acceder a un state dentro de un callback te da el valor del state cuando se hizo el callback
        // DANI: Absurdo, pero es así, y esta es la forma de sortear el problema
        let trajectoriesState = [];
        setTrajectories(current => {
          trajectoriesState = current;
          return current;
        });
        mainComp.framedURLs.forEach(url => {
          const trajectory = trajectoriesState.find(trajectory => {
            return trajectory.url === url;
          });
          if (trajectory) mainTrajectories.push(trajectory);
        });
        if (mainTrajectories.length === 0) return;
        // Then calculate the average progress in all loading trajectories and update the progress state
        const overallFrames = mainTrajectories
          .map(trajectory => trajectory.frames)
          .reduce((a, b) => a + b, 0);
        const overallProgress =
          mainTrajectories
            .map(trajectory => trajectory.progress * trajectory.frames)
            .reduce((a, b) => a + b, 0) / overallFrames;
        onLoad(overallProgress);
      }, [comps, setTrajectories, onLoad]);

      // Download the requested trajectory data (frames)
      useEffect(() => {
        requestedTrajectories.forEach(trajectory => {
          // Check if the trajectory has been requested already
          // If so, skip this request
          if (trajectory && trajectory.requested) return;
          trajectory.requested = true;

          // Set the loading status as true
          trajectory.loading = true;
          trajectory.progress = 0;

          // Request the API
          // http exception is added for local testing in http://localhost
          const getter =
            trajectory.url.substring(0, 5) === 'https' ? https.get : http.get;
          const request = getter(url.parse(trajectory.url), response => {
            const totalBytes = response.headers['content-length'];
            // Set the new trajectory
            setTrajectories(previousTrajectories => {
              const newTrajectory = {
                url: trajectory.url,
                frames: trajectory.frames,
                atoms: trajectory.atoms,
                payload: new ArrayBuffer(0),
                progress: 0,
              };
              return [...previousTrajectories, newTrajectory];
            });
            // Track the amout of bytes already downloaded
            let byteCount = 0;
            response
              .on('data', chunk => {
                byteCount += chunk.byteLength;
                trajectory.progress = byteCount / totalBytes;
                // Update trajectories with the current partial data we have
                setTrajectories(previousTrajectories => {
                  const currentTrajectory = previousTrajectories.find(
                    t => t.url === trajectory.url,
                  );
                  currentTrajectory.payload = appendBuffer(
                    currentTrajectory.payload,
                    chunk,
                  );
                  currentTrajectory.progress = trajectory.progress;
                  return [...previousTrajectories];
                });
                updateLoadingProgress();
              })
              .on('end', () => {
                // Save the main data in the ref
                trajectory.loading = false;
                // Then check the loading state of all requested trajectories and update the overall loading state
                const anyLoading = requestedTrajectories.some(
                  trajectory => trajectory.loading,
                );
                setAnyLoadingTrajectory(anyLoading);
              });
          });
          currentRequests.current.push(request);
        });
      }, [requestedTrajectories, updateLoadingProgress]);

      // If the whole component is removed then abort all requests in case they were not finished
      // Note that this includes both topology and trajectory requests
      // DANI: No he verificado que esto funcione bien a nivel de API
      useEffect(() => {
        // I save it in a constant to avoid a non-sense warning
        const redundantList = currentRequests.current;
        return () => {
          redundantList.forEach(request => {
            request.abort();
          });
        };
      }, []);

      // Setup molstar
      useEffect(() => {
        // This wrapper function is the most correct way to call awaits inside a use effect
        const wrap = async () => {
          // Create the plugin
          molstarRef.current = await createPluginUI(
            parentRef.current,
            molstarSpec,
          );
          // console.log(molstarRef.current)
        };
        wrap();
        // Cleanup function
        return () => {
          if (molstarRef.current) {
            molstarRef.current.dispose();
            molstarRef.current = null;
          }
        };
      }, []);

      // Load topologies in molstar
      useEffect(() => {
        // Stop here if we are still loading topologies
        if (anyLoadingTopology) return;
        // Get the molstar reference
        const molstar = molstarRef.current;
        if (!molstar) return;
        // Load each topology
        topologies.forEach(async topology => {
          // Download and apply data
          const data = await molstar.builders.data.rawData(
            { data: topology.file } /* replace with your URL */,
            { state: { isGhost: true } },
          );
          // DANI: Aunque no llegues a 'aplicarla' acabas teniendo una trayectoria de una frame en la data
          const trajectory = await molstar.builders.structure.parseTrajectory(
            data,
            'pdb',
          );
          // WARNING: Do not modify this model
          // WARNING: Althought it should be the same model
          const model = await molstar.builders.structure.createModel(
            trajectory,
          );

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
          molstar.modelRef = model.ref;
        });
      }, [anyLoadingTopology, topologies]);

      // Load trajectories in molstar
      // Once the trajectories are downloaded, load them in corresponding NGL representations
      // Every time the trajectory payloads change this useEffect must be rerun
      useEffect(() => {
        // Get the molstar reference
        const molstar = molstarRef.current;
        if (!molstar) return;
        // If there must be no trajectory then stop here
        if (noTrajectory) return;
        // This wrapper function is the most correct way to call awaits inside a use effect
        const wrap = async () => {
          // Check if trajectories are
          if (!topologies || !trajectories || trajectories.length === 0) return;

          // If molstar or the main model are not set yet then we must wait
          if (!molstar || !molstar.modelRef) return;

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
                modelRef: molstar.modelRef,
                coordinatesRef: coords.ref,
              },
              { dependsOn: [molstar.modelRef, coords.ref] },
            )
            .commit();

          // Get the current trajectory model
          // From now on, this is the model to be modified and not the model in molstar.modelRef
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
      }, [topologies, trajectories, comps, noTrajectory]);

      // play/pause button effect
      useEffect(() => {
        // Get molstar
        // If it has not been yet initiated then stop here
        const molstar = molstarRef.current;
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
      }, [playing, isInView, noTrajectory, bounce]);

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
            if (!(isFirstCompStaged && requestedTrajectories.length)) return -1;
            try {
              return stageRef.current.compList[0].trajList[0].trajectory
                .currentFrame;
            } catch (_) {
              return -1;
            }
          },
          set currentFrame(value) {
            if (!(isFirstCompStaged && requestedTrajectories.length)) return;
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
            if (!(isFirstCompStaged && requestedTrajectories.length)) return 1;
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
        [isFirstCompStaged, requestedTrajectories, handleResize],
      );

      // workaround to have multiple ref logic on one element
      // https://github.com/thebuilder/react-intersection-observer/issues/186#issuecomment-468641525
      const handleRef = node => {
        inViewRef(node);
        parentRef.current = node;
      };

      // Finally, render the ngl window
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
            // Display loading status data in the upper left corner of the NGL window
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
