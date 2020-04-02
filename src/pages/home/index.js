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
        <strong>MoDEL_COVID-19</strong> is a platform designed to provide
        web-access to <strong>atomistic-MD trajectories</strong> for relevant{' '}
        <strong>proteins involved in mechanism of COVID-19 disease</strong>.
      </Typography>
      <Typography variant="h5">
        This is an exceptional branch of{' '}
        <a
          href="http://mmb.irbbarcelona.org/MoDEL-CNS/"
          target="_blank"
          rel="noopener noreferrer"
        >
          MoDEL_CNS
        </a>
        , which is focused on <strong>signal transduction proteins</strong>.
      </Typography>
      <Typography variant="h5">
        The project is part of the Service for providing molecular
        simulation-based predictions for systems neurobiology of the{' '}
        <strong>Human Brain Project</strong>.
      </Typography>
      <Typography variant="h5">
        <strong>MoDEL_CNS</strong> expands the <strong>Mo</strong>
        lecular <strong>D</strong>
        ynamics <strong>E</strong>
        xtended <strong>L</strong>
        ibrary (
        <a
          href="http://mmb.pcb.ub.es/MoDEL/"
          target="_blank"
          rel="noopener noreferrer"
        >
          MoDEL
        </a>
        ) database of atomistic Molecular Dynamics trajectories with proteins
        involved in <strong>Central Nervous System</strong> (CNS) processes,
        including membrane proteins.
      </Typography>
      <Typography variant="h5">
        <strong>MoDEL_CNS web server interface</strong> presents the resulting
        trajectories, analyses, and protein properties. All data produced by the
        project is available to download.
      </Typography>
      <Typography variant="h5" className={style['with-background']}>
        <strong>MoDEL_CNS</strong> will contribute in the improvement of the
        understanding of neuronal signalling cascades by protein structure-based
        simulations, calculating molecular flexibility and dynamics, and guiding
        systems level modelling.
      </Typography>
    </CardContent>
  </Card>
);

export default Home;
