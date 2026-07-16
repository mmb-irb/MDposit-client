// React logic
import React, { lazy, Suspense, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Routes, Route, useLocation, useParams, useNavigate } from 'react-router-dom';

// Visual assets
import { Typography, Button, Select, MenuItem } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faGhost, faExclamationCircle, faTrash } from '@fortawesome/free-solid-svg-icons';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

// Hooks
import useAPI from '../../hooks/use-api'; // API acces

// Additional components
import ErrorBoundary from '../../components/error-boundary'; // Catch errors in React components
import Loading from '../../components/loading'; // Displays an animated "loading" circle
import Info from '../../components/info';
import LazyImg from 'src/components/lazy-img';

import { docs } from '../help/documentation';

// Load the 3 contexts
import { ProjectCtx } from '../../contexts';

// Load the project class
import { Project } from '../../utils/project-manager';

// Constants
import {
  BASE_PATH,
  BASE_PATH_PROJECTS,
  NICE_NAMES,
  HOST_CONFIG
} from '../../utils/constants';

// Styling
import style from './style.module.css';
import { useTheme } from '@mui/material/styles';

// The menu used to change the subpage inside the project
import ProjectMenu from '../../components/project-menu';
// Component used to visualize API data related to the current subpage
import DataViewer from './data-viewer';

// The AccessionHeader component
const AccessionHeader = ({ page, primaryDarkColor }) => {
  // Load the context project data
  const {
    accession, accessionAndMdNumber,
    mdCount, mdIndex, mds,
    metadata, collectionReferences,
  } = useContext(ProjectCtx);
  // Get the location and the history
  const history = useNavigate();
  const location = useLocation();
  // Find out if the user is requesting the raw data, and not the interface
  const fullpath = location.pathname;
  const isData = fullpath.substr(fullpath.length - 5) === '/data';
  // Set the footer line for the help tooltip
  const doc = docs.find(doc => doc.id === page); // doc may not exist
  const tooltip = doc && doc.page && (
    <>
      {doc.page}
      <br />
      <br />
      To learn more about this page and how data is obtained please{' '}
      <a
        href={`/#/help#${doc.id}`}
        target="_blank"
        rel="noreferrer noopener"
      >
        {'click here'}
      </a>
      .
    </>
  );

  // Check if there are multiple MDs
  const multipleMDs = mdCount > 1;

  // Set if the collections section is to be displayed
  // If the client is focused in one collection only then there is no need
  const showCollections = !HOST_CONFIG.singleCollection;

  // Get the collection reference for the first collection id in the metadata
  // First collection is consider the "main representative" collection
  const mainCollection = showCollections && metadata.COLLECTIONS && metadata.COLLECTIONS[0];
  const mainCollectionReference = mainCollection && collectionReferences &&
    collectionReferences.find(collectionReference => collectionReference.id === mainCollection);
  const mainCollectionHoverText = mainCollectionReference && `The current simulation belongs to the ${
    mainCollectionReference.name} collection.\n` + mainCollectionReference.description;

  return (
    <span className={style.container}>
      {/* Render the accession */}
      <Typography variant="h6" className={style.title}>
        {`Project ${accession}`}
        <ChevronRightIcon fontSize='large' sx={{color: primaryDarkColor}}/>
        {/* MD selector */}
        {multipleMDs &&
          <Select
            variant="standard"
            value={mdIndex}
            onChange={event => {
              const newMdNumber = event.target.value + 1;
              history(`/id/${accession}.${newMdNumber}/${page}`);
            }}
            className={style.selector}
            >
            { // Sort MDs by name while using the index from the API
            mds
              .map((md, i) => ({ md, index: i }))
              .filter(({ md }) => !md.endsWith('(removed)'))
              .sort((a, b) => a.md.localeCompare(b.md))
              .map(({ md, index }) => (
              <MenuItem key={index} value={index}>
                {md}
              </MenuItem>
              ))}
          </Select>
        }
        {multipleMDs && <ChevronRightIcon fontSize='large' sx={{color: primaryDarkColor}}/>}
        {`${NICE_NAMES.get(page) || page} page ${isData ? ' (data)' : ''}`}
        {!isData && doc && doc.page && (
          <Info tooltip={tooltip} className={style.info} sx={{color: primaryDarkColor}}/>
        )}
      </Typography>
      {/* Main collection image */}
      {mainCollectionReference && <a href={`/#/collection/${mainCollection}`} target="_blank" rel="noreferrer noopener">
        <LazyImg
          src={mainCollectionReference.image} loading="lazy" alt={`Collection logo`}
          title={mainCollectionHoverText}
          style={{ width: 'auto', maxHeight: '2.6em' }}
        />
      </a>}
      {/* Render a button which links to the API */}
      {!isData && <Button
        component={Link}
        target="_blank"
        to={`/id/${accessionAndMdNumber}/${page}/data`}
        className={style['link-to-api']}
        sx={{ color: primaryDarkColor }}
      >
        <FontAwesomeIcon icon={faBook} />
        &nbsp;&nbsp;data in this page
      </Button>}
    </span>
  );
};

