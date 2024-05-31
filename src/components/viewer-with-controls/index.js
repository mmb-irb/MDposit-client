// React logic
import React, {
  useCallback,
  useState,
  useEffect,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useContext,
} from 'react';
import cn from 'classnames';
import screenfull from 'screenfull';
// Visual assets
import {
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Icon,
  IconButton,
  Slider,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDotCircle,
  faImages,
  faSquare,
} from '@fortawesome/free-regular-svg-icons';
import {
  faStepBackward,
  faStepForward,
  faPause,
  faPlay,
  faExpand,
  faCompress,
  faSyncAlt,
  faVideo,
  faAdjust,
  faCog,
  faCube,
  faWalking,
  faBiking,
  faTimes,
  faLock,
  faUnlock,
  faStarOfLife,
  faShareAlt, // It looks like connected atoms
} from '@fortawesome/free-solid-svg-icons';

import RepresentationsManager from './representations-manager';

import { get, setAsync } from '../../utils/storage';

// To ask the API
import { BASE_PATH_PROJECTS } from '../../utils/constants';

// The main component of the viewer itself
import MolstarViewer from '../molstar-viewer';
import NGLViewer from '../ngl-viewer';
import useDefaultRepresentations from '../ngl-viewer/use-default-representations';

// Hooks
import useToggleState from '../../hooks/use-toggle-state';

import connectionLevel, {
  LOW,
  MEDIUM,
  HIGH,
} from '../../utils/connection-level';
import reducedMotion from '../../utils/reduced-motion';

import style from './style.module.css';

import { ProjectCtx } from '../../contexts';

// Decide that the default should be to play the trajectory only on "big enough"
// screens (as a proxy for performance and low-end device detection)
const DEFAULT_STARTS_PLAYING = !reducedMotion() && window.innerWidth > 750;

const DEFAULT_FRAME_NUMBER = (() => {
  switch (connectionLevel()) {
    case HIGH:
      return 50;
    case MEDIUM:
      return 25;
    case LOW:
    default:
      return 10;
  }
})();

// Set the possible number of frames the user can request
const DEFAULT_FRAME_NUMBERS = [
  { value: 1, label: '1' },
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
];

// Set the default component parameters
// These values are used to fill missing fields in input components
const DEFAULT_COMPONENT_PARAMETERS = {
  name: 'Unnamed component',
  topologyURL: 'auto', // This is assigned further
  trajectoryURLs: 'auto', // This is assigned further
  atomSelection: null,
  frame: null,
  onlyTopology: false
}

// Set the default representation parameters
// These values are used to fill missing fields in input representations
const DEFAULT_REPRESENTATION_PARAMETERS = {
  name: 'Unnamed representation',
  selection: 'all',
  show: true,
  type: 'cartoon',
  color: 'chainid',
  opacity: 1,
  component: 'auto' // This is assigned further
}

// DANI: falta representation.index y custom

// Set a function to fill the missing values within an object using default values
// Return true if there was any change
const completeMissingFields = (targetObject, defaultValuesObject) => {
  let anyChange = false;
  for (const [fieldName, defaultValue] of Object.entries(defaultValuesObject)) {
    if (targetObject[fieldName] === undefined) {
      targetObject[fieldName] = defaultValue;
      anyChange = true;
    }
  }
  return anyChange;
}

