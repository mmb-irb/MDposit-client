// React logic
import React, {
  useCallback,
  useState,
  useEffect,
  useRef,
  useMemo,
  useContext,
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
  faPuzzlePiece,
  faPaintBrush,
  faWalking,
  faRunning,
  faBiking,
  faTimes,
  faLock,
  faUnlock,
} from '@fortawesome/free-solid-svg-icons';

import { ProjectCtx } from '../../contexts';

import Slider from '../slider';
import Chains from '../chains';

import { get, setAsync } from '../../utils/storage';
import NGLViewer from '../ngl-viewer';

// Hooks
import useToggleState from '../../hooks/use-toggle-state';

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
      noTrajectory,
      close,
      nail,
      projection,
      ...props
    },
    ref,
  ) => {
    // Context
    const { chains } = useContext(ProjectCtx) || [];

    // references
    const containerRef = useRef(null);
    const viewerRef = useRef(null);

    // toggle states
    const [nailed, toggleNailed] = useToggleState(false);
    const [playing, togglePlaying] = useToggleState(startsPlaying);
    const [spinning, toggleSpinning] = useToggleState(false);
    const [smooth, toggleSmooth] = useToggleState(false);
    const [darkBackground, toggleDarkBackground] = useToggleState(
      useMemo(() => get('dark-background', true), []),
    );
    const [perspective, togglePerspective] = useToggleState(
      useMemo(() => get('perspective', false), []),
    );

    // states
    const [progress, setProgress] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(screenfull.isFullscreen);
    const [membraneOpacity, setMembraneOpacity] = useState(
      Number.isFinite(projection)
        ? 0
        : useMemo(() => get('membrane-opacity', 0.5), []),
    );
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
    const [bannedChains, chainBanner] = useState('');

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
            membraneOpacity={membraneOpacity}
            smooth={smooth}
            onProgress={setProgress}
            ref={viewerRef}
            noTrajectory={noTrajectory}
            nFrames={nFrames}
            darkBackground={darkBackground}
            perspective={perspective}
            projection={projection}
            speed={speed}
            bannedChains={bannedChains}
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
                onClick={() => {
                  nail(!nailed);
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

            <Chains
              className={style.slider}
              label="Chains display:"
              title="Change displayed chains"
              chains={chains}
              bannedChains={bannedChains}
              chainBanner={chainBanner}
            >
              <FontAwesomeIcon icon={faPuzzlePiece} />
            </Chains>

            {!Number.isFinite(projection) && (
              <Slider
                className={style.slider}
                label="Membrane opacity:"
                title="Change membrane opacity"
                value={membraneOpacity * 100}
                handleChange={(_, value) => {
                  setMembraneOpacity(value / 100);
                  setAsync('membrane-opacity', value / 100);
                }}
              >
                <FontAwesomeIcon icon={faPaintBrush} />
              </Slider>
            )}

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

            {!Number.isFinite(projection) && !noTrajectory && (
              <FormControl>
                <InputLabel>frames</InputLabel>
                <Select
                  native
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
