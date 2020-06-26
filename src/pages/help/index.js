// React logic
import React, { useRef, useEffect, createRef } from 'react';

// Visual assets
import { Card, CardHeader, CardContent } from '@material-ui/core';

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
import {
  faDotCircle,
  faImages,
  faSquare,
} from '@fortawesome/free-regular-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Icon } from '@material-ui/core';

import style from './style.module.css';

// All text to be displayed is set previously here
const documentation = [
  {
    id: 'ngl-viewer',
    header: 'NGL viewer',
    body: (
      <>
        NGL Viewer is a collection of tools for web-based molecular graphics.
        <br />
        <br />
        The BioExcel implementation of NGL viewer is a dynamic component useful
        to represent molecular structures and trajectories which the user can
        interact with.
        <br />
        <br />
        This component may be integrated in the web page structure (e.g. in the
        "trajectory" sheet) or an independent pop-up window which is draggable
        and resizable. To do so, hold left click in the the window borders and
        drag.
        <br />
        <br />
        Use the mouse inside the NGL window to move the camera (hold right
        click), rotate the camera (hold left click) or zoom the camera (mouse
        wheel). Hover any atom with the mouse to get extra topology data
        (residue type and number, atom type and chain id) or left click on any
        atom to make the camera focus on it.
        <br />
        <br />
        Also some controls ara available under the NGL viewer in order to change
        other parameters:
        <br />
        <Icon>
          <FontAwesomeIcon icon={faTimes} />
        </Icon>{' '}
        (Only in pop-up) The "close" button is used to remove the whole NGL
        viewer pop-up window.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faUnlock} />
        </Icon>
        {' / '}
        <Icon color="disabled">
          <FontAwesomeIcon icon={faLock} />
        </Icon>{' '}
        (Only in pop-up) The "lock" button is used to make the current NGL
        viewer pop-up window stay as it is. So when a new selection is requested
        a new NGL window is opened instead of updating the locked window.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faStepBackward} />
        </Icon>
        {', '}
        <Icon>
          <FontAwesomeIcon icon={faStepForward} />
        </Icon>{' '}
        (Only with trajectory data) The "Previous frame" and "Next frame"
        buttons respectively are used to move through trajectory frames one by
        one.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faPlay} />
        </Icon>
        {' / '}
        <Icon>
          <FontAwesomeIcon icon={faPause} />
        </Icon>{' '}
        (Only with trajectory data) The "Play / Pause" button is used to start
        or stop the trajectory animation.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faExpand} />
        </Icon>
        {' / '}
        <Icon>
          <FontAwesomeIcon icon={faCompress} />
        </Icon>{' '}
        The "Enter / Exit full screen" button is used to make the NGL window
        expand to full screen or compress back to its normal size. User can also
        press "Esc" key to exit the full screen mode.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faSyncAlt} />
        </Icon>{' '}
        The "Toogle spin" button is used to make the camera slowly rotate around
        its focus.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faDotCircle} />
        </Icon>{' '}
        The "Center focus" button is used to make the camera return to its
        original focus.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faImages} />
        </Icon>
        {' / '}
        <Icon>
          <FontAwesomeIcon icon={faVideo} />
        </Icon>{' '}
        (Only with trajectory data) The "Smooth interpolation" button is used to
        smooth the jump between frames by adding extra frames in-between where
        the atom positions are interpolated.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faAdjust} />
        </Icon>{' '}
        The "Invert background color" button is used to switch background color
        between black and white.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faSquare} />
        </Icon>
        {' / '}
        <Icon>
          <FontAwesomeIcon icon={faCube} />
        </Icon>{' '}
        The "Orthographic / Perspective" button is used to change the view mode
        between 2D projection (orthographic or isometric) and 3D projection
        (perspective).
        <br />
        <Icon>
          <FontAwesomeIcon icon={faPaintBrush} />
        </Icon>{' '}
        The "Painter" button is used to set the drawing and coloring methods and
        the opacity of each representation.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faWalking} />
        </Icon>
        {' / '}
        <Icon>
          <FontAwesomeIcon icon={faRunning} />
        </Icon>
        {' / '}
        <Icon>
          <FontAwesomeIcon icon={faBiking} />
        </Icon>{' '}
        The "Speed" bar is used to set how fast is the trajectory animation.
        <br />
        * Hover any button in the NGL window with the mouse to show a summary
        title.
        <br />
        <br />
        For more information about the original project, please check the
        oficial{' '}
        <a
          href="http://nglviewer.org/"
          target="_blank"
          rel="noreferrer noopener"
        >
          NGL viewer web page
        </a>
        .
      </>
    ),
  },
  {
    id: 'data-tables',
    header: 'Data tables',
    body: `Data tables are dynamic supports to handle large data sets display.
        These components allows to represent small subsets of data in a classic
         "rows and columns" format where the user can select the page and rows per
         page to be shown.`,
  },
  {
    id: 'rmsd-perres',
    header: 'RMSd per residue',
    body: `The RMSD (Root Mean Squared Deviation) per residue analysis computes the
        mean and standard deviation distance between the original position of each
        residue and their positions along each frame.
        This analysis is powered by PyTraj`,
  },
];

const Help = ({ location }) => {
  // References to all documentation blocks will be stored here
  const docRefs = useRef(Array(documentation.length).fill(createRef()));

  // Scroll down to the asked reference
  useEffect(() => {
    for (const ref of docRefs.current)
      if (location.hash === '#' + ref.id)
        return window.scrollTo(0, ref.offsetTop);
  }, [location.hash]);

  return documentation.map((doc, index) => (
    <Card
      key={index}
      id={doc.id}
      ref={r => (docRefs.current[index] = r)}
      className={style.card}
    >
      <CardHeader title={doc.header} />
      <CardContent>{doc.body}</CardContent>
    </Card>
  ));
};

export default Help;
