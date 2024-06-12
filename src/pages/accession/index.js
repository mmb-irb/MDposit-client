// React logic
import React, { lazy, Suspense, useContext, useMemo, useState } from 'react';
import { Link, Routes, Route, useLocation, useParams, useNavigate } from 'react-router-dom';

// Visual assets
import { Typography, Button, Select, MenuItem } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faBook } from '@fortawesome/free-solid-svg-icons';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

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

// Load the project class
import { Project } from '../../utils/project-manager';

// Constants
import {
  BASE_PATH,
  BASE_PATH_PROJECTS,
  MAIN_STRUCTURE_FILENAME,
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
  import(/* webpackChunkName: 'rmsd-perres' */ './rmsd-perres'),
);

const Electrostatic = lazy(() =>
  import(/* webpackChunkName: 'electrostatic' */ './electrostatic'),
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
  import(/* webpackChunkName: 'epitopes' */ './epitopes'),
);

const Sasa = lazy(() => import(/* webpackChunkName: 'sasa' */ './sasa'));

const JsonViewer = lazy(() =>
  import(/* webpackChunkName: 'json' */ './json-viewer'),
);

const Populations = lazy(() =>
  import(/* webpackChunkName: 'mutations' */ './populations'),
);

const MarkovGraph = lazy(() =>
  import(/* webpackChunkName: 'markov' */ './markov'),
);

// Put subpage name and page component together
const pageComponents = {
  overview: Overview,
  trajectory: Trajectory,
  electrostatic: Electrostatic,
  rgyr: Rgyr,
  rmsds: Rmsds,
  'rmsd-perres': RmsdPerres,
  'rmsd-pairwise': RmsdPairwise,
  pca: PCA,
  fluctuation: Fluctuation,
  sasa: Sasa,
  'dist-perres': DistPerres,
  hbonds: Hbonds,
  energies: Energies,
  pockets: Pockets,
  mutations: Mutations,
  epitopes: Epitopes,
  populations: Populations,
  markov: MarkovGraph,
  files: Files,
};

