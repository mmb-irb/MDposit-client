import React, {
  forwardRef,
  memo,
  useRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useContext,
} from 'react';
import { useInView } from 'react-intersection-observer';
import { debounce, throttle, clamp } from 'lodash-es';
import cn from 'classnames';
import { Stage, ColormakerRegistry, Matrix4 } from 'ngl';

import { frame } from 'timing-functions';

import payloadToNGLFile from './payload-to-ngl-file';
import getFrames from './get-frames';

import { AccessionCtx, ProjectCtx, PdbCtx } from '../../contexts';

import style from './style.module.css';

// To get frames
import { BASE_PATH_PROJECTS } from '../../utils/constants';
import extractCounts from './extract-counts';
import axios from 'axios';

const changeOpacity = throttle((representation, membraneOpacity) => {
  representation.setParameters({ opacity: membraneOpacity });
  // optimise render or not depending on opacity level
  if (representation.visible && !membraneOpacity) {
    representation.setVisibility(false);
  }
  if (!representation.visible && membraneOpacity) {
    representation.setVisibility(true);
  }
}, 100);

const DEFAULT_NUMBER_OF_FRAMES = 25;
const DEFAULT_ORIENTATION_TRANSITION_DURATION = 500; // 500 ms

const DEFAULT_CHAIN_SELECTION = 'polymer and not hydrogen ';
//const CHAIN_SELECTION = 'polymer and not hydrogen and not :A and not :C';

