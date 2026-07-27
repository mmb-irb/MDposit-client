import React, { useLayoutEffect, useRef, forwardRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Card } from '@mui/material';

import reducedMotion from '../../utils/reduced-motion';

import style from './style.module.css';

const KEYFRAMES = { opacity: [0, 1] };

if (!reducedMotion()) {
  KEYFRAMES.transform = ['translateY(50px)', 'translateY(0)'];
}

const ANIMATION_OPTIONS = {
  fill: 'both',
  easing: 'cubic-bezier(0, .99, .56, 1.1)',
  duration: 500,
};

// Make the card appear and slide softly from down to up when the page is loaded
const AnimatedCard = forwardRef(({ overrideComponent, ...props }, ref) => {
  const containerRef = useRef(null);
  // The router fades all the sections out before changing the location (see src/App)
  // That animation uses 'fill: both', so it keeps holding opacity 0 once it is done
  // Cards whose DOM node survives the navigation would stay invisible forever
  // For this reason the appearing animation is re-run on every location change
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

    const animation = node.animate(KEYFRAMES, {
      ...ANIMATION_OPTIONS,
      delay: index * 150,
    });

    return () => animation.cancel();
  }, [pathname]);

  const Component = overrideComponent ? 'section' : Card;

  return (
    <div ref={containerRef} className={style.container}>
      <Component component="section" {...props} ref={ref} />
    </div>
  );
});

export default AnimatedCard;
