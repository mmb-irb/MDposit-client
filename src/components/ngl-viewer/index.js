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
import { clamp } from 'lodash-es';
import cn from 'classnames';
import { autoLoad, Stage, ColormakerRegistry, Matrix4 } from 'ngl';

import { frame } from 'timing-functions';

import { setNGLFile, updateNGLFile } from './payload-to-ngl-file';
import getFrames from './get-frames';

import { ProjectCtx, PdbCtx } from '../../contexts';

import { setTooltipPosition } from '../../utils/tooltip-position-manager';

import style from './style.module.css';

// To get frames
import { BASE_PATH_PROJECTS } from '../../utils/constants';

// Make a deep copy of an object even with cyclic references
import { cloneDeep } from 'lodash-es';

// Used to just wait
import { sleep } from 'timing-functions';

import https from 'https-browserify';
import http from 'stream-http';
import url from 'url';

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

// Set the number of bytes per element in trajectory data
const BYTES_PER_COORDINATE = 4; // float 32
const COORDINATES_PER_ATOM = 3; // x, y and z
const BYTES_PER_ATOM = BYTES_PER_COORDINATE * COORDINATES_PER_ATOM;

// Set the NGL player speed limits
// The actual 'currentSpeed' input limits are 0-100
// The speed set as the time to wait before moving to the next frame in miliseconds
const minimumSpeed = 0;
const maximumSpeed = 100;
const slowestTimeout = 1000;
const fastestTimeout = 50;
const interpolateSpeed = currentSpeed => {
  return (
    slowestTimeout +
    (currentSpeed - minimumSpeed) *
      ((fastestTimeout - slowestTimeout) / (maximumSpeed - minimumSpeed))
  );
};

