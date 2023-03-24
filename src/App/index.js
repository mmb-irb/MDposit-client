import React, { lazy, Suspense, useEffect } from 'react';
import ReactGA from 'react-ga';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { createHashHistory } from 'history';
import { sleep } from 'timing-functions';
import {
  ThemeProvider,
  StyledEngineProvider,
  createTheme,
} from '@mui/material/styles';

// Wrapper component to improve handling of react component errors
import ErrorBoundary from '../components/error-boundary';

import Base from '../base';
// It is used to check if the user has the reduced motion setting active
import reducedMotion from '../utils/reduced-motion';

const Embed = lazy(() =>
  import(/* webpackChunkName: 'embed' */ '../pages/embed'),
);

// Assign a couple of usual node environmental variables from npm modules
// This is part of the fix to solve problems from updating webpack to v5
window.Buffer = window.Buffer || require('buffer').Buffer;
window.process = window.process || require('process');

// Get the Google Analytics id
const googleAnalyticsId = process.env.REACT_APP_GOOGLE_ANALYTICS_ID;

// These keyframes are used for an animate()
// An image opacity is iterated between 0 (invisible) and 1 (visible)
const KEYFRAMES = {
  opacity: [1, 0],
};

// Same image vertical position is iterated between 0 and 50 pixels
// This is only set when user has not activated the reduced motion option from the navigator
if (!reducedMotion()) {
  KEYFRAMES.transform = ['translateY(0)', 'translateY(50px)'];
}

// Set the header colors (standard model colors)
const primary = { main: '#5c6bc0' }; // Light indigo
const secondary = { main: '#fafafa' }; // Light grey

// Set custom styling theme
const theme = createTheme({
  typography: {
    useNextVariants: true,
  },
  overrides: {
    MuiTablePagination: {
      toolbar: {
        justifyContent: 'center',
      },
      spacer: {
        flex: 0,
      },
    },
  },
  palette: { primary, secondary },
  props: {
    MuiTableCell: {
      align: 'center',
    },
  },
});

// Hijack a bit the block/userConfirm logic in the history library
// DANI: No se bien que hace esto
// CRITICAL WARNING: Since we are using createHashHistory we must use also HashRouter inetad of BrowserRouter
// CRITICAL WARNING: Otherwise we will have problems with the chunk paths in some routes which is very hard to debug
const history = createHashHistory({
  // we don't really ask for the user confirmation...
  async getUserConfirmation(nextPathname, callback) {
    // if new path
    if (nextPathname !== history.location.pathname) {
      // get all current sections
      const sections = Array.from(
        document.querySelectorAll('main section'),
      ).reverse();
      sections.forEach((section, index) => {
        if (!section.animate) return;
        // and trigger animation out
        section.animate(KEYFRAMES, {
          fill: 'both',
          easing: 'cubic-bezier(.33,-0.65,.56,1.1)',
          duration: 500,
          delay: Math.min(250, index * 100),
        });
      });
      // if there were sections, wait a bit to let go away
      if (sections.length) await sleep(500);
    }
    callback(true);
  },
});

// Will call getUserConfirmation everytime location changes
history.block(nextLocation => nextLocation.pathname);

// Go to the Root script, where there is a switch/route section with all pages
const App = () => {
  useEffect(() => {
    ReactGA.initialize(googleAnalyticsId, {
      debug: false,
      gaOptions: {
        storage: 'none',
        storeGac: false,
      },
    });
    ReactGA.pageview(history.location.pathname);
  }, []);
  return (
    <ErrorBoundary>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={theme}>
          <HashRouter history={history}>
            <Routes>
              <Route
                path="/embed/:accession"
                element={
                  <Suspense fallback={null}>
                    <Embed />
                  </Suspense>
                }
              />
              <Route path="*" element={<Base />} />
            </Routes>
          </HashRouter>
        </ThemeProvider>
      </StyledEngineProvider>
    </ErrorBoundary>
  );
};

export default App;
