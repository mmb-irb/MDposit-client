// React logic
import React, {
  useCallback,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
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
} from '@fortawesome/free-solid-svg-icons';

import RepresentationsManager from '../representations-manager';

import { get, setAsync } from '../../utils/storage';
import NGLViewer from '../ngl-viewer';
import useDefaultRepresentations from '../ngl-viewer/use-default-representations';

// Hooks
import useToggleState from '../../hooks/use-toggle-state';

import { ProjectCtx } from '../../contexts';

import Loading from '../../components/loading';

import connectionLevel, {
  LOW,
  MEDIUM,
  HIGH,
} from '../../utils/connection-level';
import reducedMotion from '../../utils/reduced-motion';

import style from './style.module.css';

// Decide that the default should be to play the trajectory only on "big enough"
// screens (as a proxy for performance and low-end device detection)
const defaultStartsPlaying = !reducedMotion() && window.innerWidth > 750;

// I set the paint icon here as constant because if it is defined as paints index it triggers the unnecessary paints rerender
// DANI: Habría que chequear que esto no pase en otros
//const paintsIcon = <FontAwesomeIcon icon={faPaintBrush} />;

// Set the possible number of frames the user can request
// DANI: Por algún motivo estos sliders parece que no pasan de 100
const frameNumbers = [
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
      //   defaultDrawingMethod: ('cartoon' by default) The initial representation 'type',
      //   defaultColoringMethod: ('chainid' by default) The initial representation 'colorScheme',
      //   defaultOpacity: ('1' by default) The initial representation opacity
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
      // The rest of properties
      ...props
    },
    ref,
  ) => {
    // Get context data only for the default setup of components and representations
    const { metadata, chains } = useContext(ProjectCtx);

    // Use this hook to get the memoized NGL default representations
    const defaultRepresentations = useDefaultRepresentations(chains, metadata);

    // Additional representations which may be added by the user
    // It is an array of objects with the following structure:
    // {
    //   topologyURL: string,
    //   trajectoryURLs: [ string ],
    //   frame: int,
    //   selection: ('all' by default) The NGL selection string to define the atom selection,
    //   name: ('representation' by default) The string label of this representation,
    //   show: ('true' by default) Boolean to set if this representation is shown or not,
    //   defaultDrawingMethod: ('cartoon' by default) The initial representation 'type',
    //   defaultColoringMethod: ('chainid' by default) The initial representation 'colorScheme',
    //   defaultOpacity: ('1' by default) The initial representation opacity
    // }
    const [additionalRepresentations, setAdditionalRepresentations] = useState(
      [],
    );

    // Set the components. If components are not provided use default values
    // Set also all representations mined from each component
    // These representations will have stated parameters which may be changed by the user
    const [allComponents, allRepresentations] = useMemo(() => {
      // WARNING!! Do not modify the original value of 'components'
      let comps;
      if (!components) comps = [];
      else comps = [...components];
      // WARNING!! Do not modify the original value of 'representations'
      let reps;
      if (!representations) reps = [];
      else reps = [...representations];

      // If there are no components we set a default value
      // If 'representations' is also undefined a default value will be assigned further
      if (comps.length === 0) {
        comps = [{ representations: reps, frame: requestedFrame }];
      }
      // Set all missing components 'representations' value with the default representations
      for (const comp of comps) {
        if (!comp.representations || comp.representations.length === 0)
          // Spread syntax here prevents the 'defaultRepresentations' to be overwritten
          comp.representations = [...defaultRepresentations];
      }
      // Create a new component for each additional representation with different component parameters
      // (i.e. topologyURL, trajectoryURLs or frame)
      for (const rep of additionalRepresentations) {
        // Set the component for this representation
        let comp;
        const search = comps.filter(
          c =>
            c.topologyURL === rep.topologyURL &&
            c.trajectoryURLs === rep.trajectoryURLs &&
            c.frame === rep.frame,
        );
        // Set the representation object without the component parameters
        const representation = {
          selection: rep.selection,
          name: rep.name,
          show: rep.show,
          defaultDrawingMethod: rep.defaultDrawingMethod,
          defaultColoringMethod: rep.defaultColoringMethod,
          defaultOpacity: rep.defaultOpacity,
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
      }

      // Save all representations mined from each component
      // These representations will have stated parameters which may be changed by the user
      const allReps = [];
      for (const comp of comps) {
        // Fill the missing 'representations' values with some default values
        for (const rep of comp.representations) {
          if (!rep.name) rep.name = 'Representation';
          if (!rep.selection) rep.selection = 'all';
          if (!rep.show) rep.show = true;
          if (!rep.defaultDrawingMethod) rep.defaultDrawingMethod = 'cartoon';
          if (!rep.defaultColoringMethod) rep.defaultColoringMethod = 'chainid';
          if (!rep.defaultOpacity) rep.defaultOpacity = 1;
          allReps.push(rep);
        }
      }

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
      allRepresentations.map(rep => rep.defaultDrawingMethod),
    );
    const [coloringMethodsBuiltin, setColoringMethodsBuiltin] = useState(
      allRepresentations.map(rep => rep.defaultColoringMethod),
    );
    const [opacitieBuiltins, setOpacitiesBuiltin] = useState(
      allRepresentations.map(rep => rep.defaultOpacity),
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
        inputs.current.representations === representations
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
          allRepresentations.map(
            (rep, index) => previous[index] || rep.defaultDrawingMethod,
          ),
        );
        setColoringMethodsBuiltin(previous =>
          allRepresentations.map(
            (rep, index) => previous[index] || rep.defaultColoringMethod,
          ),
        );
        setOpacitiesBuiltin(previous =>
          allRepresentations.map(
            (rep, index) => previous[index] || rep.defaultOpacity,
          ),
        );
      } else {
        setShowRepresentationsBuiltin(allRepresentations.map(rep => rep.show));
        setNglSelectionsBuiltin(allRepresentations.map(rep => rep.selection));
        setDrawingMethodsBuiltin(
          allRepresentations.map(rep => rep.defaultDrawingMethod),
        );
        setColoringMethodsBuiltin(
          allRepresentations.map(rep => rep.defaultColoringMethod),
        );
        setOpacitiesBuiltin(allRepresentations.map(rep => rep.defaultOpacity));
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

    // Remember the default drawing methods, coloring methods and opacity values
    const defaults = useRef({
      showRepresentations: [...showRepresentations],
      nglSelections: [...nglSelections],
      drawingMethods: [...drawingMethods],
      coloringMethods: [...coloringMethods],
      opacities: [...opacities],
    });

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
    const [isFullscreen, setIsFullscreen] = useState(screenfull.isFullscreen);
    const [nFrames, setNFrames] = useState(
      useMemo(() => {
        switch (connectionLevel()) {
          case HIGH:
            return 50;
          case MEDIUM:
            return 25;
          case LOW:
          default:
            return 10;
        }
      }, []),
    );
    const [speed, setSpeed] = useState(useMemo(() => get('speed', 50), []));
    const [settings, openSettings] = useState(false);

    // handlers
    // handle click or click & drag progress bar
    const handleManualProgress = useCallback(
      ({ buttons, clientX, currentTarget, type }) => {
        if (!viewerRef.current) return;
        // if mousemove event, but the main button is not pressed, bail
        if (type === 'mousemove' && buttons !== 1) return;
        const { x, width } = currentTarget.getBoundingClientRect();
        togglePlaying(false);
        viewerRef.current.currentFrame = Math.floor(
          ((clientX - x) / width) * viewerRef.current.totalFrames,
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
      }),
      [],
    );

    // Return loading if the context is not loaded yet
    // DANI: Esto podría no tener mucho sentido aquí, hay que darle una vuelta
    //if (!metadata || !chains) return <Loading />;

    // DANI: La metadata habría que plantearse hasta que punto es un requisito indispensable
    // Gran parte del NGL podría seguir funcionando en una trayectoria que por error no tiene metadata
    if (!metadata) return <Loading />;

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
          >
            <Card
              className={
                settings
                  ? cn(style['settings-left'], className)
                  : cn(style['ngl-alone'], className)
              }
              style={{ border: 'none', boxShadow: 'none' }}
            >
              <NGLViewer
                playing={playing}
                spinning={spinning}
                smooth={smooth}
                onProgress={setProgress}
                ref={viewerRef}
                noTrajectory={noTrajectory}
                nFrames={nFrames}
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
                      onClick={() => {
                        if (viewerRef.current) viewerRef.current.centerFocus();
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
                        disabled={!playing}
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
                          value={nFrames}
                          onChange={(_, value) => setNFrames(value)}
                          aria-labelledby="discrete-slider-restrict"
                          step={null}
                          valueLabelDisplay="auto"
                          marks={frameNumbers}
                        />
                      ) : (
                        // DANI: Esto puede que no esté bien. Deberían ser 20 frames cuando es una PCA projection
                        ' ' + nFrames
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
            {settings && (
              <div className={style['settings-right']}>
                <RepresentationsManager
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
                  defaults={defaults.current}
                />
              </div>
            )}
          </Card>
          <CardContent className={style['bottom-controls']}>
            {noTrajectory || (
              <div
                className={cn(style.progress, { [style.dark]: darkBackground })}
                onClick={handleManualProgress}
                onMouseMove={handleManualProgress}
              >
                <LinearProgress
                  variant="determinate"
                  color="secondary"
                  value={progress * 100}
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
