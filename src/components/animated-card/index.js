import React, { useLayoutEffect, useRef, forwardRef } from 'react';
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

  useLayoutEffect(() => {
    const node = containerRef.current && containerRef.current.firstElementChild;
    if (!(node && node.animate)) return;

    const index = Array.from(
      document.querySelectorAll('main section'),
    ).findIndex(section => node === section);

    const animation = node.animate(KEYFRAMES, {
      ...ANIMATION_OPTIONS,
      delay: index * 150,
    });

    return () => animation.cancel();
  }, []);

  const Component = overrideComponent ? 'section' : Card;

  return (
    <div ref={containerRef} className={style.container}>
      <Component component="section" {...props} ref={ref} />
    </div>
  );
});

export default AnimatedCard;
