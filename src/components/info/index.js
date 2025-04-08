import React, { useState, forwardRef } from 'react';

import { IconButton, Tooltip, ClickAwayListener } from '@mui/material';
import { tooltipClasses } from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';
//import { makeStyles } from '@mui/styles';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

import style from './style.module.css';

// WARNING: Some styling parameters has no effect through the classic css way
// They must be declared this way
// The forwardRef and passing the ref to the tooltip is necessary for this to work since React 18 / Material UI v5
// Here is explained why: https://mui.com/material-ui/guides/composition/#caveat-with-refs
const CustomTooltip = styled(
  forwardRef(({ className, ...props }, ref) => {
    return <Tooltip {...props} classes={{ popper: className }} ref={ref} />;
  }),
)(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    fontSize: '1em',
    maxWidth: '100%',
    margin: '0',
  },
}));

const Info = ({
  // Message to be displayed when the mouse is over the info icon
  tooltip,
  // Set a custom styling
  className,
  // Set a custom styling for the tooltip
  sx
}) => {
  const [open, setOpen] = useState(false);

  const toogleOpen = () => setOpen(previous => !previous);
  const closeIt = () => setOpen(false);

  // Render
  return (
    <ClickAwayListener onClickAway={closeIt}>
      <CustomTooltip
        title={tooltip}
        disableFocusListener
        disableHoverListener
        disableTouchListener
        open={open}
      >
        <IconButton
          className={className || style.default}
          color={open ? 'info' : 'primary'}
          onClick={toogleOpen}
          sx={sx}
        >
          <FontAwesomeIcon icon={faInfoCircle} size={'lg'} />
        </IconButton>
      </CustomTooltip>
    </ClickAwayListener>
  );
};

export default Info;
