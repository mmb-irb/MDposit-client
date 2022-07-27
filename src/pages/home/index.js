// React logic
import React from 'react';
import { useHistory } from 'react-router-dom';

// Visual assets
import {
  CardContent,
  Typography,
  TextField,
  InputAdornment,
} from '@material-ui/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';

// Additional components
import Card from '../../components/animated-card'; // The exceled parcels in which almost all features are based
import LazyImg from '../../components/lazy-img'; // Renders an image by a hook

// CSS styles
import style from './style.module.css';

// The EU logo in 2 different formats
import euLogo from '../../images/eu.png';
import euLogoWebP from '../../images/eu.webp';

// Define the searchbar props
const inputProps = {
  'aria-label': 'Search projects by text',
  startAdornment: (
    <InputAdornment position="start">
      <FontAwesomeIcon
        icon={faSearch}
        size="2x"
        className={style['searchbar-icon']}
      />
    </InputAdornment>
  ),
  classes: {
    input: style['searchbar-letters'],
  },
};

// Expose the project presentation
const Home = () => {
  // Get acces to the history so wen can redirect the user later
  const history = useHistory();
  // Render the home page
  return (
    <Card className={style.card}>
      <CardContent className={style['card-content']}>
        <Typography variant="h5">
          <strong>MDposit</strong> is an open platform designed to provide web
          access to atomistic molecular dynamics (MD) simulations. The aim of
          this initiative is to ease and promote data sharing along the
          wide-world scientific community in order to contribute in research.
        </Typography>
        <Typography variant="h5">
          Search simulations by their title, authors or group names:
        </Typography>
        <span className={style.searchbar}>
          {/* Search bar */}
          <TextField
            variant="outlined"
            className={style.searchbar}
            InputProps={inputProps}
            placeholder={'e.g. Orozco lab'}
            onKeyPress={event => {
              if (event.key === 'Enter') {
                //console.log(event.target.value);
                const query = event.target.value;
                history.push('/browse?search=' + query);
                //ev.preventDefault();
              }
            }}
          />
        </span>
        <div className={style.acknowledgements}>
          <div className={style['acknowledgements-text']}>
            <Typography variant="h5">
              <strong>Acknowledgements</strong>
            </Typography>
            <br />
            This open source software code was developed in part in BioExcel and
            the Human Brain Project, funded from the European Union's Horizon
            2020 Framework Programme for Research and Innovation under Specific
            Grant Agreements No. 675728, No. 823830, No. 720270, No. 785907 and
            No. 945539 (BioExcel, BioExcel-2, Human Brain Project SGA1, SGA2 and
            SGA3).
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
      </CardContent>
    </Card>
  );
};

export default Home;
