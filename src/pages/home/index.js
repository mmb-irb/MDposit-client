// React logic
import React from 'react';

// Visual assets
import { CardContent, Typography } from '@material-ui/core';

// Additional components
import Card from '../../components/animated-card'; // The exceled parcels in which almost all features are based
import LazyImg from '../../components/lazy-img'; // Renders an image by a hook

// CSS styles
import style from './style.module.css';

// Different formats and sizes from the same image. The most optimal is loaded
import homeImage from '../../images/home-image.png';
import homeImage300 from '../../images/home-image_300.png';
import homeImageWebP from '../../images/home-image.webp';
import homeImageWebP300 from '../../images/home-image_300.webp';

// The EU logo in 2 different formats
import euLogo from '../../images/eu.png';

// Expose the project presentation
const Home = () => (
  <Card className={style.card}>
    <CardContent className={style['card-content']}>
      <picture>
        <source
          type="image/webp"
          srcSet={homeImageWebP}
          media="(min-width: 679px)"
        />
        <source type="image/webp" srcSet={homeImageWebP300} />
        <source
          type="image/png"
          srcSet={homeImage}
          media="(min-width: 679px)"
        />
        <LazyImg src={homeImage300} loading="eager" alt="home page" />
      </picture>
      <Typography variant="h5">
        <strong>BioExcel-CV19</strong> is a platform designed to provide
        web-access to <strong>atomistic-MD trajectories</strong> for
        macromolecules involved in the COVID-19 disease.
      </Typography>
      <Typography variant="h5">
        The project is part of the open access initiatives promoted by the
        world-wide scientific community to share information about COVID-19
        research.
      </Typography>
      <Typography variant="h5">
        <strong>BioExcel-CV19 web server interface</strong> presents the
        resulting trajectories, with a set of quality control analyses and
        system information. All data produced by the project is available to
        download from an associated programmatic access API.
      </Typography>
      <Typography variant="h5" className={style['with-background']}>
        <strong>BioExcel-CV19</strong> will contribute in the critical and
        essential work towards finding a cure against COVID-19.
      </Typography>

      <div className={style.acknowledgements}>
        <div className={style['acknowledgements-text']}>
          <Typography variant="h5">
            <strong>Acknowledgements</strong>
          </Typography>
          <br />
          This open source software code was developed in part in BioExcel,
          funded from the European Union's Horizon 2020 Framework Programme for
          Research and Innovation under Specific Grant Agreements No. 675728 and
          No. 823830 (BioExcel and BioExcel-2).
          <br />
          <br />
          This open source software code was developed in part in the Human
          Brain Project, funded from the European Union's Horizon 2020 Framework
          Programme for Research and Innovation under Specific Grant Agreements
          No. 720270, No. 785907 and No. 945539 (Human Brain Project SGA1, SGA2
          and SGA3).
        </div>
        <div className={style['acknowledgements-logo']}>
          <LazyImg src={euLogo} loading="lazy" alt="" className={style.fill} />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default Home;
