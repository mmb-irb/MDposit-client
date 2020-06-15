import React, { useState } from 'react';

import { IconButton, Tooltip } from '@material-ui/core';

import { Link } from 'react-router-dom';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

import { makeStyles } from '@material-ui/core/styles';

const Info = ({
  // Message to be displayed when the mouse is over the info icon
  tooltip,
  // Link to be linked when the the icon is clicked
  reference,
}) => {
  const [open, setOpen] = useState(false);

  // Some styling parameters has no effect through the classic css way
  // They must be declared this way
  const useStyles = makeStyles(theme => ({
    tooltip: {
      fontSize: '1em',
      maxWidth: '100%',
      margin: '1em',
    },
    button: {
      margin: theme.spacing(1),
      position: 'absolute',
      right: 0,
    },
  }));
  const classes = useStyles();

  // Render
  return (
    <Tooltip
      title={tooltip}
      classes={{ tooltip: classes.tooltip }}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      // Make the tooltip stay when the mose is over it and its text selectable
      interactive
      // Makes the tooltip stay fro 0,2 seconds after the mouse is out
      leaveDelay={200}
    >
      <IconButton
        component={Link}
        to={`/help#${reference}`}
        className={classes.button}
        color={open ? 'secondary' : 'primary'}
      >
        <FontAwesomeIcon icon={faInfoCircle} size={'lg'} />
      </IconButton>
    </Tooltip>
  );
};

export default Info;
