import React, { useLayoutEffect } from 'react';
import cn from 'classnames';
//import { sleep, frame } from 'timing-functions';

import { CircularProgress } from '@mui/material';

import useToggleState from '../../hooks/use-toggle-state';
import { useHoldsHeight } from '../height-holder';

import style from './style.module.css';

const WAIT_DELAY = 750; // 750ms

// This component is used to hide the loading indicator for a bit (just in case
// the next content is quick enough, because we don't want a flash with the
// indicator), then slowly display it.
// In the best of cases this component will *never* even have to be displayed
const Loading = ({ wait = WAIT_DELAY, size = 50 }) => {
  const [flag, toggleFlag] = useToggleState(false);
  // Tell the closest height holder, if any, that the content it had is missing while this lasts
  useHoldsHeight();
  // This is a hook
  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      toggleFlag();
    }, wait);
    return () => clearTimeout(timer);

    /*
    let mounted = true;
    sleep(wait) // wait for a bit
      // this might be useful if the page is not even visible
      .then(() => frame()) // Wait for the next animation frame
      // After waiting, check if mounted is still true
      .then(() => {
        // If mounted is false it means that the loading was over before the wait ended
        if (mounted) toggleFlag(); // This toggleFlag changes the flag from false to true
      });
    // In a useEffect or similar hooks, "return" stands for an ending function
    // The ending function is called when the components is no longer rendered
    return () => (mounted = false); // When useLayoutEffect is over or cancelled, set mounted to false
    */
  }, [toggleFlag, wait]); // useLayoutEffect is only called when the toggleFlag is called (only once)
  // Return an animated circle
  return (
    <div
      title="loading..." // This tag appears when the mouse remains over the circle
      className={cn(style.loading, { [style.show]: flag })}
    >
      {flag && (
        <CircularProgress
          variant="indeterminate"
          color="primary"
          size={size}
          thickness={5}
        /> // Renders the circle
      )}
    </div>
  );
};

export default Loading;
