import React, { lazy, Suspense } from 'react';

import { Link, Routes, Route } from 'react-router-dom';
import Button from '@mui/material/Button';

import { BASE_PATH } from '../../utils/constants';

import style from './style.module.css';

const Search = lazy(() => import(/* webpackChunkName: 'search' */ './search'));

// Render all buttons in the superior header and manage the user redirection when they are clicked
export default () => (
  <menu className={style.menu}>
    <div className={style.main}>
      <Button
        component={Link}
        color="inherit"
        to="/"
        className={style['home-text-button']}
      >
        Home
      </Button>
      <Button component={Link} color="inherit" to="/browse">
        Browse
      </Button>
      <Button component={Link} color="inherit" to="/search">
        Search
      </Button>
      <Button component={Link} color="inherit" to="/help">
        Help
      </Button>
      <Button component={Link} color="inherit" to="/contact">
        Contact
      </Button>
      <Button component="a" color="inherit" href={`${BASE_PATH}docs/`}>
        REST API
      </Button>
      <Routes>
        <Route
          path="/browse"
          element={
            <Suspense fallback={null}>
              {/* Render the search bar */}
              <Search />
            </Suspense>
          }
        />
      </Routes>
    </div>
  </menu>
);
