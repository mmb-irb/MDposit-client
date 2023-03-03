// React logic
import React, { Suspense, lazy, useContext, useMemo, useState } from 'react';
import { Link, Switch, Route } from 'react-router-dom';

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
import { ProjectCtx, PdbCtx } from '../../contexts';

// Load the topology class
import { Topology } from '../../utils/topology-manager';

// Constants
import {
  BASE_PATH,
  BASE_PATH_PROJECTS,
  PATH_MAIN_TOPOLOGY,
  NICE_NAMES,
} from '../../utils/constants';

// CSS styles
import style from './style.module.css';

const ProjectMenu = lazy(() =>
  import(
    /* webpackChunkName: 'project-menu' */ '../../components/menu/project-menu'
  ),
);

const Overview = lazy(() =>
  import(/* webpackChunkName: 'overview' */ './overview'),
);
const Files = lazy(() => import(/* webpackChunkName: 'files' */ './files'));
const Trajectory = lazy(() =>
  import(/* webpackChunkName: 'trajectory' */ './trajectory'),
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

const Populations = lazy(() =>
  import(/* webpackChunkName: 'mutations' */ './populations'),
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
      end = 'references';
      break;
    case 'populations':
      end = `files/populations.json`;
      break;
    default:
      return null; // No button is rendered
  }
  return `${BASE_PATH}current/projects/${accession}/${end}`;
};

