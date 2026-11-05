// React logic
import React, { lazy } from 'react';
import cn from 'classnames';
// Visual assets
import { Checkbox, IconButton, Slider } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDotCircle,
  faImages,
  faSquare,
} from '@fortawesome/free-regular-svg-icons';
import {
  faSyncAlt,
  faVideo,
  faAdjust,
  faCube,
  faWalking,
  faBiking,
  faStarOfLife,
  faShareAlt, // It looks like connected atoms
  faLayerGroup, // It looks like membrane leaflets
  faVectorSquare, // It looks like the simulation box
} from '@fortawesome/free-solid-svg-icons';

import { setAsync } from '../../../utils/storage';

// The two interchangeable viewer backends, used here only to compare/switch
import NGLViewer from '../../ngl-viewer';
// Mol* is a ~3 MB chunk only needed once the user switches to it, so it is loaded lazily
// The lazy component is created once here so the identity checks below keep working
const MolstarViewer = lazy(() =>
  import(/* webpackChunkName: 'molstar-viewer' */ '../../molstar-viewer'),
);

// Import CSS style
import style from './style.module.css';

// Range of the clipping slab thickness (Å) when the size of the scene is still unknown
const MIN_SLAB_THICKNESS = 4;
const DEFAULT_MAX_SLAB_THICKNESS = 200;

