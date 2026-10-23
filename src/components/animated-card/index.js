import React, { useLayoutEffect, useRef, forwardRef } from 'react';
import { useLocation } from 'react-router';
import { Card } from '@mui/material';

// The fade in half of the location change animation
import { fadeSectionIn } from '../../utils/page-transition';

import style from './style.module.css';

// Make the card appear and slide softly from down to up when the page is loaded
const AnimatedCard = forwardRef(({ overrideComponent, ...props }, ref) => {
  const containerRef = useRef(null);
  // The fade out keeps holding opacity 0 once it is done, so cards whose DOM node survives
  // the navigation would stay invisible: re-run the fade in on every location change
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const node = containerRef.current && containerRef.current.firstElementChild;
    if (!(node && node.animate)) return;

    // Drop any leftover fade out animation still filling this node
    if (node.getAnimations)
      node.getAnimations().forEach(animation => animation.cancel());

    const index = Array.from(
      document.querySelectorAll('main section'),
    ).findIndex(section => node === section);

    const animations = fadeSectionIn(node, index);

    return () => animations.forEach(animation => animation.cancel());
  }, [pathname]);

  const Component = overrideComponent ? 'section' : Card;

  return (
    <div ref={containerRef} className={style.container}>
      <Component component="section" {...props} ref={ref} />
    </div>
  );
});

export default AnimatedCard;