// Render the accession summary
const SummarySwitch = ({ subPage, dataUrl }) => {
  // Load the project context
  const project = useContext(ProjectCtx);
  const accession = project.accession || project.identifier;
  // Load the structure data from the API
  const pdbData = useNGLFile(
    `${BASE_PATH_PROJECTS}${accession}${PATH_MAIN_TOPOLOGY}`,
    // This attribute was included before: defaultRepresentation: false
    { defaultRepresentation: false, ext: 'pdb' },
  );
  // Wait for the pdbData to arrive
  if (pdbData.loading) return <Loading />;
  else if (pdbData.error) return pdbData.error.toString() + ' (in pdbData)';
  else if (!pdbData.file) return 'Something bad happened with the pdb data';

  // DANI: Esto no entiendo que sentido tiene
  // if (project.accession && accession !== project.accession) {
  //   // it means that the accession we extracted from the URL is not actually an
  //   // accession but an identifier (e.g. PDB accession), so, if it exists, redirect to it
  //   return (
  //     <Route
  //       render={({ location }) => (
  //         <Redirect
  //           to={{
  //             ...location,
  //             pathname: location.pathname.replace(
  //               accession,
  //               project.accession,
  //             ),
  //           }}
  //         />
  //       )}
  //     />
  //   );
  // }

  // Render the accession
  return (
    <ErrorBoundary>
      {' '}
      {/* Catch errors */}
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
            path="/browse/:accession/populations"
            exact
            render={props => (
              <Suspense fallback={<Loading />}>
                <Populations {...props} />
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
      </PdbCtx.Provider>
    </ErrorBoundary>
  );
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

export default ({ location, match }) => {
  // Set a state to store the current project data
  const [project, setProject] = useState(null);
  // Find the project accession according to the URL
  const accession = match.params.accession;
  // Set the current project data according to the requested accession
  let updatedProjectData = false;
  // Check the if the state project data matches the current accession
  // If so, set the state project data as the current project data
  if (
    project &&
    (project.accession === accession || project.identifier === accession)
  )
    updatedProjectData = true;
  // In case we are still missing the current project data, check if we have some project data in the location state
  // This may happen when we come from the browser: the selected project data is passed through the state
  // This way we do not have to query again for it
  // If the state project data matches the current accession then set it as the current project data
  if (!updatedProjectData) {
    const stateProjectData = location.state && location.state.projectData;
    if (
      stateProjectData &&
      (stateProjectData.accession === accession ||
        stateProjectData.identifier === accession)
    ) {
      // Save the current project data as the state project data and stop here
      const newProject = new Project(stateProjectData);
      setProject(newProject);
    }
  }
  // If current project data is still missing then query the API for it
  // Note that useAPI cannot be called conditionally since it is a hook
  // Thus setting the url as null is a workaround to not perform the query
  const projectURL = updatedProjectData
    ? null
    : `${BASE_PATH_PROJECTS}${accession}/`;
  const projectQuery = useAPI(projectURL);
  // Make some modifications to the project data once loaded
  useMemo(() => {
    if (!project) return;
    // If accession is missing then set the identifier as the accession
    if (!project.accession) project.accession = project.identifier;
    // Order chain indices by alphabetic number when we have new project data
    if (project.chains) project.chains.sort();
  }, [project]);
  // Now request the API for additional
  // Request to API the references data
  const references = useAPI(`${BASE_PATH_PROJECTS}${accession}/references`);
  // DANI: No toda esta información es necesaria desde el principio, hay que reconsiderar
  // Request topology data to the API
  const topology = useAPI(`${BASE_PATH_PROJECTS}${accession}/topology`);
  // Request interactions data to the API in case there are interactions in this project
  const projectInteractions = project && project.metadata.INTERACTIONS;
  const thereAreInteractions =
    projectInteractions && projectInteractions.length > 0;
  const interactionsURL = thereAreInteractions
    ? `${BASE_PATH_PROJECTS}${accession}/analyses/interactions`
    : null;
  const interactions = useAPI(interactionsURL);
  // If we are waiting for the API response...
  if (!updatedProjectData) {
    // If we are still waiting for the API then stop here
    // If there was any error or the payload is missing then warn the user and stop here
    if (projectQuery.loading) return <Loading />;
    else if (projectQuery.error) return projectQuery.error.toString();
    else if (!projectQuery.payload)
      return 'Something bad happened with the project data';
    // Save the current project data as the state project data
    const newProject = new Project(projectQuery.payload);
    setProject(newProject);
  }
  // Wait for API requests to send the response
  if (references.loading) return <Loading />;
  else if (references.error)
    return references.error.toString() + ' (in references)';
  else if (!references.payload)
    return 'Something bad happened with the references data';
  if (topology.loading) return <Loading />;
  else if (topology.error) return topology.error.toString() + ' (in topology)';
  else if (!topology.payload)
    return 'Something bad happened with the topology data';
  if (interactions.loading) return <Loading />;
  else if (interactions.error)
    return interactions.error.toString() + ' (in interactions)';
  else if (thereAreInteractions && !interactions.payload)
    return 'Something bad happened with the interactions data';
  if (!project) return; // Should not happen, but sometimes...
  // Setup the topology
  // This class contains several functions for topology data managment and it is widely use among the different pages
  const topologyManager = new Topology(topology.payload, project.metadata);
  // Instead of creating a new context for some of the downloaded data, we include it in the project context
  project.topology = topologyManager;
  project.interactions = interactions.payload;
  project.references = references.payload;
  // Get the actual page where the user is going according to the URL
  const page = match.params.subPage;
  // Set the footer line for the help tooltip
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
  // Find out if the user is requesting the raw data, and not the interface
  const fullpath = location.pathname;
  const isJson = fullpath.substr(fullpath.length - 5) === '/json';
  // Set the API URL to obtain the corresponding web page data
  const dataUrl = getDataURL(accession, page);
  // Return the accession routes
  return (
    // Set the project context, which is used by different scripts including this
    <ProjectCtx.Provider value={project}>
      <ProjectMenu accession={accession} subPage={page} />
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
      <SummarySwitch subPage={page} dataUrl={dataUrl} />
    </ProjectCtx.Provider>
  );
};

// Set the project class
class Project {
  constructor(projectPayload) {
    // Replicate all payload values in the project object
    // This includes values such as metadata, files index, accesion, etc.
    Object.entries(projectPayload).forEach(([key, value]) => {
      this[key] = value;
    });
    // Set some empty internal variables whose value is requested/calculated and stored on demand
    this.topology = null;
    this.interactions = null;
    this.references = null;
    this._populations = null;
    // Calculate a few internal things
    // Check if the populations file is found in the files index
    this.isPopulated = Boolean(
      this.files &&
        this.files.find(file => file.filename === 'populations.json'),
    );
  }
  // Populations getter (populated ensembles only)
  // Populations are requested only when this variable is read for the first time
  // Then populations are stored so there is no need to repeat the query again
  get populations() {
    // Set the populations file request URL
    let url = `${BASE_PATH_PROJECTS}${this.accession}/files/populations.json`;
    // Request populations only if it is available
    if (!this.isPopulated) url = null;
    // Request populations only if we do not have it already
    if (this._populations && this._populations.payload) url = null;
    // Do the API query but save the result only if the url is not null
    // Note that if url is null from the first render (i.e. there are no poluations at all) its value will be null
    const query = useAPI(url);
    if (url !== null) this._populations = query;
    return this._populations;
  }
}
