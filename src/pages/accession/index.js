// React logic
import React, { Suspense, lazy, useContext, useMemo } from 'react';
import { Link, Switch, Route, Redirect } from 'react-router-dom';

// Visual assets
import { Typography, Button } from '@material-ui/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faBook } from '@fortawesome/free-solid-svg-icons';

// Hooks
import useAPI from '../../hooks/use-api'; // API acces
import useNGLFile from '../../hooks/use-ngl-file';

// Additional components
import ErrorBoundary from '../../components/error-boundary'; // Catch errors in React components
import Loading from '../../components/loading'; // Displays an animated "loading" circle
import Info from '../../components/info';

import { docs } from '../help/documentation';

// Load the 3 contexts
import { AccessionCtx, ProjectCtx, PdbCtx, ToporefsCtx } from '../../contexts';

// Constants
import {
  BASE_PATH,
  BASE_PATH_PROJECTS,
  PATH_MAIN_TOPOLOGY,
  NICE_NAMES,
} from '../../utils/constants';

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
const Rmsds = lazy(() => import(/* webpackChunkName: 'rmsds' */ './rmsds'));
const Rgyr = lazy(() => import(/* webpackChunkName: 'rgyr' */ './rgyr'));
const Fluctuation = lazy(() =>
  import(/* webpackChunkName: 'fluctuation' */ './fluctuation'),
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

const Hbonds = lazy(() => import(/* webpackChunkName: 'hbonds' */ './hbonds'));

const Energies = lazy(() =>
  import(/* webpackChunkName: 'energies' */ './energies'),
);

const Pockets = lazy(() =>
  import(/* webpackChunkName: 'pockets' */ './pockets'),
);

const Mutations = lazy(() =>
  import(/* webpackChunkName: 'mutations' */ './mutations'),
);

const Epitopes = lazy(() =>
  import(/* webpackChunkName: 'mutations' */ './epitopes'),
);

const Sasa = lazy(() => import(/* webpackChunkName: 'sasa' */ './sasa'));

const JsonViewer = lazy(() =>
  import(/* webpackChunkName: 'sasa' */ './json-viewer'),
);

const getDataURL = (accession, subPage) => {
  // First, few modifications muts be done over the client URL path to be compatible with the API
  let end;
  switch (subPage) {
    case 'overview':
    case 'trajectory':
      end = '';
      break;
    case 'rgyr':
    case 'rmsds':
    case 'rmsd-perres':
    case 'rmsd-pairwise':
    case 'pca':
    case 'fluctuation':
    case 'sasa':
    case 'dist-perres':
    case 'hbonds':
    case 'energies':
    case 'pockets':
      end = `analyses/${subPage}`;
      break;
    case 'files':
      end = subPage;
      break;
    case 'mutations':
    case 'epitopes':
      end = 'toporefs';
      break;
    default:
      return null; // No button is rendered
  }
  return `${BASE_PATH}current/projects/${accession}/${end}`;
};

// Return an error message and print the error in the console
const Error = ({ error }) => {
  console.error(error);
  // returning a fragment here to avoid having typescript complaining
  return <>Something wrong happened</>;
};

// Render the accession summary
const SummarySwitch = ({ setProject, subPage, dataUrl }) => {
  // Get the accession ID from the accession context
  const accession = useContext(AccessionCtx);
  // Load the project context and the function to update it
  const project = useContext(ProjectCtx);

  // Check if the project context is empty or not the right project
  const wrongProjectContext =
    project === null || (project && project.accession !== accession);

  // Get project data from the API if the current context data is wrong. 'payload' contains the main data.
  let { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/`,
    wrongProjectContext,
  );

  // Request to API the toporef data
  const toporefs = useAPI(`${BASE_PATH_PROJECTS}${accession}/toporefs`);

  // Order the chains inexes by alphabetic number
  useMemo(() => {
    if (payload && payload.chains) payload.chains.sort();
  }, [payload]);

  // Load the structure data form the API
  const pdbData = useNGLFile(
    `${BASE_PATH_PROJECTS}${accession}${PATH_MAIN_TOPOLOGY}`,
    // This attribute was included before: defaultRepresentation: false
    { defaultRepresentation: false, ext: 'pdb' },
  );

  if (pdbData.loading) return <Loading />;
  else if (pdbData.error) return pdbData.error.toString();
  else if (!pdbData.file) return 'Something bad happened with the topology';

  if (toporefs.loading) return <Loading />;
  else if (toporefs.error) return pdbData.error.toString();
  else if (!toporefs.payload)
    return 'Something bad happened with the toporefs data';

  // If loading is null it means the project is already in context
  if (loading === null) {
    loading = false;
    payload = project;
    error = null;
  }

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
    // Set the project context
    setProject(payload);
    // Render the accession
    return (
      <ErrorBoundary>
        {' '}
        {/* Catch errors */}
        <PdbCtx.Provider value={pdbData}>
          <ToporefsCtx.Provider value={toporefs.payload}>
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
                      //defaultPrecision={2 ** 6}
                      xLabel="Time (ns)"
                      xScaleFactor={0.001}
                      yLabel="DIST (nm)"
                    />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/rmsds"
                exact
                render={() => (
                  <Suspense fallback={<Loading />}>
                    <Rmsds />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/rgyr"
                exact
                render={() => (
                  <Suspense fallback={<Loading />}>
                    <Rgyr />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/fluctuation"
                exact
                component={() => (
                  <Suspense fallback={<Loading />}>
                    <Fluctuation />
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
              <Route
                path="/browse/:accession/energies"
                exact
                render={props => (
                  <Suspense fallback={<Loading />}>
                    <Energies {...props} />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/pockets"
                exact
                render={props => (
                  <Suspense fallback={<Loading />}>
                    <Pockets {...props} />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/sasa"
                exact
                render={props => (
                  <Suspense fallback={<Loading />}>
                    <Sasa {...props} />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/mutations"
                exact
                render={props => (
                  <Suspense fallback={<Loading />}>
                    <Mutations {...props} />
                  </Suspense>
                )}
              />
              <Route
                path="/browse/:accession/epitopes"
                exact
                render={props => (
                  <Suspense fallback={<Loading />}>
                    <Epitopes {...props} />
                  </Suspense>
                )}
              />
              <Route
                path={`/browse/:accession/${subPage}/json`}
                exact
                render={props => (
                  <Suspense fallback={<Loading />}>
                    <JsonViewer {...props} url={dataUrl} />
                  </Suspense>
                )}
              />
              <Route render={() => 'This route is not defined in the client'} />
            </Switch>
          </ToporefsCtx.Provider>
        </PdbCtx.Provider>
      </ErrorBoundary>
    );
  }

  return <Error error={error || 'something wrong happened'} />;
};

// Render a button which links to the API
const LinkSwitch = ({ accession, subPage }) => {
  const jsonURL = getDataURL(accession, subPage);
  if (!jsonURL) return null;
  return (
    <Button
      component={Link}
      target="_blank"
      to={`/browse/${accession}/${subPage}/json`}
      className={style['link-to-api']}
    >
      <FontAwesomeIcon icon={faBook} />
      &nbsp;&nbsp;data in this page
    </Button>
  );
};

export default ({ location, match, setProject }) => {
  const fullpath = location.pathname;
  const isJson = fullpath.substr(fullpath.length - 5) === '/json';
  const accession = match.params.accession;
  const page = match.params.subPage;
  const doc = docs.find(doc => doc.id === page); // doc may not exist
  const tooltip = doc && doc.page && (
    <>
      {doc.page}
      <br />
      <br />
      To learn more about this page and how data is obtained please{' '}
      <a
        href={`/help#/help#${doc.id}`}
        target="_blank"
        rel="noreferrer noopener"
      >
        {'click here'}
      </a>
      .
    </>
  );
  const dataUrl = getDataURL(accession, page);
  return (
    // Set the accession context, which is used by different scripts including this
    <AccessionCtx.Provider value={accession}>
      <span className={style.container}>
        {/* Render the accession */}
        <Typography variant="h6" className={style.title}>
          {accession} - {NICE_NAMES.get(page) || page}
          {isJson ? ' (raw data)' : ''}
          {!isJson && doc && doc.page && (
            <Info tooltip={tooltip} className={style.info} />
          )}
        </Typography>
        {/* Render a button which links to the API */}
        {isJson ? (
          <Button
            target="_blank"
            href={dataUrl}
            className={style['link-to-api']}
          >
            <FontAwesomeIcon icon={faLink} />
            &nbsp;REST API
          </Button>
        ) : (
          <LinkSwitch accession={accession} subPage={page} />
        )}
      </span>
      {/* Load the main data summary */}
      <SummarySwitch setProject={setProject} subPage={page} dataUrl={dataUrl} />
    </AccessionCtx.Provider>
  );
};
