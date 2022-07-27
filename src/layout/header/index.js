import React from 'react';

import { AppBar, Toolbar } from '@material-ui/core';
import { Link } from 'react-router-dom';

import Menu from '../../components/menu';
import LazyImg from '../../components/lazy-img';

import style from './style.module.css';

import logo from '../../images/logo.png';
import logoWebP from '../../images/logo.webp';

// Renders the logo and all the menu buttons next to it
const Header = () => (
  <AppBar position="sticky">
    <Toolbar className={style.toolbar}>
      <Link to="/" title="home" className={style['logo-link']}>
        <picture>
          <source type="image/webp" srcSet={logoWebP} />
          <LazyImg
            src={logo}
            width="180px"
            height="60px"
            loading="lazy"
            alt="Logo - Link to home page"
          />
        </picture>
      </Link>
      <Menu />
    </Toolbar>
  </AppBar>
);

export default Header;
