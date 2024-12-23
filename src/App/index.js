import React, { lazy, Suspense, useState, useEffect, useLayoutEffect } from 'react';
//import ReactGA from 'react-ga4';
import { Routes, Route, Router } from 'react-router-dom';
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
// Constants
import { HOST_CONFIG } from '../utils/constants';

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
const primary = { main: HOST_CONFIG.primaryColor }; // Gets color from host config
const secondary = { main: HOST_CONFIG.secondaryColor };

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

// ---------------------------------------------------------------------------------------------------

// Hijack a bit the history to make a piece of logic run when the location changes right before the change
// https://stackoverflow.com/questions/70646421/how-to-listen-for-route-change-in-react-router-dom-v6

// This is not a technic but an artistic logic
// It makes the cards fall down before changing the page
// If this is giving you problems then just replace the CustomRouter by a BrowserRouter

// Set a custom history
// Note that using createBrowserHistory instead may give you some problems which are not visible locally
// Some dynamic paths may raise problems once the client is build in the server
const history = createHashHistory();

// Set a custom router
const CustomRouter = ({ history, ...props }) => {
  const [state, setState] = useState({
    action: history.action,
    location: history.location
  });

  useLayoutEffect(() => {
    // Note that we will not be able to access the current state value further if we don't want to rerener everything
    // Fort his reason the current state location is observed only at the begining and then updated inside the function
    let currentLocation = state.location.pathname;
    history.listen(async newState => {
      // If the location is about to change, run a few extra logic
      const newLocation = newState.location.pathname;
      if (currentLocation != newLocation) {
        currentLocation = newLocation;
        // Get all current sections
        const sections = Array.from(
          document.querySelectorAll('main section'),
        ).reverse();
        // Trigger animation out
        let animated = false;
        sections.forEach((section, index) => {
          if (!section.animate) return;
          animated = true;
          section.animate(KEYFRAMES, {
            fill: 'both',
            easing: 'cubic-bezier(.33,-0.65,.56,1.1)',
            duration: 500,
            delay: Math.min(250, index * 100),
          });
        });
        // If animations were triggered then wait a bit for it to happen
        if (animated) await sleep(500);
      }
      // Go to the new location
      return setState(newState);
    })
  }, [history]);

  return (
    <Router
      {...props}
      location={state.location}
      navigationType={state.action}
      navigator={history}
    />
  );
};

// ---------------------------------------------------------------------------------------------------

// Go to the Root script, where there is a switch/route section with all pages
const App = () => {
  // Setup google analytics
  // DANI: Thishas been disabled for now
  // DANI: The new version of GA4 is using cookies and this is no longer optional
  // useEffect(() => {
  //   ReactGA.initialize(googleAnalyticsId, {
  //     debug: false,
  //     gaOptions: {
  //       storage: 'none',
  //       storeGac: false,
  //     },
  //   });
  //   // Send pageview with a custom path
  //   //ReactGA.send({ hitType: "pageview", page: history.location.pathname, title: "Some page" });
  // }, []);
  // Update the favicon and sheet header name according to host configuration
  useEffect(() => {
    // Update the document title, which is the sheet header name
    document.title = HOST_CONFIG.name;
    // Get the icon link element
    let link = document.querySelector("link[rel~='icon']");
    // Create it if it does not exist yet
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    // Edit the href to mak it point to the corresponding host favicon
    link.href = `/${HOST_CONFIG.favicon}.ico`;
  }, []);
  return (
    <ErrorBoundary>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={theme}>
          <CustomRouter history={history}>
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
          </CustomRouter>
        </ThemeProvider>
      </StyledEngineProvider>
    </ErrorBoundary>
  );
};

export default App;
