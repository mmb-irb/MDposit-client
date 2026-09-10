import React, { useState, useMemo } from 'react';

import useAPI from '../../hooks/use-api';

import ErrorBoundary from '../../components/error-boundary';

import { ProjectCtx } from '../../contexts';

import Card from '../../components/animated-card';
import ViewerWithControls from '../../components/viewer-with-controls';
import Loading from '../../components/loading';

import style from './style.module.css';

import { BASE_PATH_PROJECTS } from '../../utils/constants';

// Load the project class
import { Project } from '../../utils/project-manager';
import { useParams, useSearchParams } from 'react-router-dom';
import { rangedSelectionParser } from '../../utils/auxiliar-functions';

// Parse a selection query param supporting plain lists ("0,1,2") and ranges ("0-5,10").
// Throws if any token is not a valid integer or range.
const parseSelectionParam = (raw, name) => {
  if (!raw) return null;
  const parsed = rangedSelectionParser(raw);
  if (parsed.some(n => !Number.isFinite(n)))
    throw new Error(`Invalid query parameter "${name}": "${raw}"`);
  return parsed.length > 0 ? parsed : null;
};

const Embed = () => {
  const { accession: accessionAndMdNumber } = useParams();
  const [searchParams] = useSearchParams();
  const [project, setProject] = useState(null);

  // Parse the four supported selection query params.
  // All are combined into a single component as server-side filters.
  const selectionParam    = searchParams.get('selection') || null;
  const atomIndicesParam  = parseSelectionParam(searchParams.get('atomindices'),  'atomindices');
  const resIndicesParam   = parseSelectionParam(searchParams.get('resindices'),   'resindices');
  const chainIndicesParam = parseSelectionParam(searchParams.get('chaindices'),   'chaindices');
  // Check if the user wants the trajectory to be centered constantly
  const centering = (() => {
    const originalInput = searchParams.get('center');
    if (originalInput === null) return false;
    const lowerInput = originalInput.toLowerCase();
    if (lowerInput === 'false' || lowerInput === 'no') return false;
    return true; // If the argument is passed alone then we will have an empty string
  })();

  // Build a single startingComponent that combines all provided selection params.
  const startingComponents = useMemo(() => {
    if (!atomIndicesParam && !resIndicesParam && !chainIndicesParam && !selectionParam) return null;
    const comp = { name: 'Main' };
    if (atomIndicesParam)  comp.atomIndices   = atomIndicesParam;
    if (resIndicesParam)   comp.resIndices    = resIndicesParam;
    if (chainIndicesParam) comp.chainIndices  = chainIndicesParam;
    if (selectionParam)    comp.atomSelection = selectionParam;
    return [comp];
  }, [atomIndicesParam, resIndicesParam, chainIndicesParam, selectionParam]);

  // Get project data from the API if the current context data is wrong. 'payload' contains the main data.
  const projectRequest = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/`);

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

  // Make some modifications to the project data once loaded
  // If accession is missing then set the identifier as the accession
  if (!project.accession) project.accession = project.identifier;
  // Order chain indices by alphabetic number when we have new project data
  if (project.chains) project.chains.sort();

  return (
    <ErrorBoundary>
      <ProjectCtx.Provider value={project}>
        <Card className={style['ngl-card']}>
          <ViewerWithControls
            className={style.container}
            startingComponents={startingComponents || undefined}
            centering={centering}
          />
        </Card>
      </ProjectCtx.Provider>
    </ErrorBoundary>
  );
};

export default Embed;