const defaultHighlightTypes = {
  atoms: 'spacefill',
  residues: 'ball+stick',
  chains: 'ball+stick',
  selections: 'ball+stick',
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

      // If no URL is provided then use the main trajectory (the 'md.imaged.rot.xtc' file) // URL to find the trajectory data in the API
      // True when we just want to display a static structure // Requeste number of frames to display
      // data from context
      const {
        accession,
        files,
        curatedOrientation,
        topology: topologyManager,
        references: referenceData,
      } = useContext(ProjectCtx);
      const { file: pdbDataFile } = useContext(PdbCtx);

      const [isFirstCompStaged, setIsFirstCompStaged] = useState(false);
      const [isMainTrajectoryStaged, setIsMainTrajectoryStaged] = useState(
        false,
      );
      // The last automatic camera focus
      const [focus, setFocus] = useState(initialFocus);

      useMemo(() => {
        //console.log(initialFocus);
        setFocus(initialFocus);
      }, [initialFocus]);

      // references
      const containerRef = useRef(null);
      const stageRef = useRef(null);
      const tooltipRef = useRef(null);
      const firstTime = useRef(true);
      // curatedOrientation might be null
      const originalOritentationRef = useRef(
        curatedOrientation ? new Matrix4().set(...curatedOrientation) : null,
      );

      // in-view hook
      const [inViewRef, isInView] = useInView();

      // Set the content of the tooltip in JSX format
      const [tooltipContent, setTooltipContent] = useState(null);

      // Download topologies ----------------------------------------------------------------------

      // Download all requested topologies: Each component may have a different structure URL.
      // Set the first component topology as the 'pdbData'
      // If a topologyURL is provided, download data form the API
      // Otherwise, use the context pdbData (i.e. the 'md.imaged.rot.dry.pdb' file)

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
                url: null,
                loading: false,
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
      }, [comps, setRequestedTopologies]);

      // Set a state to store the downloaded topologies
      const [topologies, setTopologies] = useState([]);

      // Download all requested topologies from the API
      useEffect(() => {
        let didCancel = false;
        // Make an API request from each url
        requestedTopologies.forEach((requestedTopology, t) => {
          // Check if the requested url has the data already downloaded
          // If so, skip this request
          if (requestedTopology.file) return;
          // If the topology failed to load do not try it again
          if (requestedTopology.error) return;
          // If the topology has been already requested do not request it again
          if (requestedTopology.requested) return;
          // Get the topology URL
          const url = requestedTopology.url;
          // If there is no URL load the context pdbData
          if (url === null) {
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
            // 'autoLoad' is the built in function from NGL to load data
            autoLoad(url, { defaultRepresentation: false, ext: 'pdb' })
              // If the request was sucessful
              .then(
                file =>
                  !didCancel &&
                  setTopologies(previous => {
                    requestedTopology.loading = false;
                    // Then check the loading state of all requested topologies and update the overall loading state
                    const anyLoading = requestedTopologies.some(t => t.loading);
                    setAnyLoadingTopology(anyLoading);
                    const topology = { url: url, file: file };
                    return [...previous, topology];
                  }),
              )
              // If the request failed
              .catch(error => {
                if (didCancel) return;
                requestedTopology.loading = false;
                // Then check the loading state of all requested topologies and update the overall loading state
                const anyLoading = requestedTopologies.some(t => t.loading);
                setAnyLoadingTopology(anyLoading);
                requestedTopology.error = error;
              });
          }
        });
        return () => (didCancel = true);
      }, [requestedTopologies, pdbDataFile]);

      const mainComponent = comps[0];
      const mainTopology = topologies.find(topology => {
        return topology.url === mainComponent.topologyURL;
      });
      const { file: pdbFile } = mainTopology || {
        loading: false,
        file: pdbDataFile,
      };

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
        // Finally update the trajectories state
        setRequestedTrajectories(currentTrajectories => {
          // Save the new requetsed trajectories
          const newTrajectories = [];

          // Set the url to ask the API
          // Here, if you ask for the trajectory.bin instead of just trajectory, you get the whole file
          // This is because the only route of the API accepting frames selection is the "trajectory" endpoint
          // Other paths such as "trajectory.bin" will be processed as "/:files"
          const baseUrl = `${BASE_PATH_PROJECTS}${accession}/files/trajectory`;

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

              // Get the 'files' summary of the required trajectory
              const trajectoryFile = files.find(file => {
                return file.filename === trajectoryFilename;
              });
              if (!trajectoryFile)
                throw new Error(
                  `Trajectory "${trajectoryFilename}" is missing`,
                );
              const trajectoryMetadata = trajectoryFile.metadata;

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
      }, [accession, comps, files, requestedFramesNumber]);

      // Set a state to store trajectories data
      const [trajectories, setTrajectories] = useState([]);
      const currentRequests = useRef([]);

      // Set a function to update the current loading progress
      const updateLoadingProgress = useCallback(
        currentTrajectories => {
          const mainComp = comps[0];
          // Get all trajectories to be used as the current main trajecotry
          const mainTrajectories = [];
          mainComp.framedURLs.forEach(url => {
            const trajectory = currentTrajectories.find(trajectory => {
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
        },
        [comps, onLoad],
      );

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
                  // Update the current progess
                  updateLoadingProgress(previousTrajectories);
                  return [...previousTrajectories];
                });
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
        const stage = new Stage(containerRef.current);
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
          stageRef.current.dispose();
          stageRef.current = null;
        };
      }, []);

      // Handle the upper left corner viewer logs
      const viewerLogs = useMemo(() => {
        if (!isFirstCompStaged) return `Loading structure`;
        if (!pdbFile) return `No structure available`;
        if (!requestedTrajectories.length && !noTrajectory)
          return `No trajectory available`;
        if (runningTasks > 0) return `Rendering...`;
        return undefined; // Show nothing when everything was finished and fine
      }, [
        isFirstCompStaged,
        pdbFile,
        requestedTrajectories,
        noTrajectory,
        runningTasks,
      ]);

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
          //console.log('FRAME: ' + frame);
          if (!onProgress) return;
          if (noTrajectory) return;
          if (!isFirstCompStaged) return;
          if (!stageRef.current.compList[0].trajList[0]) return;
          const frameCount =
            stageRef.current.compList[0].trajList[0].expectedFrames;
          //console.log('NGL frameCount: ' + frameCount);
          const progress = clamp(frame / (frameCount - 1), 0, 1);
          onProgress(progress);
        },
        [isFirstCompStaged, noTrajectory, onProgress],
      );

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
        if (anyLoadingTopology) return;

        comps.forEach((comp, c) => {
          // Set the NGL component
          let stageComp = stageRef.current.compList[c];
          if (!stageComp) {
            // Find the topology which matches the component url
            // If a component has no url it will match a topology with no url: the default topology
            const url = comp.topologyURL || null;
            const topology = topologies.find(topology => {
              return topology.url === url;
            });
            // If the topology has not been loaded yet then we have a problem
            // DANI: Todas las topologías deben estar ya listas antes de cargarlas, lee los mensajes de arriba
            if (!topology) return;
            // Stop here if it is not downloaded yet
            if (topology.error)
              throw new Error(
                `Topology from '${url}' returned error ${topology.error}`,
              );
            if (!topology.file)
              throw new Error(`Topology data from '${url}' is missing`);
            // Add the topology to the NGL
            // Make a deep copy of the topology object to prevent NGL internal bugs
            // This object will store data which is component exclusive
            const componentObject = cloneDeep(topology.file);
            //const componentObject = topology.file;
            stageRef.current.addComponentFromObject(componentObject);
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
            const index = rep.index;

            const show = !showRepresentations || showRepresentations[index];

            const sele = nglSelections[index];

            const type = drawingMethods[index];

            const customColorScheme = rep.customScheme;

            const colorScheme =
              rep.name === selectedRepresentation
                ? // If the representation is selected then the color is yellow
                  ColormakerRegistry.addSelectionScheme(
                    [['yellow', 'all']],
                    'custom label',
                  )
                : // If the colorScheme is in the passed custom schemes use it
                customColorScheme && coloringMethods[index] === 'custom'
                ? customColorScheme
                : // If the colorScheme is a defined color, create a custom colorScheme for this color
                isValidColor(coloringMethods[index])
                ? ColormakerRegistry.addSelectionScheme(
                    [[coloringMethods[index], 'all']],
                    'custom label',
                  )
                : // Otherwise let the color scheme as it is
                  coloringMethods[index];

            const colorDomain = type === 'surface' ? [-200, 200] : undefined;

            const surfaceType = type === 'surface' ? 'av' : undefined;

            const opacity = show ? opacities[index] : 0;

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
              const name = rep.label + '-' + index;
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
        pdbFile,
        comps,
        drawingMethods,
        coloringMethods,
        opacities,
        anyLoadingTopology,
        topologies,
        selectedRepresentation,
        showRepresentations,
        nglSelections,
      ]);

      // Highlight specific atoms
      useEffect(() => {
        // DANI: He tenido que quitar la condicion de 'instanceof Set' porque sino no me entraba en el heatmap
        //if (!pdbFile || !(selectedAtoms instanceof Set) || !(selectedAtoms)) {
        if (!isFirstCompStaged || !selectedAtoms) {
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
        const seleHighlight = `@${atoms.map(atomIndex => atomIndex).join(',')}`;

        stageRef.current.compList[0].addRepresentation(highlightTypes.atoms, {
          sele: seleHighlight,
          opacity: 0.5,
          scale: 1.5,
          name: nameHighlight,
        });

        const otherResidueAtomsSelection = Array.from(
          new Set(
            // 'atoms' are in abolsute numeration
            atoms.map(atomIndex => {
              const residueIndex = topologyManager.getAtomResidueIndex(
                atomIndex,
              );
              const atomIndices = topologyManager.getResidueAtoms(residueIndex);
              const nglAtomSelection = '@' + atomIndices.join(',');
              return nglAtomSelection;
            }),
          ),
        ).join(' or ');

        stageRef.current.compList[0].addRepresentation(
          highlightTypes.residues,
          {
            sele: otherResidueAtomsSelection,
            name: nameContextHighlight,
          },
        );

        // Focus the highlighted zone with the camera
        setFocus({ comp: 0, sele: otherResidueAtomsSelection });
      }, [
        isFirstCompStaged,
        topologyManager,
        selectedAtoms,
        darkBackground,
        highlightTypes,
      ]);

      // Highlight specific residues
      useEffect(() => {
        if (!isFirstCompStaged || !selectedResidueIndices) return;
        // Set a representation name. This is useful to find this representation further
        const nameHighlight = '*highlightedResidues';
        const previousHighlightRepresentation = stageRef.current.compList[0].reprList.find(
          representation => representation.name === nameHighlight,
        );
        if (previousHighlightRepresentation)
          stageRef.current.compList[0].removeRepresentation(
            previousHighlightRepresentation,
          );
        // If there are no selected residues at all we stop here
        if (selectedResidueIndices.length === 0) return;
        // Get the residues input
        const residueNglSelections = selectedResidueIndices.map(
          residueIndex =>
            topologyManager.absolute2sourceResidue(residueIndex).nglSelection,
        );
        // Transform the residues list into an NGL selection
        const overallNglSelection = Array.from(
          new Set(residueNglSelections),
        ).join(' or ');
        // Represent the previous selection in ball+sticks drawing method
        stageRef.current.compList[0].addRepresentation(
          highlightTypes.residues,
          {
            sele: overallNglSelection,
            name: nameHighlight,
          },
        );

        // Focus the highlighted zone with the camera
        setFocus({ comp: 0, sele: overallNglSelection });
      }, [
        isFirstCompStaged,
        selectedResidueIndices,
        topologyManager,
        highlightTypes,
      ]);

      // Highlight specific chains
      // DANI: NO Probado
      useEffect(() => {
        if (!isFirstCompStaged || !selectedChains) {
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
        stageRef.current.compList[0].addRepresentation(highlightTypes.chains, {
          sele: nglSelection,
          name: nameHighlight,
        });
        // Focus the highlighted zone with the camera
        setFocus({ comp: 0, sele: nglSelection });
      }, [isFirstCompStaged, selectedChains, highlightTypes]);

      // Highlight specific free NGL selections
      useEffect(() => {
        if (!isFirstCompStaged || !snapRepresentations) return;
        const currentComponent = stageRef.current.compList[0];
        const currentRepresentations = currentComponent.reprList;
        snapRepresentations.forEach(snapRepresentation => {
          currentComponent.addRepresentation(snapRepresentation.type, {
            sele: snapRepresentation.selection,
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
              currentComponent.removeRepresentation(previousSnapRepresentation);
          });
        };
      }, [isFirstCompStaged, snapRepresentations]);

      // Add specific NGL representations which are added or removed apart from the main component
      // They are faster to update but they are not shown in the representations manager
      useEffect(() => {
        if (!isFirstCompStaged || !selectedCustom) {
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
        stageRef.current.compList[0].addRepresentation(
          highlightTypes.selections,
          {
            sele: nglSelection,
            name: nameHighlight,
          },
        );
        // Focus the highlighted zone with the camera
        setFocus({ comp: 0, sele: nglSelection });
      }, [isFirstCompStaged, selectedCustom, highlightTypes]);

      // Highlight specific distances
      // When 'selectedDistances' is numeric it is taken as atoms
      // When 'selectedDistances' is string it is taken as residues
      // In both cases it works with absolute numeration
      useEffect(() => {
        if (!isFirstCompStaged || !selectedDistances) {
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
      }, [isFirstCompStaged, selectedDistances, darkBackground]);

      // Highlight specific angles
      useEffect(() => {
        if (!isFirstCompStaged || !selectedAngles) {
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
      }, [isFirstCompStaged, selectedAngles, darkBackground]);

      const [mainNglFile, setMainNglFile] = useState(null);

      // DCD file, trajectory
      // Once the trajectories are downloaded, load them in corresponding NGL representations
      // Every time the trajectory payloads change this useEffect must be rerun
      useEffect(() => {
        // Check if trajectories are
        if (!topologies || !trajectories || trajectories.length === 0) return;

        let frames = [];
        // Save the trajectory player to setup the celanup function at the end of this useEffect
        let trajectoryPlayer;

        comps.forEach((comp, c) => {
          // Find the topology which matches the component url
          // If a component has no url it will match a topology with no url: the default topology
          const url = comp.topologyURL || null;
          const topology = topologies.find(topology => {
            return topology.url === url;
          });
          const stageComp = stageRef.current.compList[c];
          // Wait if the topology has not been loaded yet
          if (!stageComp) return;
          // Abort if the component is marked as 'only topology'
          if (stageComp.onlyTopology) return;

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
          for (const url of comp.framedURLs) {
            const trajectory = trajectories.find(trajectory => {
              return trajectory.url === url;
            });
            // If the trajectory is not downloaded yet then exit
            if (!trajectory) return;

            // Get atom counts from different trajectories and check they match
            if (!trajectoryAtoms) trajectoryAtoms = trajectory.atoms;
            if (trajectoryAtoms !== trajectory.atoms)
              throw new Error(
                `Atoms number in the different trajectories do not match`,
              );
            // Add the final expected frames for all frames in the component
            trajectoryFinalExpectedFrames += trajectory.frames;
            // Add the main data to the array of payloads
            // Substract data from not completed frames
            const payload = trajectory.payload;
            const bytesPerFrame = trajectoryAtoms * BYTES_PER_ATOM;
            const fitLength =
              Math.floor(payload.byteLength / bytesPerFrame) * bytesPerFrame;
            const fitPayload = payload.slice(0, fitLength);
            trajectoryPayloads.push(fitPayload);
            combinedURL += url;
            combinedProgress += '/' + trajectory.progress;
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
          let totalPayload;
          if (trajectoryPayloads.length === 1)
            totalPayload = trajectoryPayloads[0];
          // DANI: Esto no está bien ahora que hay streaming
          // DANI: Si hubiese dos trayectorias combinadas sus frames quedarían entrelazadas
          // DANI: Pero las trayectorias combinadas no se usan, así que no me merece la pena mantenerlo
          else
            totalPayload = trajectoryPayloads.reduce((cb, nb) =>
              appendBuffer(cb, nb),
            );
          // If the total payload is empty then stop here
          if (totalPayload.byteLength === 0) return;
          // Calculate how many frames are there in total
          const bytesPerFrame = trajectoryAtoms * BYTES_PER_ATOM;
          const totalFrames = totalPayload.byteLength / bytesPerFrame;
          const lastFrameIndex = totalFrames - 1;
          // Check if all required data is already downloaded
          const completedTrajectory =
            totalFrames === trajectoryFinalExpectedFrames;

          // Get the atom indices whom the trajectory coordinates belong to, in case it is passed
          const trajectoryAtomIndices = comp.trajectoryAtomIndices;

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
                if (currentFrame < endingFrame) {
                  nglPlayer.play();
                }
              }
            }
            // Save the trajectory player
            trajectoryPlayer = nglTrajectory.player;
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
            );
            if (!file) return;
            const nglFile = stageComp.addTrajectory(file);
            const nglTrajectory = nglFile.trajectory;
            // Count the real numer of frames in the current trajectory and reset the 'requestedFramesNumber'
            // DANI: Esto lo he quitado porque creo que podría dar problemas
            // DANI: Las requestedFramesNumber son el número de frames que se piden, no el real
            // DANI: Si hay que mostrar el número real en algún punto mejor crea otro state
            // if (setRequestedFramesNumber && c === 0) {
            //   const frameCount = nglTrajectory.frameCount;
            //   setRequestedFramesNumber(frameCount);
            // }
            // Add the frame change handler only if it is the main component
            if (c === 0) {
              // Save the expected frames number here in the NGL file
              // This is further use by the frame change handler
              nglFile.expectedFrames = trajectoryFinalExpectedFrames;
              nglFile.signals.frameChanged.add(handleFrameChange);
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
            nglTrajectory.setFrame(0);
            frames.push(nglFile);
            // Save the trajectory player
            trajectoryPlayer = nglTrajectory.player;
            setIsMainTrajectoryStaged(true);
          }
        });
        // Removing NGL without removing signals from the trajectory player is fatal
        // This raises the error "Uncaught TypeError: this._bindings is undefined"
        // Set a cleanup function to prevent fatal errors
        return () => {
          if (!trajectoryPlayer) return;
          trajectoryPlayer.signals.haltedRunning.removeAll();
          //trajectoryPlayer.pause();
        };
      }, [
        topologies,
        trajectories,
        handleFrameChange,
        comps,
        noTrajectory,
        setMainNglFile,
        // The requestedFramesNumber dependency may seem redundant but it is not
        // It is useful to switch between previously downloaded trajectories with different number of frames
        requestedFramesNumber,
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
        nglTrajectory.player.signals.haltedRunning.add(() => {
          const currentFrame = nglTrajectory._currentFrame;
          nglTrajectory.setFrame(currentFrame);
        });
      }, [mainNglFile]);

      // play/pause
      useEffect(() => {
        if (!(isFirstCompStaged && isMainTrajectoryStaged)) return;
        const mainTraj =
          stageRef.current &&
          stageRef.current.compList[0] &&
          stageRef.current.compList[0].trajList[0];
        if (!mainTraj) throw new Error('Something is wrong with NGL');
        const { player } = stageRef.current.compList[0].trajList[0].trajectory;
        player.setParameters({
          // Set the interpolate step according to the total number of frames to show 1 by 1
          interpolateStep: 100 / mainTraj.trajectory.frameCount,
          // Set the animation to go forward and then backward instead of restart if required
          direction: bounce ? 'bounce' : 'forward',
        });
        // WARNING: Pausing the player when there is no trajectory may seem redundant
        // However, if not paused, the surface representations never stop to be calculated
        if (noTrajectory) player.pause();
        else player[playing && isInView ? 'play' : 'pause']();
        // Remvoing NGL while the animation is playing is fatal
        // This raises the error "Uncaught TypeError: this._bindings is undefined"
        // Set a cleanup function to prevent fatal errors
        return () => player.pause();
      }, [
        isFirstCompStaged,
        isMainTrajectoryStaged,
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
        if (!isFirstCompStaged) return;
        const nglFile = stageRef.current.compList[0].trajList[0];
        if (!nglFile) return;
        // Set the player speed
        // The 'speed' input ranges from 0 to 100
        // The NGL 'timeout' parameter stands from the time to wait before moving to the next frame in miliseconds
        //const timeout = 500 / (Math.log2(speed + 1) + 1);
        const timeout = interpolateSpeed(speed);
        nglFile.trajectory.player.setParameters({ timeout: timeout });
      }, [isFirstCompStaged, speed]);

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
        if (!(isFirstCompStaged && isMainTrajectoryStaged)) return;
        stageRef.current.compList[0].trajList[0].trajectory.player.parameters.interpolateType = smooth
          ? 'linear'
          : '';
      }, [isFirstCompStaged, isMainTrajectoryStaged, smooth]);

      // to avoid sometimes when it's not rendering after loading
      useEffect(() => {
        if (!(isFirstCompStaged && requestedTrajectories.length)) return;
        handleResize();
        return handleResize.cancel;
      }, [isFirstCompStaged, requestedTrajectories, handleResize]);

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
            const sourceStart = topologyManager.model2sourceResidue({
              chain,
              residue: start,
            });
            const sourceEnd = topologyManager.model2sourceResidue({
              chain,
              residue: end,
            });
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
      }, [topologyManager]);

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
        const formatOutput = atom => {
          // a.residueIndex starts at 0
          // WARNING: a.residueIndex is correct but we must convert it to source first
          // In some cases 1 residue can have multiple absolute residue indexes
          // (e.g. hydrogens at the end)
          const sourceResidue = topologyManager.absolute2sourceResidue(
            atom.residueIndex,
          );
          const chainName = topologyManager.getMetadataChainname(
            sourceResidue.chain,
          );
          // Find the reference and the reference name to be represented
          const reference = topologyManager.absolute2reference(
            atom.residueIndex,
          );
          const currentReferenceData =
            reference && referenceData.find(r => r.uniprot === reference.id);
          const referenceName =
            reference && currentReferenceData && currentReferenceData.name;
          return (
            <>
              {`Atom ${atom.index} (${atom.atomname})
            Chain ${sourceResidue.chain} ${
                chainName ? '(' + chainName + ')' : ''
              }
            Residue ${sourceResidue.residueNumber} (${atom.resname})`}
              {reference ? (
                reference.id === 'noref' ? (
                  <div style={{ color: 'salmon' }}>{'No referable'}</div>
                ) : (
                  <div>
                    <div style={{ color: 'lightGreen' }}>{referenceName}</div>
                    <div>{`- Residue ${reference.index}`}</div>
                  </div>
                )
              ) : (
                <div style={{ color: 'salmon' }}>{'No reference'}</div>
              )}
            </>
          );
          /*
          return `Atom ${atom.index} (${atom.atomname})
            Chain ${model.chain} ${model ? '(' + model.chainName + ')' : ''}
            Residue ${model.chainResidue} (${atom.resname})`;
          */
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
              // When we hover a bond
              if (bond) {
                const atom1 = bond.atom1;
                const atom2 = bond.atom2;
                description = (
                  <>
                    <div>{`Bond ${atom1.index} - ${atom2.index}`}</div>
                    <hr style={{ color: 'lightGrey' }} />
                    {formatOutput(atom1)}
                    <hr style={{ color: 'lightGrey' }} />
                    {formatOutput(atom2)}
                  </>
                );
              }
              // When we hover an atom
              else if (atom) {
                description = formatOutput(atom);
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
      }, [topologyManager, referenceData, setTooltipContent]);

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
          // if an original orientation was aleady defined
          // (manually created, and stored in the API)
          if (originalOritentationRef.current) {
            // use it to set the initial orientation
            stageRef.current.animationControls.orient(
              originalOritentationRef.current,
              0,
            );
          }
          firstFocus.current = false;
        }
        comp.autoView(focus.sele, transition);
      }, [isFirstCompStaged, focus]);

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
            if (!originalOritentationRef.current) return;
            stageRef.current.animationControls.orient(
              originalOritentationRef.current,
              DEFAULT_ORIENTATION_TRANSITION_DURATION,
            );
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
              [style['loading-structure']]: !isFirstCompStaged,
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
        </>
      );
    },
  ),
);

export default NGLViewer;
