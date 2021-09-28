import React, { useState } from 'react';

import { IconButton, Tooltip, ClickAwayListener } from '@material-ui/core';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

import { makeStyles } from '@material-ui/core/styles';

import style from './style.module.css';

const Info = ({
  // Message to be displayed when the mouse is over the info icon
  tooltip,
  // Set a custom styling
  className,
}) => {
  const [open, setOpen] = useState(false);

  const toogleOpen = () => setOpen(previous => !previous);
  const closeIt = () => setOpen(false);

  // WARNING: Some styling parameters has no effect through the classic css way
  // They must be declared this way
  const useStyles = makeStyles(() => ({
    tooltip: {
      fontSize: '1em',
      maxWidth: '100%',
      margin: '0',
    },
  }));
  const classes = useStyles();

  // Render
  return (
    <ClickAwayListener onClickAway={closeIt}>
      <Tooltip
        title={tooltip}
        classes={{ tooltip: classes.tooltip }}
        // Make the tooltip links work
        interactive
        disableFocusListener
        disableHoverListener
        disableTouchListener
        open={open}
      >
        <IconButton
          className={className || style.default}
          color={open ? 'secondary' : 'primary'}
          onClick={toogleOpen}
        >
          <FontAwesomeIcon icon={faInfoCircle} size={'lg'} />
        </IconButton>
      </Tooltip>
    </ClickAwayListener>
  );
};

export default Info;
