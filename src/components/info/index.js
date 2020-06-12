import React, { useState } from 'react';

import { IconButton, Tooltip } from '@material-ui/core';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

import { makeStyles } from '@material-ui/core/styles';

import style from './style.module.css';

const Info = ({
  // Message to be displayed when the mouse is over the info icon
  tooltip,
  // Link to be linked when the the icon is clicked
  ref,
}) => {
  const [onHover, setOnHover] = useState(false);

  const useStyles = makeStyles(theme => ({
    tooltip: {
      fontSize: '1.5em',
      maxWidth: '99%',
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
      //className={style.tooltip}
      //placement="left-end"
      classes={{ tooltip: classes.tooltip }}
    >
      <IconButton
        onClick={() => console.log('hi :)')}
        onMouseOver={() => setOnHover(true)}
        onMouseOut={() => setOnHover(false)}
        className={classes.button}
        //className={style.icon}

        color={onHover ? 'secondary' : 'primary'}
      >
        <FontAwesomeIcon icon={faInfoCircle} size={'lg'} />
      </IconButton>
    </Tooltip>
  );
};

export default Info;