const getDataURL = (accessionAndMdNumber, subPage) => {
  // First, few modifications muts be done over the client URL path to be compatible with the API
  let end;
  switch (subPage) {
    case 'overview':
    case 'trajectory':
      end = '';
      break;
    case 'electrostatic':
      end = 'analyses/interactions';
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
    case 'markov':
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
  return `${BASE_PATH}current/projects/${accessionAndMdNumber}/${end}`;
};

// Render the accession summary
const SummarySwitch = ({ subPage, dataUrl }) => {
  // Load the project context
  const project = useContext(ProjectCtx);
  // Find the first valid structure filename found in the project
  // Load the structure data from the API
  const pdbData = useNGLFile(
    `${BASE_PATH_PROJECTS}/${project.accessionAndMdNumber}/files/${MAIN_STRUCTURE_FILENAME}`,
    // This attribute was included before: defaultRepresentation: false
    { defaultRepresentation: false, ext: 'pdb' },
  );
  // Wait for the pdbData to arrive
  if (pdbData.loading) return <Loading />;
  else if (pdbData.error) return pdbData.error.toString() + ' (in pdbData)';
  else if (!pdbData.file) return 'Something bad happened with the pdb data';

  // Get the component to be rendered according to the subpage name
  const Component = pageComponents[subPage];

  // Render the accession
  return (
    <ErrorBoundary>
      {' '}
      <PdbCtx.Provider value={pdbData}>
        <Routes>
          <Route
            path={`/`}
            element={Component ?
              <Suspense fallback={<Loading />}>
                <Component />
              </Suspense>
              : <>{`Subpage "${subPage}" not known`}</>
            }
          />
          <Route
            path={`/json`}
            element={
              <Suspense fallback={<Loading />}>
                <JsonViewer url={dataUrl} />
              </Suspense>
            }
          />
          <Route
            path="*"
            element={'This route is not defined in the client accession'}
          />
        </Routes>
      </PdbCtx.Provider>
    </ErrorBoundary>
  );
};

// Render a button which links to the API
const LinkSwitch = ({ accessionAndMdNumber, subPage }) => {
  const jsonURL = getDataURL(accessionAndMdNumber, subPage);
  if (!jsonURL) return null;
  return (
    <Button
      component={Link}
      target="_blank"
      to={`/id/${accessionAndMdNumber}/${subPage}/json`}
      className={style['link-to-api']}
    >
      <FontAwesomeIcon icon={faBook} />
      &nbsp;&nbsp;data in this page
    </Button>
  );
};

// Set a function to see if project data matches the one requested
const checkProjectDataUpdated = (projectData, requestedAccession, requestedMdNumber) => {
  // Check accesions match
  if (!projectData) return false;
  if (projectData.accession !== requestedAccession && projectData.identifier !== requestedAccession) return false;
  // If the project has not mds at all the we are good
  if (!projectData.mdNumber) return true;
  // Otherwise we must check MD numbers match
  const requiredMdNumber = requestedMdNumber !== null ? requestedMdNumber : projectData.mdref + 1;
  if (projectData.mdNumber !== requiredMdNumber) return false;
  return true;
};

export default () => {
  // Get the location and the history
  const location = useLocation();
  const history = useNavigate();
  // Get the project accession according to the URL
  // Get the actual page where the user is going according to the URL
  const { accession: accessionAndMdNumber, page } = useParams();
  const accessionSplits = accessionAndMdNumber.split('.');
  const accession = accessionSplits[0];
  const mdNumber = accessionSplits.length > 1 ? +accessionSplits[1] : null;
  // Set a state to store the current project data
  const [project, setProject] = useState(null);
  // Set the current project data according to the requested accession
  let updatedProjectData = false;
  // Check the if the state project data matches the current accession
  // If so, set the state project data as the current project data
  updatedProjectData = checkProjectDataUpdated(project, accession, mdNumber);
  // In case we are still missing the current project data, check if we have some project data in the location state
  // This may happen when we come from the browser: the selected project data is passed through the state
  // This way we do not have to query again for it
  // If the state project data matches the current accession then set it as the current project data
  if (!updatedProjectData) {
    const stateProjectData = location.state && location.state.projectData;
    if (checkProjectDataUpdated(stateProjectData, accession, mdNumber)) {
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
    : `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/`;
  const projectQuery = useAPI(projectURL);
  // Make some modifications to the project data once loaded
  useMemo(() => {
    if (!project) return;
    // If accession is missing then set the identifier as the accession
    if (!project.accession) project.accession = project.identifier;
    // Order chain indices by alphabetic number when we have new project data
    if (project.chains) project.chains.sort();
  }, [project]);
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
  // Should not happen, but sometimes...
  if (!project) return;
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
  const dataUrl = getDataURL(accessionAndMdNumber, page);
  // Check if there are multiple MDs
  const multipleMDs = project.mds.length > 1;
  // Return the accession routes
  return (
    // Set the project context, which is used by different scripts including this
    <ProjectCtx.Provider value={project}>
      <ProjectMenu accessionAndMdNumber={accessionAndMdNumber} subPage={page} />
      <span className={style.container}>
        {/* Render the accession */}
        <Typography variant="h6" className={style.title}>
          {`Project ${accession}`}
          <ChevronRightIcon color="primary" fontSize='large'/>
          {/* MD selector */}
          {multipleMDs &&
            <Select
              variant="standard"
              value={project.mdIndex}
              onChange={event => {
                const newMdNumber = event.target.value + 1;
                history(`/id/${accession}.${newMdNumber}/${page}`);
              }}
              className={style.selector}
            >
              {project.mds.map((md, i) => (
                <MenuItem key={i} value={i}>
                  {md}
                </MenuItem>
              ))}
            </Select>
          }
          {multipleMDs && <ChevronRightIcon color="primary" fontSize='large'/>}
          {`${NICE_NAMES.get(page) || page} page ${isJson ? ' (raw data)' : ''}`}
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
          <LinkSwitch accessionAndMdNumber={accessionAndMdNumber} subPage={page} />
        )}
      </span>
      {/* Load the main data summary */}
      <SummarySwitch subPage={page} dataUrl={dataUrl} />
    </ProjectCtx.Provider>
  );
};