// The floating panel of viewer controls (spin/focus/smooth/background/perspective/viewer switch)
// plus the player speed and frame-number sliders.
// It is rendered as a translucent overlay on top of the viewer so the structure
// remains visible behind it.
const SettingsControls = ({
  // Reference to the underlying viewer (NGL/MolStar) to trigger focus actions
  viewerRef,
  // Whether there is no trajectory to play (hides trajectory-only controls)
  noTrajectory,
  // Whether there are residues under Periodic Boundary Conditions (forbids smoothing)
  hasPbcResidues,
  // Spin toggle
  toggleSpinning,
  // Smooth interpolation state and setter
  smooth,
  setSmooth,
  // Background color state and toggle
  darkBackground,
  toggleDarkBackground,
  // Camera perspective state and toggle
  perspective,
  togglePerspective,
  // Which viewer backend is active and its setter
  Viewer,
  setViewer,
  // Whether the user may switch to the MolStar viewer (see ViewerWithControls)
  allowMolstar,
  // Player speed state and setter
  speed,
  setSpeed,
  // Whether the frame-number selector is allowed
  framesSelect,
  // Requested frames number state and setter
  requestedFramesNumber,
  setRequestedFramesNumber,
  // Available frame-number options (marks) for the frames slider
  frameNumbers,
  // Membrane simulations only: enable + drive the reduced membrane view toggle
  showMembraneToggle,
  membraneReduced,
  setMembraneReduced,
  // Simulation box toggle and the reason why the box can not be shown, if so
  boxUnavailableReason,
  showBox,
  toggleShowBox,
  // Clipping toggle and thickness (Å) of the slab which is shown around the focus
  clipping,
  setClipping,
  slabThickness,
  setSlabThickness,
  // When true, the controls are docked at the bottom of the representations panel
  // (normal flow) instead of floating as a translucent overlay over the viewer
  docked = false,
}) => {
  // The slab can be as thick as the whole scene, which is not known until the structure is loaded
  const sceneDiameter = (viewerRef && viewerRef.current && viewerRef.current.sceneDiameter) || 0;
  const slabMax = Math.max(MIN_SLAB_THICKNESS + 1, Math.ceil(sceneDiameter) || DEFAULT_MAX_SLAB_THICKNESS);
  return (
    <div
      className={cn(style['settings-controls'], {
        [style.dark]: darkBackground,
        [style.docked]: docked,
      })}
    >
      <div className={style['stacked-icons']}>
        <IconButton title="Toggle spin" onClick={toggleSpinning}>
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
        >
          <FontAwesomeIcon icon={faDotCircle} />
        </IconButton>

        {noTrajectory || (
          <div
            className={style['stacked-icons']}
            title={
              Viewer === MolstarViewer
                ? 'Smooth interpolation is only available in the NGL viewer.'
                : hasPbcResidues
                ? 'Smooth interpolation is not allowed since there are residues under Periodic Boundary Conditions. ' +
                  'The smoothing may result in misleading artifacts for those atoms jumping across boundaries.'
                : undefined
            }
          >
            <IconButton
              title={`Toggle smooth interpolation ${smooth ? 'off' : 'on'}`}
              onClick={() => setSmooth(previous => !previous)}
              // If there are PBC residues then forbid the smooth to prevent misleads
              // Note that the smoothing may result in artifacts for those atoms jumping across boundaries
              // This is very clear for solvent/counter ions (breathing effect) and also visible in membrane residues
              // MolStar plays whole frames only, so it can not interpolate
              disabled={hasPbcResidues || Viewer === MolstarViewer}
            >
              <FontAwesomeIcon icon={smooth ? faImages : faVideo} />
            </IconButton>
          </div>
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
          title={`Switch to ${perspective ? 'ortographic' : 'perspective'} view`}
          onClick={() => {
            togglePerspective();
            setAsync('perspective', !perspective);
          }}
        >
          <FontAwesomeIcon icon={perspective ? faSquare : faCube} />
        </IconButton>

        {/* Membrane simulations: toggle the reduced membrane view (protein/solute + headgroups) */}
        {/* When active only the membrane headgroups are loaded and shown as spacefill */}
        {showMembraneToggle && (
          <IconButton
            title={membraneReduced
              ? 'Simplified membrane view is ON: only the membrane headgroups (shown as spacefill) and the protein/solute are loaded. Click to load the whole membrane.'
              : 'Simplified membrane view is OFF: the whole system is loaded. Click to show only the membrane headgroups as spacefill.'}
            onClick={() => setMembraneReduced(previous => !previous)}
            color={membraneReduced ? 'primary' : 'default'}
          >
            <FontAwesomeIcon icon={faLayerGroup} />
          </IconButton>
        )}

        {/* Disabled buttons get no mouse events, so the reason is shown in a wrapper */}
        <span className={style['stacked-icons']} title={boxUnavailableReason || undefined}>
          <IconButton
            title={showBox ? 'Hide simulation box' : 'Show simulation box'}
            onClick={toggleShowBox}
            disabled={!!boxUnavailableReason}
            color={showBox && !boxUnavailableReason ? 'primary' : 'default'}
          >
            <FontAwesomeIcon icon={faVectorSquare} />
          </IconButton>
        </span>

        {allowMolstar && (
          <IconButton
            title={`Switch viwer to ${Viewer === NGLViewer ? 'MolStar' : 'NGL'}`}
            onClick={() => {
              setViewer(currentViewer => {
                if (currentViewer === NGLViewer) return MolstarViewer;
                if (currentViewer === MolstarViewer) return NGLViewer;
                throw new Error('Unrecognized current viewer');
              });
            }}
          >
            <FontAwesomeIcon icon={Viewer === NGLViewer ? faStarOfLife : faShareAlt} />
          </IconButton>
        )}
      </div>
      {noTrajectory || (
        <div className={style.row}>
          <span className={style.label}>Speed</span>
          <FontAwesomeIcon icon={faWalking} className={style.end} />
          <Slider
            size="small"
            title="Change player speed"
            value={speed}
            aria-label="Player speed"
            onChange={(_, value) => {
              setSpeed(value);
              setAsync('speed', value);
            }}
          />
          <FontAwesomeIcon icon={faBiking} className={style.end} />
        </div>
      )}
      <div className={style.row}>
        <label className={style.label}>
          Clipping
          <Checkbox
            size="small"
            className={style.checkbox}
            checked={!!clipping}
            onChange={event => setClipping(event.target.checked)}
            inputProps={{ title: 'Show only a slab around the focus' }}
          />
        </label>
        <Slider
          size="small"
          title="Thickness of the slab which is shown around the focus"
          value={Math.min(slabThickness, slabMax)}
          min={MIN_SLAB_THICKNESS}
          max={slabMax}
          disabled={!clipping}
          aria-label="Clipping slab thickness in Å"
          onChange={(_, value) => setSlabThickness(value)}
        />
        <span className={style.value}>{`${Math.min(slabThickness, slabMax)} Å`}</span>
      </div>
      {noTrajectory || (
        <div className={cn(style.row, { [style.marked]: framesSelect })}>
          <span className={style.label}>Frames</span>
          {framesSelect ? (
            <Slider
              size="small"
              title="Select frame number"
              value={requestedFramesNumber}
              onChange={(_, value) => setRequestedFramesNumber(value)}
              aria-label="Frames number"
              step={null}
              valueLabelDisplay="auto"
              marks={frameNumbers}
              max={frameNumbers[frameNumbers.length - 1].value}
            />
          ) : (
            // DANI: Esto puede que no esté bien. Deberían ser 20 frames cuando es una PCA projection
            // The lazy Mol* viewer has no ref while its chunk is still loading
            viewerRef.current && viewerRef.current.totalExpectedFrames
          )}
        </div>
      )}
    </div>
  );
};

SettingsControls.displayName = 'SettingsControls';
export default SettingsControls;
