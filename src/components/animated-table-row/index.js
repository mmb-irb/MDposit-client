import React, { useLayoutEffect, useRef } from 'react';
import { TableRow } from '@mui/material';
import reducedMotion from '../../utils/reduced-motion';

// An image opacity is iterated between 0 (invisible) and 1 (visible)
const KEYFRAMES = { opacity: [0, 1] };

// Same image vertical position is iterated between 0 and 50 pixels (It may have no effect)
// This is only set when user has not activated the reduced motion option from the navigator
if (!reducedMotion()) {
  KEYFRAMES.transform = ['translateX(2.5%)', 'translateX(0)'];
}

const ANIMATION_OPTIONS = {
  fill: 'both',
  easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  duration: 750,
};

// A TableRow which animates from right to left when it first appears
// The animation is staggered by "index" to create a cascade effect across rows
const AnimatedTableRow = ({ index, children, ...props }) => {
  // This type of hook is like a "useEffect" but it runs after the layout is calculated and before it is painted
  // useEffect here would re-render the whole page, thus creating "load hesitation" and a delay
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (!(ref.current && ref.current.animate)) return;
    const animation = ref.current.animate(KEYFRAMES, {
      ...ANIMATION_OPTIONS,
      // Set a delay which depends on the index to create a cascade effect
      delay: 100 + index * 75,
    });

    return () => animation.cancel();
  }, [index]);

  return (
    <TableRow ref={ref} {...props}>
      {children}
    </TableRow>
  );
};

export default AnimatedTableRow;
