import React from 'react';

import { Link } from 'react-router-dom';
import Button from '@mui/material/Button';

import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TimelineIcon from '@mui/icons-material/Timeline';
import HelpIcon from '@mui/icons-material/Help';
import MailIcon from '@mui/icons-material/Mail';

import { BASE_PATH } from '../../utils/constants';

import style from './style.module.css';

// Render all buttons in the superior header and manage the user redirection when they are clicked
export default () => (
  <menu className={style.menu}>
    <div className={style.main}>
      <Button
        component={Link}
        color="inherit"
        to="/"
        startIcon={<HomeIcon />}
        className={style.button}
      >
        Home
      </Button>
      <Button
        component={Link}
        color="inherit"
        to="/browse"
        startIcon={<SearchIcon />}
        className={style.button}
      >
        Browse
      </Button>
      <Button
        component="a"
        color="inherit"
        href={`${BASE_PATH}docs/`}
        target={"_blank"}
        startIcon={<ChevronRightIcon />}
        className={style.button}
      >
        REST API
      </Button>
      <Button
        component={Link}
        color="inherit"
        to="/meta"
        startIcon={<TimelineIcon />}
        className={style.button}
      >
        Meta-analysis
      </Button>
      <Button
        component={Link}
        color="inherit"
        to="/help"
        startIcon={<HelpIcon />}
        className={style.button}
      >
        Help
      </Button>
      <Button
        component={Link}
        color="inherit"
        to="/contact"
        startIcon={<MailIcon />}
        className={style.button}
      >
        Contact
      </Button>
    </div>
  </menu>
);