// Set an NGL view window which is managed by some controls
// There are different ways to call this script
// 1 - With components: Used for situations where more than a topology or trajectory are required
// 2 - With representations: Which internally means there will be only 1 component
// 3 - With no parameters: In which case a default representation in set up
// * In case of both components and representations passed, the valid argument will be the components
// WARNING: There are many important hooks which have components/representations as a dependency
// Avoid passing an object which is created every render. Use a somehow memoized array.
// WARNING: The style of this component and its parent is very important. Use a reference to call it
const ViewerWithControls = forwardRef(
  (
    {
      // The viewer starting components
      // Components are objects which may include the following values:
      // All values are optional since missing values will be set by default
      //  {
      //    name: name of the component used to link representations with it
      //    topologyURL: string, (used in pockets analysis)
      //    trajectoryURLs: [ string ], (used in pca)
      //    atomSelection: string, (used in pca)
      //    frame: int, (used in rmsd pairwise analysis)
      //    onlyTopology: bool, (used in pockets analysis)
      //  }
      startingComponents,
      // The viewer starting representations
      // It is an array of objects with the following structure:
      // All values are optional since missing values will be set by default
      // {
      //   name: ('representation' by default) The string label of this representation,
      //   show: ('true' by default) Boolean to set if this representation is shown or not,
      //   selection: ('all' by default) The NGL selection string to define the atom selection,
      //   type: ('cartoon' by default) The initial representation 'type',
      //   color: ('chainid' by default) The initial representation 'colorScheme',
      //   opacity: ('1' by default) The initial representation opacity
      //   other: object with any other ngl options to be passed for the representation
      //   component: name of the component this representation belongs to (main component when missing)
      // }
      startingRepresentations,
      // Alternatively you may pass bot components and representations as states
      // Thus the parent component may also control them
      // Note that these states will be still controled by the child components anyway
      componentsState,
      representationsState,
      // Style
      className,
      // Set if the viewer must play the simulation as soon as it appears
      startsPlaying = DEFAULT_STARTS_PLAYING,
      // Closing callback
      close,
      // Nailing callback
      nail,
      // Set which frame must be loaded. It may be undefined, if the whole trajectory is desired.
      requestedFrame,
      // Set if the frame number selector is allowed for trajectories (false in PCA projections)
      framesSelect = true,
      // Set a special option to force the 'noTrajectory' condition
      // This is used to avoid the trajectory playing in pockets since there are surfaced representations
      // This is only to be passed when having a trajectory loaded in the main component
      // If a single frame is forced then this is redundant
      preventTrajectory = false,
      // Set a state setter to handle the frame progress
      onProgress,
      // The rest of properties
      ...props
    },
    ref,
  ) => {
    // Make sure we are not having incompatible inputs
    if (startingComponents && componentsState)
      throw new Error('startingComponents and componentsState are not compatilbe inputs. Choose one.');
    if (startingRepresentations && representationsState)
      throw new Error('startingRepresentations and representationsState are not compatilbe inputs. Choose one.');
    // Set which viewer is used: NGL or MolStar (the default is NGL)
    const [Viewer, setViewer] = useState(NGLViewer);
    // Get project metadata
    const { metadata, accessionAndMdNumber } = useContext(ProjectCtx);
    // Use metadata to limit available frames number
    const frameNumbers = useMemo(() => {
      const maximumSnapshots = metadata.mdFrames;
      const frameNumbers = [...DEFAULT_FRAME_NUMBERS];
      // Remove values over the maximim number of frames
      for (let i = frameNumbers.length - 1; i >= 0; i--) {
        if (frameNumbers[i].value > maximumSnapshots) frameNumbers.pop();
        else break;
      }
      // In case no value was removed we are done
      if (frameNumbers.length === DEFAULT_FRAME_NUMBERS.length)
        return frameNumbers;
      // Otherwise, if the maximum number of frames is not one of the options already, then add it
      if (frameNumbers[frameNumbers.length - 1].value !== maximumSnapshots)
        frameNumbers.push({
          value: maximumSnapshots,
          label: maximumSnapshots.toString(),
        });
      return frameNumbers;
    }, [metadata.mdFrames]);
    // Do not use the start object but make a copy to avoid a lot of silent errors
    const fixedStartingComponents = useMemo(() => {
      // If there are no starting components then just leave it as null
      // The defualt completer logic will take over
      if (!startingComponents) return null;
      return startingComponents.map(comp => JSON.parse(JSON.stringify(comp)));
    }, [startingComponents]);

    // Set the final components to be passed to the viewer
    const [finalComponents, setFinalComponents] =
      componentsState || useState(fixedStartingComponents);

    // Set the missing value completer for components including URLs
    // Return true if there was any change
    const completeComponentMissingFields = useCallback(targetObject => {
      if (!accessionAndMdNumber) return false;
      const defaults = {...DEFAULT_COMPONENT_PARAMETERS};
      defaults.topologyURL = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/files/structure`;
      defaults.trajectoryURLs = [ `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/files/trajectory` ];
      return completeMissingFields(targetObject, defaults);
    }, [accessionAndMdNumber]);

    // Anytime components change, check if there are any missing values and fill them with default values
    useMemo(() => {
      // Wait for the default completer to be ready
      if (!completeComponentMissingFields) return;
      // If there are no components then set a default configuration
      if (!finalComponents) {
        const defComponents = [{ name: 'Main' }];
        defComponents.forEach(comp => { completeComponentMissingFields(comp) });
        return setFinalComponents(defComponents);
      }
      // Make sure we have no components with the same name
      const componentNames = finalComponents.map(comp => comp.name);
      const uniqueComponentNames = new Set(componentNames);
      if (componentNames.length !== uniqueComponentNames.size)
        throw new Error(`We have multiple components with the same name: ${componentNames.join(', ')}`);
      // Fill missing values among components with default values
      const changes = finalComponents.map(comp => 
        completeComponentMissingFields(comp, DEFAULT_COMPONENT_PARAMETERS));
      // If there was any value filled then update the state to trigger a rerender
      if (changes.some(v => v === true)) setFinalComponents([...finalComponents]);
    }, [finalComponents, completeComponentMissingFields]);

    // Anytime the requested frame changes update the main component
    useMemo(() => {
      if (!finalComponents) return;
      if (requestedFrame === undefined) return;
      if (finalComponents[0].frame === requestedFrame) return;
      finalComponents[0].frame = requestedFrame;
      setFinalComponents([...finalComponents]);
    }, [finalComponents, requestedFrame]);

    // Do not use the start object but make a copy to avoid a lot of silent errors
    const fixedStartingRepresentations = useMemo(() => {
      // If there are no starting representations then just leave it as null
      // The defualt completer logic will take over
      if (!startingRepresentations) return null;
      return startingRepresentations.map(rep => JSON.parse(JSON.stringify(rep)));
    }, [startingRepresentations]);

    // Set the final representations to be passed to the viewer
    const [finalRepresentations, setFinalRepresentations] =
      representationsState || useState(fixedStartingRepresentations);

    // Use this hook to get the memoized NGL default representations
    const defaultRepresentations = useDefaultRepresentations();

    // Set the missing value completer for representations including the main component name
    // Return true if there was any change
    const completeRepresentationMissingFields = useCallback(targetObject => {
      if (!finalComponents) return false;
      const defaults = {...DEFAULT_REPRESENTATION_PARAMETERS};
      defaults.component = finalComponents[0].name;
      return completeMissingFields(targetObject, defaults);
    }, [finalComponents]);

    // Anytime representations change, check if there are any missing values and fill them
    useMemo(() => {
      // If we still have no default refereferences then stop here
      if (!defaultRepresentations || defaultRepresentations.length === 0) return;
      // If there are no representations then set a default configuration
      if (!finalRepresentations) {
        const defRepresentations = [...defaultRepresentations];
        defRepresentations.forEach(rep => 
          completeRepresentationMissingFields(rep, DEFAULT_REPRESENTATION_PARAMETERS));
        return setFinalRepresentations(defRepresentations);
      }
      // Fill missing values among representations with default values
      const changes = finalRepresentations.map(rep => 
        completeRepresentationMissingFields(rep, DEFAULT_REPRESENTATION_PARAMETERS));
      // If there was any value filled then update the state to trigger a rerender
      if (changes.some(v => v === true)) setFinalRepresentations([...finalRepresentations]);
    }, [finalRepresentations, defaultRepresentations, completeRepresentationMissingFields]);

    // references
    const containerRef = useRef(null);
    const viewerRef = useRef(null);

    // toggle states
    const [nailed, toggleNailed] = useToggleState(false);
    const [playing, togglePlaying] = useToggleState(startsPlaying);
    const [spinning, toggleSpinning] = useToggleState(false);
    const [smooth, toggleSmooth] = useToggleState(true);
    const [darkBackground, toggleDarkBackground] = useToggleState(
      useMemo(() => get('dark-background', false), []),
    );
    const [perspective, togglePerspective] = useToggleState(
      useMemo(() => get('perspective', false), []),
    );

    // states
    const [progress, setProgress] = useState(0);
    const [load, setLoad] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(screenfull.isFullscreen);
    const [requestedFramesNumber, setRequestedFramesNumber] = useState(
      Math.min(DEFAULT_FRAME_NUMBER, metadata.mdFrames),
    );
    const [speed, setSpeed] = useState(useMemo(() => get('speed', 50), []));
    const [settings, openSettings] = useState(false);

    // handlers

    // Handle the automatic progress
    const handleProgress = useCallback(
      prog => {
        if (onProgress) onProgress(prog);
        setProgress(prog);
      }, [setProgress, onProgress],
    );

    // Handle the trajectory load
    const handleLoad = useCallback(
      load => {
        setLoad(load);
      }, [setLoad],
    );

    // handle click or click & drag progress bar
    const handleManualProgress = useCallback(
      ({ buttons, clientX, currentTarget, type }) => {
        if (!viewerRef.current) return;
        // if mousemove event, but the main button is not pressed, bail
        if (type === 'mousemove' && buttons !== 1) return;
        const { x, width } = currentTarget.getBoundingClientRect();
        // Set pause
        togglePlaying(false);
        // Change the ngl viewer current ref from its exposed setter
        // Then the ngl itself will update the 'progress' state
        viewerRef.current.currentFrame = Math.floor(
          ((clientX - x) / width) * viewerRef.current.totalExpectedFrames,
        );
      }, [togglePlaying],
    );

    // Frame change handler to interact with the child viewer
    const handleFrameChange = useCallback(
      value => {
        if (!viewerRef.current) return;
        togglePlaying(false);
        viewerRef.current.currentFrame += value;
      }, [togglePlaying],
    );

    // When the user requests the previous frame
    const handlePreviousFrame = useCallback(() => handleFrameChange(-1), [handleFrameChange]);

    // When the user requests the next frame
    const handleNextFrame = useCallback(() => handleFrameChange(1), [handleFrameChange]);

    // Enter/exit fullscreen
    const handleFullscreenChange = useCallback(() => setIsFullscreen(screenfull.isFullscreen), []);
    useEffect(() => {
      screenfull.on('change', handleFullscreenChange);
      return () => screenfull.off('change', handleFullscreenChange);
    }, [handleFullscreenChange]);

    // When the user clicks on the fullscreen button
    const handlerFullscreenButton = useCallback(
      () => { if (containerRef.current) screenfull.toggle(containerRef.current) }, []);

    // Exit the options menu by pressing the escape key
    useEffect(() => {
      const handleKeyPress = event => {
        if (event.key === 'Escape') openSettings(false);
        viewerRef.current.autoResize();
      };
      document.addEventListener('keydown', handleKeyPress, false);
      return () => document.removeEventListener('keydown', handleKeyPress, false);
    }, []);

    // This allows parent components to interact with this component
    useImperativeHandle(ref,
      () => ({
        autoResize: viewerRef.current.autoResize,
        centerFocus: viewerRef.current.centerFocus,
        get currentFrame() {
          return viewerRef.current.currentFrame;
        },
        set currentFrame(value) {
          viewerRef.current.currentFrame = value;
        },
        togglePlaying: togglePlaying,
        setFinalComponents: setFinalComponents,
        setFinalRepresentations: setFinalRepresentations
      }),
      [
        togglePlaying,
        setFinalComponents,
        setFinalRepresentations,
      ],
    );

    // Set the variable 'noTrajectory' as true when:
    // The flag 'onlyTopology' is passed
    // there is a selected unique frame to load from the main trajectory
    // The main trajectory only has 1 frame (e.g. average.xtc)
    const mainComponent = finalComponents && finalComponents[0];
    const noTrajectory = preventTrajectory || (mainComponent && (mainComponent.onlyTopology ||
      Number.isFinite(mainComponent.frame))); // May be 0

    // DANI: Si no quieres buscarte problemas no cambies las "Card"s de aquí abajo por "div"s o similar
    return (
      <Card
        className={cn(style['fullscreen-target'], {
          [style['is-fullscreen']]: isFullscreen,
        })}
        ref={containerRef}
      >
        <div className={cn(style.adapter, className)}>
          <Card
            className={settings
              ? style['ngl-with-settings']
              : style['ngl-without-settings']
            }
            style={{ border: 'none', boxShadow: 'none' }}
            // This id prevents the mouse to drag or resize the Rnd when it is over this element
            id={'preventDragSize'}
          >
            <Card
              className={settings
                ? cn(style['settings-left'], className)
                : cn(style['ngl-alone'], className)
              }
              style={{ border: 'none', boxShadow: 'none' }}
            >
              <Viewer
                playing={playing}
                spinning={spinning}
                smooth={smooth}
                onProgress={handleProgress}
                onLoad={handleLoad}
                ref={viewerRef}
                noTrajectory={noTrajectory}
                requestedFramesNumber={requestedFramesNumber}
                darkBackground={darkBackground}
                perspective={perspective}
                speed={speed}
                components={finalComponents}
                representations={finalRepresentations}
                {...props}
              />
              {settings && (
                <div className={style['settings-controls']}>
                  <div className={style['stacked-icons']}>
                    <IconButton
                      title="Toggle spin"
                      onClick={toggleSpinning}
                      size="large"
                    >
                      <FontAwesomeIcon icon={faSyncAlt} />
                    </IconButton>

                    <IconButton
                      title="Center focus"
                      onClick={event => {
                        if (!viewerRef.current) return;
                        // When the keys control, shift or command (ios) are hold while clicking
                        const getFocus = event.shiftKey || event.ctrlKey || event.metaKey;
                        if (getFocus) viewerRef.current.displayFocus();
                        else viewerRef.current.centerFocus();
                      }}
                      size="large"
                    >
                      <FontAwesomeIcon icon={faDotCircle} />
                    </IconButton>

                    {noTrajectory || (
                      <IconButton
                        title={`Toggle smooth interpolation ${
                          smooth
                            ? 'off'
                            : 'on (may display artifacts for simulation box border atoms)'
                        }`}
                        onClick={toggleSmooth}
                        size="large"
                      >
                        <FontAwesomeIcon icon={smooth ? faImages : faVideo} />
                      </IconButton>
                    )}

                    <IconButton
                      title="Invert background color"
                      onClick={() => {
                        toggleDarkBackground();
                        setAsync('dark-background', !darkBackground);
                      }}
                      size="large"
                    >
                      <div
                        className={cn(style['background-toggle'], {
                          [style.dark]: darkBackground,
                        })}
                      >
                        <FontAwesomeIcon icon={faAdjust} />
                      </div>
                    </IconButton>

                    <IconButton
                      title={`Switch to ${
                        perspective ? 'ortographic' : 'perspective'
                      } view`}
                      onClick={() => {
                        togglePerspective();
                        setAsync('perspective', !perspective);
                      }}
                      size="large"
                    >
                      <FontAwesomeIcon icon={perspective ? faSquare : faCube} />
                    </IconButton>

                    <IconButton
                      title={`Switch viwer to ${
                        Viewer === NGLViewer ? 'MolStar' : 'NGL'
                      }`}
                      onClick={() => {
                        setViewer(currentViewer => {
                          if (currentViewer === NGLViewer) return MolstarViewer;
                          if (currentViewer === MolstarViewer) return NGLViewer;
                          throw new Error('Unrecognized current viewer');
                        });
                      }}
                      size="large"
                    >
                      <FontAwesomeIcon
                        icon={Viewer === NGLViewer ? faStarOfLife : faShareAlt}
                      />
                    </IconButton>
                  </div>
                  {noTrajectory || (
                    <div>
                      Speed:
                      <Grid
                        container
                        spacing={2}
                        className={style['extra-top-margin']}
                      >
                        <Grid item>
                          <Icon>
                            <FontAwesomeIcon icon={faWalking} />
                          </Icon>
                        </Grid>
                        <Grid item xs>
                          <Slider
                            title="Change player speed"
                            value={speed}
                            aria-labelledby="continuous-slider"
                            onChange={(_, value) => {
                              setSpeed(value);
                              setAsync('speed', value);
                            }}
                          />
                        </Grid>
                        <Grid item>
                          <Icon>
                            <FontAwesomeIcon icon={faBiking} />
                          </Icon>
                        </Grid>
                      </Grid>
                    </div>
                  )}
                  {noTrajectory || (
                    <div>
                      Frames:
                      {framesSelect ? (
                        <Slider
                          title="Select frame number"
                          value={requestedFramesNumber}
                          onChange={(_, value) =>
                            setRequestedFramesNumber(value)
                          }
                          aria-labelledby="discrete-slider-restrict"
                          step={null}
                          valueLabelDisplay="auto"
                          marks={frameNumbers}
                          max={frameNumbers[frameNumbers.length - 1].value}
                        />
                      ) : (
                        // DANI: Esto puede que no esté bien. Deberían ser 20 frames cuando es una PCA projection
                        ' ' + viewerRef.current.totalExpectedFrames
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
            {settings && (
              <div className={style['settings-right']}>
                <RepresentationsManager
                  components={finalComponents}
                  representations={finalRepresentations}
                  setRepresentations={setFinalRepresentations}
                />
              </div>
            )}
          </Card>
          <CardContent style={{ padding: 0 }}>
            {noTrajectory
              // Render an empty div to avoid a Warning message since CardContent expect a ReactNode and an undefuned is not
              ? (<div />)
              // Render the loading/progress bar in case there is a trajectory to be loaded
              : (<div
                  className={cn(style.progress, { [style.dark]: darkBackground })}
                  onClick={handleManualProgress}
                  onMouseMove={handleManualProgress}
                >
                  <LinearProgress
                    variant="buffer"
                    color="primary"
                    value={progress * 100}
                    valueBuffer={load * 100}
                    style={{ height: '1ch' }}
                  />
                </div>)
            }
            <div className={style.controls}>
              <div>
                <IconButton
                  title="Close viewer"
                  className={cn({ [style.hidden]: !close })}
                  disabled={!close}
                  onClick={close}
                  size="large"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </IconButton>

                <IconButton
                  title={nailed ? 'Nailed viewer' : 'Nail viewer'}
                  className={cn({ [style.hidden]: !nail })}
                  disabled={!nail || nailed}
                  onClick={() => {
                    nail();
                    toggleNailed();
                  }}
                  size="large"
                >
                  <div className={style['flip-container']}>
                    <div
                      className={cn(style['flip-card-container'], {
                        [style.flipped]: nailed,
                      })}
                    >
                      <FontAwesomeIcon
                        className={cn(style['flip-card'], style.front)}
                        icon={faUnlock}
                      />
                      <FontAwesomeIcon
                        className={cn(style['flip-card'], style.back)}
                        icon={faLock}
                      />
                    </div>
                  </div>
                </IconButton>
              </div>
              <div>
                {noTrajectory || (
                  <>
                    <IconButton
                      title="Previous frame"
                      onClick={handlePreviousFrame}
                      size="large"
                    >
                      <FontAwesomeIcon icon={faStepBackward} />
                    </IconButton>
                    <IconButton
                      title={playing ? 'Pause' : 'Play'}
                      onClick={togglePlaying}
                      size="large"
                    >
                      <div className={style['flip-container']}>
                        <div
                          className={cn(style['flip-card-container'], {
                            [style.flipped]: playing,
                          })}
                        >
                          <FontAwesomeIcon
                            className={cn(style['flip-card'], style.front)}
                            icon={faPlay}
                          />
                          <FontAwesomeIcon
                            className={cn(style['flip-card'], style.back)}
                            icon={faPause}
                          />
                        </div>
                      </div>
                    </IconButton>
                    <IconButton
                      title="Next frame"
                      onClick={handleNextFrame}
                      size="large"
                    >
                      <FontAwesomeIcon icon={faStepForward} />
                    </IconButton>
                  </>
                )}
              </div>
              <div>
                <IconButton
                  title={`${isFullscreen ? 'Exit' : 'Go'} fullscreen`}
                  onClick={handlerFullscreenButton}
                  className={cn(style['fullscreen-toggle'], {
                    [style.hidden]: !screenfull.isEnabled,
                    [style['is-fullscreen']]: isFullscreen,
                    [style['settings']]: settings,
                  })}
                  disabled={!screenfull.isEnabled}
                  size="large"
                >
                  <FontAwesomeIcon
                    icon={isFullscreen ? faCompress : faExpand}
                  />
                </IconButton>
                <IconButton
                  title={'Settings'}
                  onClick={() => {
                    openSettings(previous => !previous);
                    viewerRef.current.autoResize();
                  }}
                  size="large"
                >
                  <FontAwesomeIcon icon={faCog} />
                </IconButton>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>
    );
  },
);

export default ViewerWithControls;
