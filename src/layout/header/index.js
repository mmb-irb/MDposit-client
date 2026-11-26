import React from 'react';

import { AppBar, Toolbar } from '@mui/material';
import { Link } from 'react-router';
import { styled } from '@mui/material/styles';
import Menu from '../../components/header-menu';
import LazyImg from '../../components/lazy-img';

import style from './style.module.css';
import { HOST_CONFIG } from '../../utils/constants';

// Get logo images depending on host configuration
const logo = new URL(`../../images/${HOST_CONFIG.logo}.png`, import.meta.url).href;
const logoWebP = new URL(`../../images/${HOST_CONFIG.logo}.webp`, import.meta.url).href;
const logoLabel = HOST_CONFIG.logoLabel;

// Create styled AppBar with gradient
const GradientAppBar = styled(AppBar)(() => ({
  background: `linear-gradient(90deg, var(--header-main) 65%, var(--header-dark) 100%)`,
}));

// Renders the logo and all the menu buttons next to it
const Header = () => (
  <GradientAppBar position="sticky">
    <Toolbar className={style.toolbar} disableGutters>
      <div className={style.container}>
        <Link to="/" title="home" className={logoLabel ? style.logoffset : style.logo}>
          <picture>
            <source type="image/webp" srcSet={logoWebP} />
            <LazyImg src={logo} loading="lazy" />
            {logoLabel && <div className={style.label}>{logoLabel}</div>}
          </picture>
        </Link>
        <Menu />
      </div>
    </Toolbar>
  </GradientAppBar>
);

export default Header;
