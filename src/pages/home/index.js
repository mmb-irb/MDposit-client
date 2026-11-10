// React logic
import React from 'react';
import { useNavigate } from 'react-router';

// Visual assets
import {
  CardContent,
  Typography,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Public as PublicIcon } from '@mui/icons-material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';

// Additional components
import Card from '../../components/animated-card'; // The exceled parcels in which almost all features are based
import LazyImg from '../../components/lazy-img'; // Renders an image by a hook
import TextLink from '../../components/text-link'; // Renders a text which is also a link

// CSS styles
import style from './style.module.css';

// The EU logo in 2 different formats
import euLogo from '../../images/eu.png';
import euLogoWebP from '../../images/eu.webp';

// Constants
import { HOST_CONFIG, MDPOSIT_URL } from '../../utils/constants';

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
        {!HOST_CONFIG.global && <div className={style.global}>
          <PublicIcon fontSize='large'/>
          <div>
            This is one of the many federated nodes contributing to MDposit.
            In order to navigate data through all federated nodes at the same time please use the
            {' '}<TextLink name={'global node'} url={MDPOSIT_URL} />.
          </div>
        </div>}
        <Typography variant="h5">
          {HOST_CONFIG.description}
        </Typography>
        <Typography variant="subtitle1" className={style['search-label']}>
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
        {/* Node specific acknowledgements, set in the host config */}
        {HOST_CONFIG.acknowledgements}
      </CardContent>
    </Card>
  );
};

export default Home;
