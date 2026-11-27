import React from 'react';
import LazyImg from '../lazy-img';
import useLogoBackdrop, { DARK_LOGO, LIGHT_LOGO } from 'src/hooks/use-logo-backdrop';
import style from './style.module.css';

// Class of the backdrop for each kind of logo. Each backdrop only shows in the mode where the logo would not be visible
const BACKDROP_CLASSES = {
  [DARK_LOGO]: style['light-backdrop'],
  [LIGHT_LOGO]: style['dark-backdrop'],
};

// Image of a collection logo. It gets a backdrop in the mode where the logo would not be visible otherwise
const LogoImg = ({ src, className = '', ...props }) => {
  const backdrop = BACKDROP_CLASSES[useLogoBackdrop(src)] ?? '';
  return <LazyImg src={src} className={`${className} ${backdrop}`.trim()} {...props} />;
};

export default LogoImg;
