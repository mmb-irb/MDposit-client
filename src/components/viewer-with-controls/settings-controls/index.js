// React logic
import React from 'react';
import cn from 'classnames';
// Visual assets
import { Grid, Icon, IconButton, Slider } from '@mui/material';
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
} from '@fortawesome/free-solid-svg-icons';

import { setAsync } from '../../../utils/storage';

// The two interchangeable viewer backends, used here only to compare/switch
import MolstarViewer from '../../molstar-viewer';
import NGLViewer from '../../ngl-viewer';

// Import CSS style
import style from './style.module.css';

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
  // When true, the controls are docked at the bottom of the representations panel
  // (normal flow) instead of floating as a translucent overlay over the viewer
  docked = false,
}) => (
  <div
    className={cn(style['settings-controls'], {
      [style.dark]: darkBackground,
      [style.docked]: docked,
    })}
  >
    <div className={style['stacked-icons']}>
      <IconButton title="Toggle spin" onClick={toggleSpinning} size="large">
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
        <div
          className={style['stacked-icons']}
          title={
            hasPbcResidues
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
            disabled={hasPbcResidues}
            size="large"
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
        title={`Switch to ${perspective ? 'ortographic' : 'perspective'} view`}
        onClick={() => {
          togglePerspective();
          setAsync('perspective', !perspective);
        }}
        size="large"
      >
        <FontAwesomeIcon icon={perspective ? faSquare : faCube} />
      </IconButton>

      <IconButton
        title={`Switch viwer to ${Viewer === NGLViewer ? 'MolStar' : 'NGL'}`}
        onClick={() => {
          setViewer(currentViewer => {
            if (currentViewer === NGLViewer) return MolstarViewer;
            if (currentViewer === MolstarViewer) return NGLViewer;
            throw new Error('Unrecognized current viewer');
          });
        }}
        size="large"
      >
        <FontAwesomeIcon icon={Viewer === NGLViewer ? faStarOfLife : faShareAlt} />
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
          size="large"
        >
          <FontAwesomeIcon icon={faLayerGroup} />
        </IconButton>
      )}
    </div>
    {noTrajectory || (
      <div>
        Speed:
        <Grid container spacing={2}>
          <Grid>
            <Icon>
              <FontAwesomeIcon icon={faWalking} />
            </Icon>
          </Grid>
          <Grid size="grow">
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
          <Grid>
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
            onChange={(_, value) => setRequestedFramesNumber(value)}
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
);

SettingsControls.displayName = 'SettingsControls';
export default SettingsControls;
