import React from 'react';

import useAPI from '../../hooks/use-api';
import useNGLFile from '../../hooks/use-ngl-file';

import ErrorBoundary from '../../components/error-boundary';

import { AccessionCtx, PdbCtx } from '../../contexts';

import Card from '../../components/animated-card';
import NGLViewerWithControls from '../../components/ngl-viewer-with-controls';
import Loading from '../../components/loading';

import style from './style.module.css';

import { BASE_PATH_PROJECTS, PATH_MAIN_TOPOLOGY } from '../../utils/constants';

const Embed = ({ match, projectState }) => {
  const accession = match.params.accession;
  const [project, setProject] = projectState;

  // Get project data from the API if the current context data is wrong. 'payload' contains the main data.
  let { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/`,
  );

  // Load the structure data form the API
  const pdbData = useNGLFile(
    `${BASE_PATH_PROJECTS}${accession}${PATH_MAIN_TOPOLOGY}`,
    // This attribute was included before: defaultRepresentation: false
    { defaultRepresentation: false, ext: 'pdb' },
  );

  if (pdbData.loading) return <Loading />;
  else if (pdbData.error) return pdbData.error.toString();
  else if (!pdbData.file) return 'Something bad happened with the topology';

  // While loading
  if (loading) return <Loading />;
  if (error) return error.toString();
  // This should never happen
  if (!payload) return null;

  // Set the project context
  setProject(payload);
  if (!project) return <Loading />;

  return (
    <ErrorBoundary>
      <AccessionCtx.Provider value={accession}>
        <PdbCtx.Provider value={pdbData}>
          <Card className={style['ngl-card']}>
            <NGLViewerWithControls className={style.container} />
          </Card>
        </PdbCtx.Provider>
      </AccessionCtx.Provider>
    </ErrorBoundary>
  );
};

export default Embed;
