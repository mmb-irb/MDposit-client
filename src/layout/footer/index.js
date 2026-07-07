import React from 'react';
import { Paper, Toolbar } from '@mui/material';

import LazyImg from '../../components/lazy-img';

import style from './style.module.css';

import logoMDDB from '../../images/logo-mddb.png';
import logoMDDBWebP from '../../images/logo-mddb.webp';

// Load the host configuration
import { HOST_CONFIG } from "../../utils/constants";

// Add the MDDB logo, which is mandatory
const logoConfigurations = [
  {
    image: logoMDDB,
    webp: logoMDDBWebP,
    url: 'https://mddbr.eu/',
  },
  ...HOST_CONFIG.footers,
];

// Show two images which are also links: Human Brain Project and IRB Barcelona
const Footer = React.memo(() => (
  <footer>
    <Paper elevation={0} square className={style.paper}>
      <Toolbar className={style.footer}>
        {logoConfigurations.map(logoConfig => (
          <a
            key={logoConfig.url}
            href={logoConfig.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            <picture>
              <source type="image/webp" srcSet={logoConfig.webp} />
              <LazyImg height="70px" src={logoConfig.image} loading="lazy" alt="Logo" />
            </picture>
          </a>
        ))}
      </Toolbar>
    </Paper>
  </footer>
));

export default Footer;
