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
} from '@material-ui/core';
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
const defaultStartsPlaying = !reducedMotion() && window.innerWidth > 750;

const defualtFrameNumber = (() => {
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
const defaultFrameNumbers = [
  {
    value: 1,
    label: '1',
  },
  {
    value: 10,
    label: '10',
  },
  {
    value: 25,
    label: '25',
  },
  {
    value: 50,
    label: '50',
  },
  {
    value: 100,
    label: '100',
  },
];

// Set an NGL view window which is managed by some controls
// There are different ways to call this script
// 1 - With components: Used for situations where more than a topology or trajectory are required
// 2 - With representations: Which internally means there will be only 1 component
// 3 - With no parameters: In which case a default representation in set up
// * In case of both components and representations passed, the valid argument will be the components
// WARNING: There are many important hooks which have components/representations as a dependency
// Avoid passing an object which is created every render. Use a somehow memoized array.
// WARNING: The style of this component and its parent is very important. Use a reference to call it
const NGLViewerWithControls = forwardRef(
  (
    {
      className,
      startsPlaying = defaultStartsPlaying,
      close,
      nail,
      // Set which frame must be loaded. It may be undefined, if the whole trajectory is desired.
      requestedFrame,
      // Set if the frame number selector is allowed for trajectories (false in PCA projections)
      framesSelect = true,
      // Old method to call the NGL
      // The NGL representations
      // It is an array of objects with the following structure:
      // {
      //   selection: ('all' by default) The NGL selection string to define the atom selection,
      //   name: ('representation' by default) The string label of this representation,
      //   show: ('true' by default) Boolean to set if this representation is shown or not,
      //   type: ('cartoon' by default) The initial representation 'type',
      //   color: ('chainid' by default) The initial representation 'colorScheme',
      //   opacity: ('1' by default) The initial representation opacity
      //   other: object with any other ngl options to be passed for the representation
      // }
      representations,
      // New method to call the NGL
      // Components are objects which may include the following values
      // All values are optional since missing values will be set by default
      //  {
      //    topologyURL: string, (used in pockets analysis)
      //    trajectoryURLs: [ string ], (used in pca analysis)
      //    frame: int, (used in rmsd pairwise analysis)
      //    onlyTopology: bool, (used in pockets analysis)
      //    representations: [...],
      //  }
      components,
      // Forced states for representation parameters. They must be passed in the state format (e.g. [state, setState])
      // They are passed when these parameters must be controlled from outside the NGL
      // Usually they are not passed since this script has builtin states
      showRepresentationsForced,
      nglSelectionsForced,
      drawingMethodsForced,
      coloringMethodsForced,
      opacitiesForced,
      // Set a special option to force the 'noTrajectory' condition
      preventTrajectory = false,
      // Set a state setter to handle the frame progress
      onProgress,
      // The rest of properties
      ...props
    },
    ref,
  ) => {
    // Set which viewer is used: NGL or MolStar
    const [Viewer, setViewer] = useState(
      //MolstarViewer
      NGLViewer,
    );
    // Get project metadata
    const { metadata } = useContext(ProjectCtx);
    // Use metadata to limit available frmaes number
    const frameNumbers = useMemo(() => {
      const maximumSnapshots = metadata.SNAPSHOTS;
      const frameNumbers = [...defaultFrameNumbers];
      // Remove values over the maximim number of frames
      for (let i = frameNumbers.length - 1; i >= 0; i--) {
        if (frameNumbers[i].value > maximumSnapshots) frameNumbers.pop();
        else break;
      }
      // In case no value was removed we are done
      if (frameNumbers.length === defaultFrameNumbers.length)
        return frameNumbers;
      // Otherwise, if the maximum number of frames is not one of the options already, then add it
      if (frameNumbers[frameNumbers.length - 1].value !== maximumSnapshots)
        frameNumbers.push({
          value: maximumSnapshots,
          label: maximumSnapshots.toString(),
        });
      return frameNumbers;
    }, [metadata.SNAPSHOTS]);
    // Use this hook to get the memoized NGL default representations
    const defaultRepresentations = useDefaultRepresentations();

    // Additional representations which may be added by the user
    // It is an array of objects with the following structure:
    // {
    //   topologyURL: string,
    //   trajectoryURLs: [ string ],
    //   frame: int,
    //   selection: ('all' by default) The NGL selection string to define the atom selection,
    //   name: ('representation' by default) The string label of this representation,
    //   show: ('true' by default) Boolean to set if this representation is shown or not,
    //   type: ('cartoon' by default) The initial representation 'type',
    //   color: ('chainid' by default) The initial representation 'colorScheme',
    //   opacity: ('1' by default) The initial representation opacity
    // }
    const [additionalRepresentations, setAdditionalRepresentations] = useState(
      [],
    );

    // Set the components. If components are not provided use default values
    // Set also all representations mined from each component
    // These representations will have stated parameters which may be changed by the user
    const [allComponents, allRepresentations] = useMemo(() => {
      // WARNING: Do not modify the original value of 'components'
      // WARNING: The object must be copied deeply. Otherwise representations list would be the same
      // WARNING: This would results in a disaster when there is more than 1 component
      // WARNING: (e.g. adding custom representations in rmsd pairwise)
      let comps;
      if (!components) comps = [];
      else
        comps = [...components.map(comp => JSON.parse(JSON.stringify(comp)))];
      // WARNING!! Do not modify the original value of 'representations'
      let reps;
      if (!representations) reps = [];
      else reps = [...representations];

      // If there are no components we set a default value
      // If 'representations' is also undefined a default value will be assigned further
      if (comps.length === 0) {
        comps = [{ representations: reps, frame: requestedFrame }];
      }
      // Save all representations mined from each component together with the additional ones
      const allReps = [];
      // Set all missing components 'representations' value with the default representations
      for (const comp of comps) {
        // DANI: Estoy modificando el componente de input añadiendole mas representations
        // DANI: lo que copio es la lista original que lo contiene, pero no el componente!!
        if (!comp.representations || comp.representations.length === 0)
          // Spread syntax here prevents the 'defaultRepresentations' to be overwritten
          comp.representations = [...defaultRepresentations];
        //console.log(components)
        //console.log(comps)
        allReps.push(...comp.representations);
      }
      // Create a new component for each additional representation with different component parameters
      // (i.e. topologyURL, trajectoryURLs or frame)
      for (const rep of additionalRepresentations) {
        // Set the component for this representation
        let comp;
        const search = comps.filter(
          c =>
            c.topologyURL === rep.topologyURL &&
            (c.trajectoryURLs && c.trajectoryURLs.join()) ===
              (rep.trajectoryURLs && rep.trajectoryURLs.join()) &&
            c.frame === rep.frame,
        );
        // Set the representation object without the component parameters
        const representation = {
          selection: rep.selection,
          name: rep.name,
          show: rep.show,
          type: rep.type,
          color: rep.color,
          opacity: rep.opacity,
          custom: true,
        };
        // If there is no result we create a new component
        if (search.length === 0) {
          // Set the component object
          const component = {
            topologyURL: rep.topologyURL,
            trajectoryURLs: rep.trajectoryURLs,
            frame: rep.frame,
            representations: [representation],
          };
          comps.push(component);
        }
        // If there is one result we assign the representation to this component
        else if (search.length === 1) {
          comp = search[0];
          comp.representations.push(representation);
        }
        // Never should be more than one component with these parameters identical
        else {
          throw new Error(`There is a duplicated NGL component`);
        }
        allReps.push(representation);
      }

      // Fill the missing 'representations' values with some default values
      allReps.forEach((rep, r) => {
        rep.index = r; // Numerate all representations to be matched by the NGL
        if (!rep.name) rep.name = 'Representation';
        if (!rep.selection) rep.selection = 'all';
        if (!rep.show) rep.show = true;
        if (!rep.type) rep.type = 'cartoon';
        if (!rep.color) rep.color = 'chainid';
        if (!rep.opacity) rep.opacity = 1;
      });
      return [comps, allReps];
    }, [
      components,
      representations,
      additionalRepresentations,
      requestedFrame,
      defaultRepresentations,
    ]);

    // Set the variable 'noTrajectory' as true when:
    // The flag 'onlyTopology' is passed
    // there is a selected unique frame to load from the main trajectory
    // The main trajectory only has 1 frame (e.g. average.xtc)
    const mainComponent = allComponents[0];
    const noTrajectory =
      preventTrajectory ||
      mainComponent.onlyTopology ||
      Number.isFinite(mainComponent.frame); // May be 0

    // Builtin states
    // They are always declared but only used when there is no forced state in the arguments
    // (They are used almost always)
    const [
      showRepresentationsBuiltin,
      setShowRepresentationsBuiltin,
    ] = useState(allRepresentations.map(rep => rep.show));
    const [nglSelectionsBuiltin, setNglSelectionsBuiltin] = useState(
      allRepresentations.map(rep => rep.selection),
    );
    const [drawingMethodsBuiltin, setDrawingMethodsBuiltin] = useState(
      allRepresentations.map(rep => rep.type),
    );
    const [coloringMethodsBuiltin, setColoringMethodsBuiltin] = useState(
      allRepresentations.map(rep => rep.color),
    );
    const [opacitieBuiltins, setOpacitiesBuiltin] = useState(
      allRepresentations.map(rep => rep.opacity),
    );

    // Set a reference to check when input arguments (components and representations) change
    const inputs = useRef({
      components: null,
      representations: null,
    });

    // Reset builtin states when inputs change
    // Set missing values in builtin states when additional representations are added by the user
    useMemo(() => {
      if (
        inputs.current.components === components &&
        components !== undefined &&
        inputs.current.representations === representations &&
        representations !== undefined
      ) {
        // 'show' values are set this way because they are booleans
        // We the other states syntax a 'false' boolean would be taken as a missing value
        setShowRepresentationsBuiltin(previous =>
          allRepresentations.map((rep, index) => {
            if (previous[index] !== undefined) return previous[index];
            return rep.show;
          }),
        );
        setNglSelectionsBuiltin(previous =>
          allRepresentations.map(
            (rep, index) => previous[index] || rep.selection,
          ),
        );
        setDrawingMethodsBuiltin(previous =>
          allRepresentations.map((rep, index) => previous[index] || rep.type),
        );
        setColoringMethodsBuiltin(previous =>
          allRepresentations.map((rep, index) => previous[index] || rep.color),
        );
        setOpacitiesBuiltin(previous =>
          allRepresentations.map(
            (rep, index) => previous[index] || rep.opacity,
          ),
        );
      } else {
        setShowRepresentationsBuiltin(allRepresentations.map(rep => rep.show));
        setNglSelectionsBuiltin(allRepresentations.map(rep => rep.selection));
        setDrawingMethodsBuiltin(allRepresentations.map(rep => rep.type));
        setColoringMethodsBuiltin(allRepresentations.map(rep => rep.color));
        setOpacitiesBuiltin(allRepresentations.map(rep => rep.opacity));
      }
      // Save a reference of components and representations to compare with future triggers
      inputs.current = { components, representations };
    }, [allRepresentations, components, representations]);

    // Real states. They get the forced state value if exist. If not, they get the builtin state value
    const [
      showRepresentations,
      setShowRepresentations,
    ] = showRepresentationsForced
      ? showRepresentationsForced
      : [showRepresentationsBuiltin, setShowRepresentationsBuiltin];
    const [nglSelections, setNglSelections] = nglSelectionsForced
      ? nglSelectionsForced
      : [nglSelectionsBuiltin, setNglSelectionsBuiltin];
    const [drawingMethods, setDrawingMethods] = drawingMethodsForced
      ? drawingMethodsForced
      : [drawingMethodsBuiltin, setDrawingMethodsBuiltin];
    const [coloringMethods, setColoringMethods] = coloringMethodsForced
      ? coloringMethodsForced
      : [coloringMethodsBuiltin, setColoringMethodsBuiltin];
    const [opacities, setOpacities] = opacitiesForced
      ? opacitiesForced
      : [opacitieBuiltins, setOpacitiesBuiltin];

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
      Math.min(defualtFrameNumber, metadata.SNAPSHOTS),
    );
    const [speed, setSpeed] = useState(useMemo(() => get('speed', 50), []));
    const [settings, openSettings] = useState(false);

    // handlers

    // Handle the automatic progress
    const handleProgress = useCallback(
      prog => {
        if (onProgress) onProgress(prog);
        setProgress(prog);
      },
      [setProgress, onProgress],
    );

    // Handle the trajectory load
    const handleLoad = useCallback(
      load => {
        setLoad(load);
      },
      [setLoad],
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
      },
      [togglePlaying],
    );

    const handleFrameChange = useCallback(
      value => {
        if (!viewerRef.current) return;
        togglePlaying(false);
        viewerRef.current.currentFrame += value;
      },
      [togglePlaying],
    );

    const handleFullscreenChange = useCallback(
      () => setIsFullscreen(screenfull.isFullscreen),
      [],
    );

    // effects
    useEffect(() => {
      screenfull.on('change', handleFullscreenChange);
      return () => screenfull.off('change', handleFullscreenChange);
    }, [handleFullscreenChange]);

    useEffect(() => {
      const handleKeyPress = event => {
        if (event.key === 'Escape') openSettings(false);
        viewerRef.current.autoResize();
      };
      document.addEventListener('keydown', handleKeyPress, false);
      return () =>
        document.removeEventListener('keydown', handleKeyPress, false);
    }, []);

    useImperativeHandle(
      ref,
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
        setShowRepresentations: setShowRepresentations,
        setNglSelections: setNglSelections,
        setDrawingMethods: setDrawingMethods,
        setColoringMethods: setColoringMethods,
        setOpacities: setOpacities,
      }),
      [
        togglePlaying,
        setShowRepresentations,
        setNglSelections,
        setDrawingMethods,
        setColoringMethods,
        setOpacities,
      ],
    );

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
            className={
              settings
                ? style['ngl-with-settings']
                : style['ngl-without-settings']
            }
            style={{ border: 'none', boxShadow: 'none' }}
            // This id prevents the mouse to drag or resize the Rnd when it is over this element
            id={'preventDragSize'}
          >
            <Card
              className={
                settings
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
                showRepresentations={showRepresentations}
                nglSelections={nglSelections}
                drawingMethods={drawingMethods}
                coloringMethods={coloringMethods}
                opacities={opacities}
                components={allComponents}
                {...props}
              />
              {settings && (
                <div className={style['settings-controls']}>
                  <div className={style['stacked-icons']}>
                    <IconButton title="Toggle spin" onClick={toggleSpinning}>
                      <FontAwesomeIcon icon={faSyncAlt} />
                    </IconButton>

                    <IconButton
                      title="Center focus"
                      onClick={event => {
                        if (!viewerRef.current) return;
                        // When the keys control, shift or command (ios) are hold while clicking
                        const getFocus =
                          event.shiftKey || event.ctrlKey || event.metaKey;
                        if (getFocus) viewerRef.current.displayFocus();
                        else viewerRef.current.centerFocus();
                      }}
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
                  components={allComponents}
                  representations={allRepresentations}
                  setAdditionalRepresentations={setAdditionalRepresentations}
                  title="Change representation parameters"
                  showRepresentations={showRepresentations}
                  setShowRepresentations={setShowRepresentations}
                  nglSelections={nglSelections}
                  setNglSelections={setNglSelections}
                  drawingMethods={drawingMethods}
                  setDrawingMethods={setDrawingMethods}
                  coloringMethods={coloringMethods}
                  setColoringMethods={setColoringMethods}
                  opacities={opacities}
                  setOpacities={setOpacities}
                />
              </div>
            )}
          </Card>
          <CardContent style={{ padding: 0 }}>
            {noTrajectory || (
              <div
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
              </div>
            )}
            <div className={style.controls}>
              <div>
                <IconButton
                  title="Close viewer"
                  className={cn({ [style.hidden]: !close })}
                  disabled={!close}
                  onClick={close}
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
                      onClick={useCallback(() => handleFrameChange(-1), [
                        handleFrameChange,
                      ])}
                    >
                      <FontAwesomeIcon icon={faStepBackward} />
                    </IconButton>
                    <IconButton
                      title={playing ? 'Pause' : 'Play'}
                      onClick={togglePlaying}
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
                      onClick={useCallback(() => handleFrameChange(1), [
                        handleFrameChange,
                      ])}
                    >
                      <FontAwesomeIcon icon={faStepForward} />
                    </IconButton>
                  </>
                )}
              </div>
              <div>
                <IconButton
                  title={`${isFullscreen ? 'Exit' : 'Go'} fullscreen`}
                  onClick={useCallback(() => {
                    if (containerRef.current)
                      screenfull.toggle(containerRef.current);
                  }, [])}
                  className={cn(style['fullscreen-toggle'], {
                    [style.hidden]: !screenfull.isEnabled,
                    [style['is-fullscreen']]: isFullscreen,
                    [style['settings']]: settings,
                  })}
                  disabled={!screenfull.isEnabled}
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

export default NGLViewerWithControls;
