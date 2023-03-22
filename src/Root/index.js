import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { schedule } from 'timing-functions';
import {
  ThemeProvider,
  StyledEngineProvider,
  createTheme,
} from '@mui/material/styles';

// Layout
import Body from '../layout/body';
import Main from '../layout/main';
import Header from '../layout/header';
//import HomeFAB from '../components/home-fab';

// Set the header colors (standard model colors)
const primary = { main: '#5c6bc0' }; // Light indigo
const secondary = { main: '#fafafa' }; // Light grey

const Footer = lazy(async () => {
  await schedule(100);
  const module = await import(
    /* webpackChunkName: 'footer' */ '../layout/footer'
  );
  await schedule(500);
  return module;
});

const SnackBarContainer = lazy(async () => {
  await schedule(100);
  const module = await import(
    /* webpackChunkName: 'snack-bar-container' */ '../components/snack-bar-container'
  );
  return module;
});

// Pages
const Home = lazy(() => import(/* webpackChunkName: 'home' */ '../pages/home'));
const Browse = lazy(() =>
  import(/* webpackChunkName: 'browse' */ '../pages/browse'),
);
const AdvancedSearch = lazy(() =>
  import(/* webpackChunkName: 'advanced-search' */ '../pages/advanced-search'),
);
const CustomSearch = lazy(() =>
  import(/* webpackChunkName: 'custom-search' */ '../pages/custom-search'),
);
const Help = lazy(() => import(/* webpackChunkName: 'help' */ '../pages/help'));
const Accession = lazy(() =>
  import(/* webpackChunkName: 'accession' */ '../pages/accession'),
);
const Contact = lazy(() =>
  import(/* webpackChunkName: 'contact' */ '../pages/contact'),
);
const Embed = lazy(() =>
  import(/* webpackChunkName: 'contact' */ '../pages/embed'),
);

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

const Base = () => {
  return (
    <Body>
      <Header />
      <Main>
        <Routes>
          <Route
            path="/"
            element={
              <Suspense fallback={null}>
                <Home />
              </Suspense>
            }
          />
          <Route
            path="/contact"
            element={
              <Suspense fallback={null}>
                <Contact />
              </Suspense>
            }
          />
          <Route
            path="/browse"
            element={
              <Suspense fallback={null}>
                <Browse />
              </Suspense>
            }
          />
          <Route
            path="/search"
            element={
              <Suspense fallback={null}>
                <CustomSearch />
              </Suspense>
            }
          />
          <Route
            path="/advanced-search"
            element={
              <Suspense fallback={null}>
                <AdvancedSearch />
              </Suspense>
            }
          />
          <Route
            path="/help"
            element={
              <Suspense fallback={null}>
                <Help />
              </Suspense>
            }
          />
          <Route
            path="/browse/:accession/:subPage/*"
            element={
              <Suspense fallback={null}>
                <Accession />
              </Suspense>
            }
          />
          <Route
            path="*"
            element={'This route is not defined in the client root'}
          />
          {/*<Route path={['/:page', '/']} component={HomeFAB} />*/}
        </Routes>
        {/* <Navigate
          from="/browse/:accession"
          to="/browse/:accession/overview"
            /> */}
      </Main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
      <Suspense fallback={null}>
        <SnackBarContainer />
      </Suspense>
    </Body>
  );
};

const Root = () => {
  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
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
      </ThemeProvider>
    </StyledEngineProvider>
  );
};

export default Root;
