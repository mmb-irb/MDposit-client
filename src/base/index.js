import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useParams, generatePath } from 'react-router-dom';
import { schedule } from 'timing-functions';

// Layout
import Body from '../layout/body';
import Main from '../layout/main';
import Header from '../layout/header';
//import HomeFAB from '../components/home-fab';

import ErrorBoundary from '../components/error-boundary';

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
const MetaAnalysis = lazy(() =>
import(/* webpackChunkName: 'meta-analysis' */ '../pages/meta-analysis'),
);
const Help = lazy(() => import(/* webpackChunkName: 'help' */ '../pages/help'));
const Contact = lazy(() =>
  import(/* webpackChunkName: 'contact' */ '../pages/contact'),
);
const Accession = lazy(() =>
  import(/* webpackChunkName: 'accession' */ '../pages/accession'),
);

// Set a custom Navigate which is smart enought to replace params in the 'to' path
const SmartNavigate = props => {
  const params = useParams();
  // Can not overwrite props.to since it is read-only
  const newTo = generatePath(props.to, params);
  return <Navigate {...props} to={newTo} />;
};

const Base = () => {
  return (
    <Body>
      <Header />
      <Main>
        <ErrorBoundary>
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
              path="browse"
              element={
                <Suspense fallback={null}>
                  <Browse />
                </Suspense>
              }
            />
            <Route
              path="search"
              element={
                <Suspense fallback={null}>
                  <CustomSearch />
                </Suspense>
              }
            />
            <Route
              path="advanced-search"
              element={
                <Suspense fallback={null}>
                  <AdvancedSearch />
                </Suspense>
              }
            />
            <Route
              path="meta"
              element={
                <Suspense fallback={null}>
                  <MetaAnalysis />
                </Suspense>
              }
            />
            <Route
              path="help"
              element={
                <Suspense fallback={null}>
                  <Help />
                </Suspense>
              }
            />
            <Route
              path="contact"
              element={
                <Suspense fallback={null}>
                  <Contact />
                </Suspense>
              }
            />
            <Route path="id" >
              <Route index element={<Navigate to="/browse" replace />}/>
              <Route path=":accession">
                <Route index element={<SmartNavigate to="/id/:accession/overview" replace />}/>
                <Route
                  path=":page/*"
                  element={
                    <Suspense fallback={null}>
                      <Accession />
                    </Suspense>
                  }
                />
              </Route>
            </Route>
            <Route
              path="*"
              element={'This route is not defined in the client root'}
            />
            {/* These redirections are to keep old URLs compatible */}
            <Route
              path="/browse/:accession"
              element={<SmartNavigate to="/id/:accession" replace />}
            />
            <Route
              path="/browse/:accession/:page"
              element={<SmartNavigate to="/id/:accession/:page" replace />}
            />
            {/*<Route path={['/:page', '/']} component={HomeFAB} />*/}
          </Routes>
        </ErrorBoundary>
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

export default Base;
