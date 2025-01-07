import React from 'react';
import { Paper, Toolbar, Typography } from '@mui/material';

import LazyImg from '../../components/lazy-img';

import style from './style.module.css';

import logoIRB from '../../images/logo-irb.png';
import logoIRBWebP from '../../images/logo-irb.webp';

import logoBSC from '../../images/logo-bsc.png';
import logoBioExcel from '../../images/logo-bioexcel.png';
import logoBSCWebP from '../../images/logo-bsc.webp';
import logoBioExcelWebP from '../../images/logo-bioexcel.webp';
import logoHBP from '../../images/logo-hbp.png';
import logoHBPWebP from '../../images/logo-hbp.webp';
import logoEbrains from '../../images/logo-ebrains.png';
import logoEbrainsWebP from '../../images/logo-ebrains.webp';
import logoMDDB from '../../images/logo-mddb.png';
import logoMDDBWebP from '../../images/logo-mddb.webp';
import euLogo from '../../images/eu-logo.png';
import euLogoWebP from '../../images/eu-logo.webp';

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
              height="70px"
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
              height="70px"
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
              height="70px"
              src={logoIRB}
              loading="lazy"
              alt="IRB Barcelona website"
            />
          </picture>
        </a>
        <a
          href="https://www.humanbrainproject.eu/"
          target="_blank"
          rel="noreferrer noopener"
        >
          <picture>
            <source type="image/webp" srcSet={logoHBPWebP} />
            <LazyImg
              height="70px"
              src={logoHBP}
              loading="lazy"
              alt="Human Brain Project website"
            />
          </picture>
        </a>
        <a href="https://ebrains.eu/" target="_blank" rel="noreferrer noopener">
          <picture>
            <source type="image/webp" srcSet={logoEbrainsWebP} />
            <LazyImg
              height="70px"
              src={logoEbrains}
              loading="lazy"
              alt="EBRAINS website"
            />
          </picture>
        </a>
        <a href="https://mddbr.eu/" target="_blank" rel="noreferrer noopener">
          <picture>
            <source type="image/webp" srcSet={logoMDDBWebP} />
            <LazyImg
              height="50px"
              src={logoMDDB}
              loading="lazy"
              alt="MDDB website"
            />
          </picture>
        </a>
      </Toolbar>
      <div className={style.acknowledgements}>
        <div className={style['acknowledgements-text']}>
          <Typography variant="h5">
            <strong>Acknowledgements</strong>
          </Typography>
          <br />
          This open source software code was developed in part in BioExcel,
          the Human Brain Project, and the Molecular Dynamics Data Bank funded from 
          the European Union's Horizon 2020 Framework Programme for Research and Innovation under Specific
          Grant Agreements No. 675728 (BioExcel), No. 823830 (BioExcel-2), No. 720270 (Human Brain Project SGA1), 
          No. 785907 (Human Brain Project SGA2) and No. 945539 (Human Brain Project SGA3) and by the Horizon Europe
          Programme under No. 101093290 (BioExcel-3) and No. 101094651 (Molecular Dynamics Data Bank).
        </div>
        <div className={style['acknowledgements-logo']}>
          <source type="image/webp" srcSet={euLogoWebP} />
          <LazyImg
            src={euLogo}
            loading="lazy"
            alt=""
            className={style.fill}
          />
        </div>
      </div>
    </Paper>
  </footer>
));

export default Footer;
