import React, { useState } from 'react';

import useAPI from '../../hooks/use-api';
import useNGLFile from '../../hooks/use-ngl-file';

import ErrorBoundary from '../../components/error-boundary';

import { ProjectCtx, PdbCtx } from '../../contexts';

import Card from '../../components/animated-card';
import ViewerWithControls from '../../components/ngl-viewer-with-controls';
import Loading from '../../components/loading';

import style from './style.module.css';

import { BASE_PATH_PROJECTS, MAIN_STRUCTURE_FILENAME } from '../../utils/constants';

// Load the project class
import { Project } from '../../utils/project-manager';
import { useParams } from 'react-router-dom';

const Embed = () => {
  const { accession: accessionAndMdNumber } = useParams();
  const [project, setProject] = useState(null);

  // Get project data from the API if the current context data is wrong. 'payload' contains the main data.
  const projectRequest = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/`);

  // Load the structure data form the API
  const pdbData = useNGLFile(
    `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/files/${MAIN_STRUCTURE_FILENAME}`,
    // This attribute was included before: defaultRepresentation: false
    { defaultRepresentation: false, ext: 'pdb' },
  );

  // While loading
  if (projectRequest.loading) return <Loading />;
  if (projectRequest.error) return projectRequest.error.toString();
  // This should never happen
  if (!projectRequest.payload) return null;

  // Set the final project data to be loaded in context
  const projectData = new Project(projectRequest.payload);
  if (!project) {
    setProject(projectData);
    return;
  }

  if (pdbData.loading) return <Loading />;
  else if (pdbData.error) return pdbData.error.toString();
  else if (!pdbData.file) return 'Something bad happened with the pdb data';

  // Make some modifications to the project data once loaded
  // If accession is missing then set the identifier as the accession
  if (!project.accession) project.accession = project.identifier;
  // Order chain indices by alphabetic number when we have new project data
  if (project.chains) project.chains.sort();

  return (
    <ErrorBoundary>
      <ProjectCtx.Provider value={project}>
        <PdbCtx.Provider value={pdbData}>
          <Card className={style['ngl-card']}>
            <ViewerWithControls className={style.container} />
          </Card>
        </PdbCtx.Provider>
      </ProjectCtx.Provider>
    </ErrorBoundary>
  );
};

export default Embed;