// Render the accession content: overview, trajectory, etc
const ContentSwitch = ({ subPage }) => {
  // Load the project context
  const project = useContext(ProjectCtx);

  // Change tab title according to the current project
  useEffect(() => {
    const previousTitle = document.title;
    document.title = project.mdCount > 1 ? project.accessionAndMdNumber : project.accession;
    // Return a cleanup function that will run when the component unmounts
    return () => { document.title = previousTitle; };
  }, [project.accessionAndMdNumber]);

  // If this is the global client then we must make one last check
  // Make sure the project does still exists in the federated node
  // To do so we have to ask for any data not stored in the global server
  // Thus we will force the global API to redirect the request to the federated node
  // In this case we will request topology data
  const problems = project.checkProblems(); // This is a hook
  // Get nodes info only if there are any problems with the federated node
  // This is just to know the node name, for the logs
  const nodesUrl = problems ? `${BASE_PATH}/current/nodes` : null;
  const { payload: nodesPayload, error: nodesError } = useAPI(nodesUrl);
  // Silently report any problem with this call since we don't really need it
  if (nodesError) console.error(nodesError.message);
  // Prepare the problems banner to be shown in the top of the page, right below the accession header
  const problemsBanner = useMemo(() => {
    if (!problems) return;
    // Get the node full name
    const nodeData = nodesPayload && nodesPayload.find(node => node.alias === project.node);
    const nodeName = (nodeData && nodeData.name) || project.node;
    // If the error comes from our own timeout
    if (problems.noResponse) return (
      <div className={style.problem}>
        <FontAwesomeIcon icon={faGhost} size='lg'/>
        <div>
          Data from project "{project.accession}" is stored in the "{nodeName}" federated node.
          However this node is not responding right now so data may be incomplete.
          Please try visting this entry later.
        </div>
      </div>
    );
    const errorResponse = problems.response;
    const errorContent = errorResponse.data;
    const errorCode = errorResponse.status;
    // Set a silent whistleblower with the original error from the federated node
    console.error(`Original error from the "${nodeName}" federated node: ` + errorContent);
    // If the project is not found
    if (errorCode === 404) return (
      <div className={style.problem}>
        <FontAwesomeIcon icon={faTrash} />
        <div>
          Data from project "{project.accession}"" should be stored in the "{nodeName}" federated node.
          However this node does not store the project data anymore.
        </div>
      </div>
    );
    // If there is a server error
    if (errorCode === 500) return (
      <div className={style.problem}>
        <FontAwesomeIcon icon={faExclamationCircle} />
        <div>
          Data from project "{project.accession}" is stored in the "{nodeName}" federated node.
          However this node is having problems right now so data may be incomplete.
          Please try visting this entry later.
        </div>
      </div>
    );
    else {
      return `The federated node "${nodeName}" is having an unknown problem with project "${project.accession}": ${problems.message}`;
    }
  }, [project, problems, nodesPayload]);
  // Memoize the lazy component so its reference stays stable across rerenders of ContentSwitch.
  // Without this, every rerender (e.g. triggered by the checkProblems topology fetch on global)
  // would create a new lazy() type, causing React to unmount and remount the entire subpage.
  const PageComponent = useMemo(() => lazy(() => import(`./${subPage}`)), [subPage]);

  // The overview page is prepared to work even when no additional data from the federated node is available
  // For this reason we let the render proceed only if the subpage is the overview page
  // Note that the overview page will also show the problems banner anyway
  if (problems && subPage !== 'overview') return problemsBanner;

  // Make sure the requested subpage exists among the available directions
  if (project.directions[subPage] === undefined) return `Subpage "${subPage}" is not recognized`;

  // Render the accession
  return (
    <ErrorBoundary>
      {problems && problemsBanner}
      {' '}
      <Routes>
        <Route
          path={`/`}
          element={PageComponent ?
            <Suspense fallback={<Loading />}>
              <PageComponent />
            </Suspense>
            : <>{`Subpage "${subPage}" not known`}</>
          }
        />
        <Route
          path={`/data`}
          element={
            <Suspense fallback={<Loading />}>
              <DataViewer accessionAndMdNumber={project.accessionAndMdNumber} subPage={subPage} />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={'This route is not defined in the client accession'}
        />
      </Routes>
    </ErrorBoundary>
  );
};

// The main component
const Accession = () => {
  const theme = useTheme();
  const primaryDarkColor = theme.palette.primary.dark;
  // Get the project accession according to the URL
  // Get the actual page where the user is going according to the URL
  const { accession: accessionAndMdNumber, page } = useParams();
  // Set a state to store the current project data
  const [project, setProject] = useState(null);
  // Set a state to store any error when downloading the project
  const [projectError, setProjectError] = useState(null);
  // Get project data using the API
  const projectURL = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/`;
  const {
    loading: projectQueryLoading,
    payload: projectQueryPayload,
    error: projectQueryError
  } = useAPI(projectURL);
  // As soon as we receive API data set the new project data
  useEffect(()=> {
    // Wait if we are stil
    if (projectQueryLoading) return;
    // If there was some problem then return the message
    if (projectQueryError) {
      setProjectError(`${projectQueryError.toString()}: ${projectQueryError.response.data}`);
      return;
    }
    // If the requested MD was removed then return an error message
    if (!projectQueryPayload) {
      setProjectError('Something went wrong with project data');
      return;
    }
    // If the requested MD was removed then return an error message
    if (projectQueryPayload.removed) {
      setProjectError('The requested MD has been removed');
      return;
    }
    // Save the current project data as the state project data
    const newProject = new Project(projectQueryPayload);
    setProject(newProject);
  }, [projectQueryLoading, projectQueryPayload, projectQueryError]);
  // If there was any problem with the project then stop here and report ir
  if (projectError) return projectError;
  // This may happen in the first renders
  if (!project) return <Loading />;
  // Return the accession routes
  return (
    // Set the project context, which is used by different scripts including this
    <ProjectCtx.Provider value={project}>
      <ProjectMenu accessionAndMdNumber={accessionAndMdNumber} subPage={page} />
      <AccessionHeader page={page} primaryDarkColor={primaryDarkColor} />
      {/* Load the main data summary */}
      <ContentSwitch subPage={page} />
    </ProjectCtx.Provider>
  );
};

Accession.displayName = 'Accession';
export default Accession;