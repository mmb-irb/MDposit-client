import React from 'react';
import { Paper, Toolbar } from '@material-ui/core';

import LazyImg from '../../components/lazy-img';

import style from './style.module.css';

import logoIRB from '../../images/logo-irb.png';
import logoIRBWebP from '../../images/logo-irb.webp';

import logoBSC from '../../images/logo-bsc.png';
import logoBioExcel from '../../images/logo-bioexcel.png';
import logoBSCWebP from '../../images/logo-bsc.webp';
import logoBioExcelWebP from '../../images/logo-bioexcel.webp';

// for (const img of [logoHBP, logoIRB]) {
//   const el = document.createElement('link');
//   el.rel = 'preload';
//   el.as = 'image';
//   el.href = img;
//   document.head.appendChild(el);
// }

// Show two images which are also links: Human Brain Project and IRB Barcelona
const Footer = React.memo(() => (
  <footer>
    <Paper>
      <Toolbar className={style.footer}>
        <a
          href="https://bioexcel.eu/"
          target="_blank"
          rel="noreferrer noopener"
        >
          <picture>
            <source type="image/webp" srcSet={logoBioExcelWebP} />
            <LazyImg
              height="100px"
              src={logoBioExcel}
              loading="lazy"
              alt="BioExcel website"
            />
          </picture>
        </a>
        <a href="https://www.bsc.es/" target="_blank" rel="noreferrer noopener">
          <picture>
            <source type="image/webp" srcSet={logoBSCWebP} />
            <LazyImg
              height="100px"
              src={logoBSC}
              loading="lazy"
              alt="Barcelona Supercomputing Center website"
            />
          </picture>
        </a>
        <a
          href="https://www.irbbarcelona.org/"
          target="_blank"
          rel="noreferrer noopener"
        >
          <picture>
            <source type="image/webp" srcSet={logoIRBWebP} />
            <LazyImg
              height="100px"
              src={logoIRB}
              loading="lazy"
              alt="IRB Barcelona website"
            />
          </picture>
        </a>
      </Toolbar>
    </Paper>
  </footer>
));

export default Footer;
