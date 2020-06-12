// React logic
import React, { Suspense, lazy, useContext } from 'react';
import { Switch, Route, Redirect } from 'react-router-dom';

// Visual assets
import { Typography, Button } from '@material-ui/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink } from '@fortawesome/free-solid-svg-icons';

// Hooks
import useAPI from '../../hooks/use-api'; // API acces
import useNGLFile from '../../hooks/use-ngl-file';

// Additional components
import ErrorBoundary from '../../components/error-boundary'; // Catch errors in React components
import Loading from '../../components/loading'; // Displays an animated "loading" circle

// Load the 3 contexts
import { AccessionCtx, ProjectCtx, PdbCtx } from '../../contexts';

// Constants
import { BASE_PATH, BASE_PATH_PROJECTS } from '../../utils/constants';

// CSS styles
import style from './style.module.css';

const Overview = lazy(() =>
  import(/* webpackChunkName: 'overview' */ './overview'),
);
const Files = lazy(() => import(/* webpackChunkName: 'files' */ './files'));
const Trajectory = lazy(() =>
  import(/* webpackChunkName: 'trajectory' */ './trajectory'),
);
const GenericAnalysisPage = lazy(() =>
  import(
    /* webpackChunkName: 'generic-analysis-page' */ './generic-analysis-page'
  ),
);
const PCA = lazy(() => import(/* webpackChunkName: 'pca' */ './pca'));
const RmsdPerres = lazy(() =>
  import(/* webpackChunkName: 'trajectory' */ './rmsd-perres'),
);

const Electrostatic = lazy(() =>
  import(/* webpackChunkName: 'trajectory' */ './electrostatic'),
);

const DistPerres = lazy(() =>
  import(/* webpackChunkName: 'dist-perres' */ './dist-perres'),
);

const RmsdPairwise = lazy(() =>
  import(/* webpackChunkName: 'rmsd-pairwise' */ './rmsd-pairwise'),
);

const Hbonds = lazy(() =>
  import(/* webpackChunkName: 'rmsd-pairwise' */ './hbonds'),
);

// Return an error message and print the error in the console
const Error = ({ error }) => {
  console.error(error);
  // returning a fragment here to avoid having typescript complaining
  return <>Something wrong happened</>;
};

// Render the accession summary
const SummarySwitch = () => {
  // useContext is a React hook. Get the accession ID from the accession context
  const accession = useContext(AccessionCtx);

  // Get data from the API. 'payload' contains the main data.
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/`,
  );

  // Load the structure data form the API
  const pdbData = useNGLFile(
    `${BASE_PATH_PROJECTS}${accession}/files/md.imaged.rot.dry.pdb`,
    // This attribute was included before: defaultRepresentation: false
    { defaultRepresentation: false, ext: 'pdb' },
  );

  // While loading
  if (loading) {
    return <Loading />;
  }

  if (payload && payload.accession && accession !== payload.accession) {
    // it means that the accession we extracted from the URL is not actually an
    // accession but an identifier (e.g. PDB accession), so, if it exists, redirect to it
    return (
      <Route
        render={({ location }) => (
          <Redirect
            to={{
              ...location,
              pathname: location.pathname.replace(accession, payload.accession),
            }}
          />
        )}
      />
    );
  }
  // Otherwise, if we still having data, redirect the user according to the URL path
  if (payload) {
    return (
      <ErrorBoundary>
        {' '}
        {/* Catch errors */}
        <ProjectCtx.Provider value={payload}>
          <PdbCtx.Provider value={pdbData}>
            <Switch>
              <Route
                path="/browse/:accession/overview"
                exact
                render={() => (
                  <Suspense fallback={<Loading />}>
                    <Overview />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/files"
                exact
                render={() => (
                  <Suspense fallback={<Loading />}>
                    <Files />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/trajectory"
                exact
                render={props => (
                  <Suspense fallback={<Loading />}>
                    <Trajectory {...props} />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/pca"
                exact
                render={() => (
                  <Suspense fallback={<Loading />}>
                    <PCA />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/dist"
                exact
                render={() => (
                  <Suspense fallback={<Loading />}>
                    <GenericAnalysisPage
                      analysis="dist"
                      defaultPrecision={2 ** 6}
                      xLabel="Time (ns)"
                      xScaleFactor={0.001}
                      yLabel="DIST (nm)"
                    />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/rmsd"
                exact
                render={() => (
                  <Suspense fallback={<Loading />}>
                    <GenericAnalysisPage
                      analysis="rmsd"
                      defaultPrecision={2 ** 6}
                      xLabel="Time (ns)"
                      xScaleFactor={0.001}
                      yLabel="RMSd (nm)"
                    />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/rgyr"
                exact
                render={() => (
                  <Suspense fallback={<Loading />}>
                    <GenericAnalysisPage
                      analysis="rgyr"
                      defaultPrecision={2 ** 6}
                      xLabel="Time (ns)"
                      xScaleFactor={0.001}
                      yLabel="Rgyr (nm)"
                    />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/fluctuation"
                exact
                component={() => (
                  <Suspense fallback={<Loading />}>
                    <GenericAnalysisPage
                      analysis="fluctuation"
                      xLabel="Atom"
                      xUnit="atom"
                      yLabel="Fluctuation (nm)"
                      startsAtOne
                      graphType="dash"
                    />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/rmsd-perres"
                exact
                render={props => (
                  <Suspense fallback={<Loading />}>
                    <RmsdPerres {...props} />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/electrostatic"
                exact
                render={props => (
                  <Suspense fallback={<Loading />}>
                    <Electrostatic {...props} />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/dist-perres"
                exact
                render={props => (
                  <Suspense fallback={<Loading />}>
                    <DistPerres {...props} />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/rmsd-pairwise"
                exact
                render={props => (
                  <Suspense fallback={<Loading />}>
                    <RmsdPairwise {...props} />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/hbonds"
                exact
                render={props => (
                  <Suspense fallback={<Loading />}>
                    <Hbonds {...props} />
                  </Suspense>
                )}
              />
              <Route render={() => 'This route is not defined in the client'} />
            </Switch>
          </PdbCtx.Provider>
        </ProjectCtx.Provider>
      </ErrorBoundary>
    );
  }

  return <Error error={error || 'something wrong happened'} />;
};

// Render a button which links to the API
const LinkSwitch = ({ accession, subPage }) => {
  // First, few modifications muts be done over the client URL path to be compatible with the API
  let end;
  switch (subPage) {
    case 'overview':
    case 'trajectory':
      end = '';
      break;
    case 'rgyr':
    case 'rmsd':
    case 'pca':
    case 'fluctuation':
      end = `analyses/${subPage}`;
      break;
    case 'files':
      end = subPage;
      break;
    default:
      end = '';
  }
  return (
    <Button
      component="a"
      target="_blank"
      href={`${BASE_PATH}current/projects/${accession}/${end}`}
      className={style['link-to-api']}
    >
      <FontAwesomeIcon icon={faLink} />
      &nbsp;data in this page
    </Button>
  );
};

export default ({ match }) => {
  return (
    // Set the accession context, which is used by different scripts including this
    <AccessionCtx.Provider value={match.params.accession}>
      <span className={style.container}>
        {/* Render the accession */}
        <Typography variant="h4" className={style.title}>
          Accession: {match.params.accession}
        </Typography>
        {/* Render a button which links to the API */}
        <LinkSwitch
          accession={match.params.accession}
          subPage={match.params.subPage}
        />
      </span>
      {/* Load the main data summary */}
      <SummarySwitch />
    </AccessionCtx.Provider>
  );
};
