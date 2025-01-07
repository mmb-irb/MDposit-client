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
import Browse from '../browse'; // Add this import

// CSS styles
import style from './style.module.css';

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
    <>
      <Card className={style.card}>
        <CardContent className={style['card-content']}>
          <Typography variant="h5">
            {HOST_CONFIG.description}
          </Typography>
          <Typography variant="h5">
            Search simulations by their title, authors or group names:
          </Typography>
        </CardContent>
      </Card>
      <Browse />
    </>
  );
};

export default Home;
