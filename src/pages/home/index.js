// React logic
import React from 'react';
import { useNavigate } from 'react-router-dom';

// Visual assets
import {
  CardContent,
  Typography,
  TextField,
  InputAdornment,
} from '@mui/material';
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

// Constants
import { HOST_CONFIG } from '../../utils/constants';

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
  const history = useNavigate();
  // Render the home page
  return (
    <Card className={style.card}>
      <CardContent className={style['card-content']}>
        <Typography variant="h5">
          {HOST_CONFIG.description}
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
            placeholder={HOST_CONFIG.searchExample}
            onKeyPress={event => {
              if (event.key === 'Enter') {
                //console.log(event.target.value);
                const query = event.target.value;
                history('/browse?search=' + query);
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
      </CardContent>
    </Card>
  );
};

export default Home;
