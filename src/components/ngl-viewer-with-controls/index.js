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
  CardContent,
  LinearProgress,
  IconButton,
  Select,
  FormControl,
  InputLabel,
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
  faCube,
  faPaintBrush,
  faWalking,
  faRunning,
  faBiking,
  faTimes,
  faLock,
  faUnlock,
} from '@fortawesome/free-solid-svg-icons';

import Slider from '../slider';
import Paints from '../paints';

import { get, setAsync } from '../../utils/storage';
import NGLViewer from '../ngl-viewer';

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
      // The NGL representations
      // It is an array with objects with the following structure:
      // {
      //   selection: ('all' by default) The NGL selection string to define the atom selection,
      //   name: ('representation' by default) The string label of this representation,
      //   show: ('true' by default) Boolean to set if this representation is shown or not,
      //   defaultDrawingMethod: ('cartoon' by default) The initial representation 'type',
      //   defaultColoringMethod: ('chainid' by default) The initial representation 'colorScheme',
      //   defaultOpacity: ('1' by default) The initial representation opacity
      //   other: object with any other ngl options to be passed for the representation
      // }
      representations = [],
      // New method to call the NGL
      // Components are objects which may include the following values
      // All values are optional since missing values will be set by default
      //  {
      //    topologyURL: string,
      //    frame: int,
      //    representations: [...],
      //  }
      components = [],
      ...props
    },
    ref,
  ) => {
    // Get context data only for the default setup of components and representations
    const { metadata, chains } = useContext(ProjectCtx);

    // Set the chains to be represented in the NGL viewer by default
    // WARNING: This is experimental and may have some bugs
    const defaultRepresentations = useMemo(() => {
      if (!metadata || !chains) return;
      // Represent each protein chain
      const reps = [];
      for (const chain of chains) {
        // DANI: Hardcodeado para los glicanos de las trayectorias de Amaro
        if (chain === 'G') {
          reps.push({
            name: 'Glycans',
            selection: ':G',
            defaultDrawingMethod: 'licorice',
          });
          continue;
        }
        reps.push({
          name: 'Chain ' + chain,
          selection: ':' + chain,
        });
      }
      // Represent the mebrane if exist
      if (metadata.MEMBRANE !== 'No')
        reps.push({
          selection: '(not polymer or hetero) and not (water or ion)',
          name: metadata.MEMBRANE,
          defaultDrawingMethod: 'licorice',
          defaultOpacity: 0.5,
        });
      // Show also all ligands with licorice representations
      if (metadata.LIGANDS) {
        for (const ligand of metadata.LIGANDS) {
          reps.push({
            name: ligand.name,
            selection: ligand.ngl_selection,
            defaultDrawingMethod: 'licorice',
          });
        }
      }

      return reps;
    }, [chains, metadata]);

    // If there are no components or representations we set a default value
    if (
      (!components || components.length === 0) &&
      (!representations || representations.length === 0)
    )
      representations = defaultRepresentations;

    if (!metadata || !chains) return <Loading />;

    // 'representations' is an alternative (and the original) method to call the NGL
    // Here we convert old inputs to the new format: 'components'
    if (
      (!components || components.length === 0) &&
      (representations && representations.length > 0)
    ) {
      components = [
        { representations: representations, frame: requestedFrame },
      ];
    }

    // Save all representations mined from each component
    const allRepresentations = [];

    for (const comp of components) {
      // Create a generic 'representations' value when missing
      if (!comp.representations || comp.representations.length === 0)
        comp.representations = defaultRepresentations;
      // Fill the missing 'representations' values with some default values
      for (const rep of comp.representations) {
        if (!rep.name) rep.name = 'Representation';
        if (!rep.selection) rep.selection = 'all';
        if (!rep.show) rep.show = true;
        if (!rep.defaultDrawingMethod) rep.defaultDrawingMethod = 'cartoon';
        if (!rep.defaultColoringMethod) rep.defaultColoringMethod = 'chainid';
        if (!rep.defaultOpacity) rep.defaultOpacity = 1;
        allRepresentations.push(rep);
      }
    }

    // When there is only 1 frame to load or all representations have their specific frame
    const noTrajectory = Number.isFinite(components[0].frame);

    const [drawingMethods, setDrawingMethods] = useState(() => {
      const init = [];
      for (const rep of allRepresentations) {
        init.push(rep.defaultDrawingMethod);
      }
      return init;
    });
    const [coloringMethods, setColoringMethods] = useState(() => {
      const init = [];
      for (const rep of allRepresentations) {
        init.push(rep.defaultColoringMethod);
      }
      return init;
    });
    const [opacities, setOpacities] = useState(() => {
      const init = [];
      for (const rep of allRepresentations) {
        init.push(rep.defaultOpacity);
      }
      return init;
    });
    // Remember the default drawing methods, coloring methods and opacity values
    const defaults = useRef({
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

    let speedIcon = faWalking;
    if (speed > 45) speedIcon = faRunning;
    if (speed > 90) speedIcon = faBiking;

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
      }),
      [],
    );

    // Return loading if the context is not loaded yet
    // DANI: Esto podría no tener mucho sentido aquí, hay que darle una vuelta
    //if (!metadata || !chains) return <Loading />;

    return (
      <div
        className={cn(style['fullscreen-target'], {
          [style['is-fullscreen']]: isFullscreen,
        })}
        ref={containerRef}
      >
        <CardContent className={cn(style['card-content'], className)}>
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
            drawingMethods={drawingMethods}
            coloringMethods={coloringMethods}
            opacities={opacities}
            components={components}
            {...props}
          />
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
            {close && (
              <IconButton title="Close viewer" onClick={close}>
                <FontAwesomeIcon icon={faTimes} />
              </IconButton>
            )}

            {nail && (
              <IconButton
                title={nailed ? 'Unnail viewer' : 'Nail viewer'}
                disabled={nailed}
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
            )}

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

            {screenfull.isEnabled && (
              <IconButton
                title={`${isFullscreen ? 'exit' : 'go'} fullscreen`}
                onClick={useCallback(() => {
                  if (containerRef.current)
                    screenfull.toggle(containerRef.current);
                }, [])}
                className={cn(style['fullscreen-toggle'], {
                  [style['is-fullscreen']]: isFullscreen,
                })}
              >
                <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
              </IconButton>
            )}

            <IconButton title="Toggle spin" onClick={toggleSpinning}>
              <FontAwesomeIcon icon={faSyncAlt} />
            </IconButton>

            <IconButton
              title="Center focus"
              onClick={useCallback(() => {
                if (viewerRef.current) viewerRef.current.centerFocus();
              }, [])}
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

            <Paints
              representations={allRepresentations}
              title="Change representation parameters"
              drawingMethods={drawingMethods}
              setDrawingMethods={setDrawingMethods}
              coloringMethods={coloringMethods}
              setColoringMethods={setColoringMethods}
              opacities={opacities}
              setOpacities={setOpacities}
              defaults={defaults.current}
            >
              <FontAwesomeIcon icon={faPaintBrush} />
            </Paints>

            {!noTrajectory && (
              <Slider
                className={style.slider}
                label="Player speed:"
                title="Change player speed"
                value={speed}
                handleChange={(_, value) => {
                  setSpeed(value);
                  setAsync('speed', value);
                }}
              >
                <FontAwesomeIcon icon={speedIcon} />
              </Slider>
            )}

            {framesSelect && !noTrajectory && (
              <FormControl>
                <InputLabel>frames</InputLabel>
                <Select
                  // DANI: Esto de 'native' hace que quede mucho mejor
                  // DANI: El problema es un bug inexplicable en mozilla que hace que el 'Rnd' salte mucho
                  // DANI: Cuando no es 'native' aparece un log de error en consola. De momento lo ignoro
                  //native
                  value={nFrames}
                  onChange={({ target: { value } }) => setNFrames(value)}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                </Select>
              </FormControl>
            )}
          </div>
        </CardContent>
      </div>
    );
  },
);

export default NGLViewerWithControls;