const NGLViewer = memo(
  forwardRef(
    (
      {
        className,
        playing,
        spinning,
        membraneOpacity,
        smooth,
        onProgress,
        noTrajectory, // True when we just want to display a static structure
        projection,
        nFrames = DEFAULT_NUMBER_OF_FRAMES, // Requeste number of frames to display
        hovered,
        selected,
        requestedFrame,
        darkBackground,
        perspective,
        speed,
        bannedChains,
      },
      ref,
    ) => {
      const CHAIN_SELECTION = DEFAULT_CHAIN_SELECTION + bannedChains;

      // data from context
      const accession = useContext(AccessionCtx);
      const { metadata, curatedOrientation } = useContext(ProjectCtx);
      const pdbData = useContext(PdbCtx);

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

      const { loading: loadingPDB, file: pdbFile } = pdbData;

      const isProjection = Number.isFinite(projection);

      // Set stored variables
      const dcdLoadingRef = useRef(null);
      const dcdPayloadRef = useRef(null);
      const dcdProgressRef = useRef(null);
      const dcdCountsRef = useRef({});

      // Hook for frames
      useEffect(
        () => {
          // Get the frames to be loaded in a standarized string format for the API
          const frames = getFrames(
            isProjection,
            metadata,
            noTrajectory,
            nFrames,
            requestedFrame,
          );
          // Set the url to ask the API
          const url = `${BASE_PATH_PROJECTS}${accession}/files/trajectory${
            isProjection ? `.pca-${projection + 1}.bin` : ''
            // Frames are included only when there is no projection (i.e. it is not a pca analysis)
          }${Boolean(frames && !isProjection) ? `?frames=${frames}` : ''}`;
          // Here, if you ask for the trajectory.bin instead of just trajectory, you get the whole file
          // This is because the only route of the API accepting frames selection is the "trajectory" endpoint
          // Other paths such as "trajectory.bin" will be processed as "/:files"

          // Set the loading status as true
          dcdLoadingRef.current = true;

          // Ask the API through axios (https://www.npmjs.com/package/axios)
          // Some extra load features are passed through axios
          // Set a cancel 'token'
          const source = axios.CancelToken.source();
          let didCancel = false;
          dcdProgressRef.current = 0;
          // Set a function to track the download progress
          const onDownloadProgress = progressEvent => {
            // Check if progress is measurable. If so, mesure it.
            if (progressEvent.lengthComputable)
              dcdProgressRef.current =
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
              dcdCountsRef.current = extractCounts(response);
              dcdCountsRef.current.nFrames = parseInt(nFrames);
              dcdPayloadRef.current = response.data;
              dcdLoadingRef.current = false;
            })
            // Otherwise
            .catch(error => {
              if (didCancel) return;
              console.error('Error while loading the trajectory: ' + error);
            });

          return () => {
            // Cancel the request
            source.cancel();
            didCancel = true;
          };
        },
        // Dependencies
        [
          projection,
          isProjection,
          metadata,
          noTrajectory,
          nFrames,
          requestedFrame,
          accession,
        ],
      );

      const dcdLoading = dcdLoadingRef.current;
      const dcdPayload = dcdPayloadRef.current;
      const dcdProgress = dcdProgressRef.current;
      const dcdCounts = dcdCountsRef.current;

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
        [onProgress],
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
      useEffect(() => {
        if (!pdbFile) return;
        const structureComponent = stageRef.current.addComponentFromObject(
          pdbFile,
        );

        // set the view somehow, in any case no transition duration is set
        // because it's the first time we do that

        // if an original orientation was aleady defined
        // (manually created, and stored in the API)
        structureComponent.autoView(CHAIN_SELECTION, 0);
        if (originalOritentationRef.current) {
          // use it to set the initial orientation
          stageRef.current.animationControls.orient(
            originalOritentationRef.current,
            0,
          );
        } else {
          originalOritentationRef.current = stageRef.current.viewerControls.getOrientation();
        }

        // Find if there is a previous structure representation
        const previousStructureRepresentation = stageRef.current.compList[0].reprList.find(
          representation => representation.name === 'structure',
        );

        // If there is an existing representation just update the selection
        if (previousStructureRepresentation) {
          previousStructureRepresentation.setSelection(CHAIN_SELECTION);
        }
        // If not, create it
        else {
          // main structure
          structureComponent.addRepresentation('cartoon', {
            sele: CHAIN_SELECTION, // This may do nothing
            name: 'structure',
            opacity: 1,
          });
        }

        // Find if there is a previous membrane representation
        const previousMembraneRepresentation = stageRef.current.compList[0].reprList.find(
          representation => representation.name === 'membrane',
        );

        // If not, create it
        if (!previousMembraneRepresentation) {
          // membrane
          const membraneRepresentation = structureComponent.addRepresentation(
            'licorice',
            {
              sele: '(not polymer or hetero) and not (water or ion)',
              opacity: 0.5,
              name: 'membrane',
            },
          );

          // Hide the membrane if this is a PCA projection
          if (isProjection) membraneRepresentation.setVisibility(false);
        }
      }, [pdbFile, isProjection, CHAIN_SELECTION]);

      // highlight hovered atoms from other components
      useEffect(() => {
        if (!pdbFile || !(selected instanceof Set) || !(hovered || selected)) {
          return;
        }

        const nameHighlight = 'highlighted';
        const previousHighlightRepresentation = stageRef.current.compList[0].reprList.find(
          representation => representation.name === nameHighlight,
        );
        if (previousHighlightRepresentation) {
          stageRef.current.compList[0].removeRepresentation(
            previousHighlightRepresentation,
          );
        }

        const nameContext = 'context';
        const previousContextRepresentation = stageRef.current.compList[0].reprList.find(
          representation => representation.name === nameContext,
        );
        if (previousContextRepresentation) {
          stageRef.current.compList[0].removeRepresentation(
            previousContextRepresentation,
          );
        }

        let selectedPlusMaybeHovered;
        if (hovered) {
          selectedPlusMaybeHovered = new Set(selected);
          selectedPlusMaybeHovered.add(hovered);
        } else {
          selectedPlusMaybeHovered = selected;
        }

        const atoms = Array.from(selectedPlusMaybeHovered);
        if (!atoms.length) return;

        // ngl starts counting at 0
        const seleHighlight = `@${atoms
          .map(atomNumber => atomNumber - 1)
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
              atomsNumber =>
                pdbFile.atomStore.residueIndex[atomsNumber - 1] + 1,
            ),
          ),
        ).join(' or ');
        stageRef.current.compList[0].addRepresentation('ball+stick', {
          sele: seleContext,
          name: nameContext,
        });
      }, [pdbFile, hovered, selected]);

      // pause on loading
      useEffect(() => {
        if (!(pdbFile && stageRef.current.compList[0].trajList[0])) return;
        stageRef.current.compList[0].trajList[0].trajectory.player.pause();
      }, [pdbFile, dcdLoading]);

      // DCD file, trajectory
      useEffect(() => {
        const file = payloadToNGLFile(
          pdbFile,
          dcdPayload,
          dcdCounts.atoms,
          dcdCounts.nFrames,
          isProjection,
          Number.isFinite(requestedFrame),
        );
        if (stageRef.current.compList[0]) {
          stageRef.current.compList[0].autoView(CHAIN_SELECTION, 0);
        }
        if (!file) return;

        const component = stageRef.current.compList[0];
        // remove all possibly already existing trajectories
        component.trajList.forEach(component.removeTrajectory.bind(component));

        const frames = component.addTrajectory(file);
        frames.signals.frameChanged.add(handleFrameChange);
        frames.trajectory.setFrame(0);

        component.autoView(CHAIN_SELECTION, 0);
        originalOritentationRef.current = stageRef.current.viewerControls.getOrientation();

        return () => frames.signals.frameChanged.remove(handleFrameChange);
      }, [
        requestedFrame,
        pdbFile,
        dcdPayload,
        handleFrameChange,
        dcdCounts,
        isProjection,
        CHAIN_SELECTION,
      ]);

      // play/pause
      useEffect(() => {
        if (!(pdbFile && dcdPayload)) return;
        const { player } = stageRef.current.compList[0].trajList[0].trajectory;
        player[playing && isInView ? 'play' : 'pause']();
        return () => player.pause();
      }, [pdbFile, dcdPayload, playing, isInView]);

      // speed
      useEffect(() => {
        stageRef.current &&
          stageRef.current.compList[0] &&
          stageRef.current.compList[0].trajList[0] &&
          stageRef.current.compList[0].trajList[0].trajectory.player.setParameters(
            { timeout: 500 / (Math.log2(speed + 1) + 1) },
          );
      }, [speed, dcdLoading]);

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

      // membrane opacity
      useEffect(() => {
        if (!pdbFile) return;
        changeOpacity(
          stageRef.current.compList[0].reprList.find(
            ({ name }) => name === 'membrane',
          ).repr,
          membraneOpacity,
        );
      }, [pdbFile, membraneOpacity, projection]);
      useEffect(() => changeOpacity.cancel, []);

      // smoothing, player interpolation
      useEffect(() => {
        if (!(pdbFile && dcdPayload)) return;
        stageRef.current.compList[0].trajList[0].trajectory.player.parameters.interpolateType = smooth
          ? 'linear'
          : '';
      }, [pdbFile, dcdPayload, smooth]);

      // to avoid sometimes when it's not rendering after loading
      useEffect(() => {
        if (!(pdbFile && dcdPayload)) return;
        handleResize();
        return handleResize.cancel;
      }, [pdbFile, dcdPayload, handleResize]);

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
            const [start, end] = thisHiglight
              .split(':')
              .map(addOffsetMappingFn);
            highlight += ` or ${start}-${end}`;
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
      }, [CHAIN_SELECTION]);

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
            if (!(pdbFile && dcdPayload)) return -1;
            try {
              return stageRef.current.compList[0].trajList[0].trajectory
                .currentFrame;
            } catch (_) {
              return -1;
            }
          },
          set currentFrame(value) {
            if (!(pdbFile && dcdPayload)) return;
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
            if (!(pdbFile && dcdPayload)) return 1;
            try {
              return stageRef.current.compList[0].trajList[0].trajectory.frames
                .length;
            } catch (_) {
              return 1;
            }
          },
        }),
        [pdbFile, dcdPayload, handleResize],
      );

      // workaround to have multiple ref logic on one element
      // https://github.com/thebuilder/react-intersection-observer/issues/186#issuecomment-468641525
      const handleRef = node => {
        inViewRef(node);
        containerRef.current = node;
      };

      // Finally, render the ngl window
      return (
        <div
          ref={handleRef}
          className={cn(className, style.container, {
            [style['loading-pdb']]: loadingPDB,
            [style['loading-trajectory']]: !noTrajectory && dcdLoading,
            [style['light-theme']]: !darkBackground,
          })}
          // Display loading status data in the upper left corner of the NGL window
          data-loading={
            loadingPDB
              ? `Loading structure`
              : !pdbFile
              ? `No structure available`
              : dcdLoading
              ? `Loading ${
                  loadingPDB
                    ? 'structure'
                    : `trajectory (${Math.round(dcdProgress * 100)}%)`
                }…`
              : !dcdPayload && !noTrajectory
              ? `No trajectory available`
              : // Show nothing when everything was finished and fine
                undefined
          }
        />
      );
    },
  ),
);

export default NGLViewer;
