// React logic
import React, { lazy, Suspense, useContext, useEffect, useState } from 'react';
import { Link, Routes, Route, useLocation, useParams, useNavigate } from 'react-router-dom';

// Visual assets
import { Typography, Button, Select, MenuItem } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook } from '@fortawesome/free-solid-svg-icons';
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
  BASE_PATH_PROJECTS,
  MAIN_STRUCTURE_FILENAME,
  NICE_NAMES,
} from '../../utils/constants';

// Styling
import style from './style.module.css';
import { useTheme } from '@mui/material/styles';

// The menu used to change the subpage inside the project
import ProjectMenu from '../../components/menu/project-menu';
// Component used to visualize API data related to the current subpage
import DataViewer from './data-viewer';

// The AccessionHeader component
const AccessionHeader = ({ project, accession, accessionAndMdNumber, page, primaryDarkColor }) => {
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
  const multipleMDs = project.mdCount > 1;

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
            value={project.mdIndex}
            onChange={event => {
              const newMdNumber = event.target.value + 1;
              history(`/id/${accession}.${newMdNumber}/${page}`);
            }}
            className={style.selector}
            >
            {project.mds
              .map((md, i) => ({ md, index: i }))
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
            {/* Render a button which links to the API */}
      {!isData && <Button
        component={Link}
        target="_blank"
        to={`/id/${accessionAndMdNumber}/${page}/data`}
        className={style['link-to-api']}
        sx={{
          color: primaryDarkColor,
        }}
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
  // Find the first valid structure filename found in the project
  // Load the structure data from the API
  const pdbData = useNGLFile(
    `${BASE_PATH_PROJECTS}/${project.accessionAndMdNumber}/files/${MAIN_STRUCTURE_FILENAME}`,
    // This attribute was included before: defaultRepresentation: false
    { defaultRepresentation: false, ext: 'pdb' },
  );

  // Change tab title according to the current project
  useEffect(() => {
    const previousTitle = document.title;
    document.title = project.mdCount > 1 ? project.accessionAndMdNumber : project.accession;
    // Return a cleanup function that will run when the component unmounts
    return () => {
      document.title = previousTitle;
  };
  }, [project.accessionAndMdNumber]);
  // Wait for the pdbData to arrive
  if (pdbData.loading) return <Loading />;
  else if (pdbData.error) return pdbData.error.toString() + ' (in pdbData)';
  else if (!pdbData.file) return 'Something bad happened with the pdb data';

  // Make sure the requested subpage exists among the available directions
  if (project.directions[subPage] === undefined) return `Subpage "${subPage}" is not recognized`;

  // Get the component to be rendered according to the subpage name
  //const Component = pageComponents[subPage];
  const PageComponent = lazy(() => import(`./${subPage}`));

  // Render the accession
  return (
    <ErrorBoundary>
      {' '}
      <PdbCtx.Provider value={pdbData}>
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
      </PdbCtx.Provider>
    </ErrorBoundary>
  );
};

// The main component
const Accession = () => {
  const theme = useTheme();
  const primaryDarkColor = theme.palette.primary.dark;
  // Get the project accession according to the URL
  const { accession: accessionAndMdNumber, page } = useParams();
  // Get the actual page where the user is going according to the URL
  const accessionSplits = accessionAndMdNumber.split('.');
  const accession = accessionSplits[0];
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
      <AccessionHeader 
        project={project}
        accession={accession}
        accessionAndMdNumber={accessionAndMdNumber}
        page={page}
        primaryDarkColor={primaryDarkColor}
      />
      {/* Load the main data summary */}
      <ContentSwitch subPage={page} />
    </ProjectCtx.Provider>
  );
};

Accession.displayName = 'Accession';
export default Accession;