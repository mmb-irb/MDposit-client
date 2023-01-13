import React, { useState } from 'react';

import useAPI from '../../hooks/use-api';
import useNGLFile from '../../hooks/use-ngl-file';

import ErrorBoundary from '../../components/error-boundary';

import { ProjectCtx, PdbCtx } from '../../contexts';

import Card from '../../components/animated-card';
import NGLViewerWithControls from '../../components/ngl-viewer-with-controls';
import Loading from '../../components/loading';

import style from './style.module.css';

import { BASE_PATH_PROJECTS, PATH_MAIN_TOPOLOGY } from '../../utils/constants';

// Load the topology class
import { Topology } from '../../utils/topology-manager';

const Embed = ({ match }) => {
  const accession = match.params.accession;
  const [project, setProject] = useState(null);

  // Get project data from the API if the current context data is wrong. 'payload' contains the main data.
  const projectRequest = useAPI(`${BASE_PATH_PROJECTS}${accession}/`);

  // Load the structure data form the API
  const pdbData = useNGLFile(
    `${BASE_PATH_PROJECTS}${accession}${PATH_MAIN_TOPOLOGY}`,
    // This attribute was included before: defaultRepresentation: false
    { defaultRepresentation: false, ext: 'pdb' },
  );

  // Request topology data to the API
  const topology = useAPI(`${BASE_PATH_PROJECTS}${accession}/topology`);

  // While loading
  if (projectRequest.loading) return <Loading />;
  if (projectRequest.error) return projectRequest.error.toString();
  // This should never happen
  if (!projectRequest.payload) return null;

  // Set the final project data to be loaded in context
  const projectData = projectRequest.payload;
  if (!project) {
    setProject(projectData);
    return;
  }

  if (pdbData.loading) return <Loading />;
  else if (pdbData.error) return pdbData.error.toString();
  else if (!pdbData.file) return 'Something bad happened with the pdb data';

  if (topology.loading) return <Loading />;
  else if (topology.error) return topology.error.toString();
  else if (!topology.payload) return 'Something bad happened with the topology';

  // Make some modifications to the project data once loaded
  // If accession is missing then set the identifier as the accession
  if (!project.accession) project.accession = project.identifier;
  // Order chain indices by alphabetic number when we have new project data
  if (project.chains) project.chains.sort();

  // Setup the topology
  // This class contains several functions for topology data managment and it is widely use among the different pages
  const topologyManager = new Topology(topology.payload, projectData.metadata);
  // This class is added to the project context
  projectData.topology = topologyManager;

  return (
    <ErrorBoundary>
      <ProjectCtx.Provider value={project}>
        <PdbCtx.Provider value={pdbData}>
          <Card className={style['ngl-card']}>
            <NGLViewerWithControls className={style.container} />
          </Card>
        </PdbCtx.Provider>
      </ProjectCtx.Provider>
    </ErrorBoundary>
  );
};

export default Embed;
