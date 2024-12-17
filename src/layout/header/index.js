import React from 'react';

import { AppBar, Toolbar } from '@mui/material';
import { Link } from 'react-router-dom';

import Menu from '../../components/menu';
import LazyImg from '../../components/lazy-img';

import style from './style.module.css';

import { HOST_CONFIG } from '../../utils/constants';

// Get logo images depending on host configuration
const logo = require(`../../images/${HOST_CONFIG.logo}.png`);
const logoWebP = require(`../../images/${HOST_CONFIG.logo}.webp`);
const logoLabel = HOST_CONFIG.logoLabel;

// Renders the logo and all the menu buttons next to it
const Header = () => (
  <AppBar position="sticky">
    <Toolbar className={style.toolbar}>
      <Link to="/" title="home" className={logoLabel ? style.logoffset : style.logo}>
        <picture>
          <source type="image/webp" srcSet={logoWebP} />
          <LazyImg
            src={logo}
            loading="lazy"
          />
          {logoLabel && <div className={style.label}>{logoLabel}</div>}
        </picture>        
      </Link>
      <Menu />
    </Toolbar>
  </AppBar>
);

export default Header;
