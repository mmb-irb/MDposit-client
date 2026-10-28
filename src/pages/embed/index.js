import React, { useState, useMemo, useContext } from 'react';

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
import { useParams, useSearchParams } from 'react-router';
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

// Set the viewer, which may target a specific residue
// This must be a separated component inside the project context since the topology getter uses hooks
// If there is a target residue then default representations are made transparent and the residue is
// represented in ball+stick, the camera is focused on it and the trajectory is centered around it
const EmbedViewer = ({ targetResidue, ...props }) => {
  const { topology } = useContext(ProjectCtx);

  // Set the NGL selection of the target residue, if any
  const targetResidueSelection = useMemo(() => {
    if (targetResidue === null || !topology) return null;
    return topology.getResidueByIndex(targetResidue).nglSelection;
  }, [targetResidue, topology]);

  // Set the default representations transparent plus an extra representation for the target residue
  const startingRepresentations = useMemo(() => {
    if (!targetResidueSelection) return undefined;
    const representations = topology.defaultRepresentations.map(rep => ({ ...rep, opacity: 0.1 }));
    representations.push({
      name: `Residue ${targetResidue}`,
      selection: targetResidueSelection,
      type: 'ball+stick',
      color: 'element',
    });
    return representations;
  }, [targetResidue, targetResidueSelection, topology]);

  // Focus the camera on the target residue
  const initialFocus = useMemo(() => {
    if (!targetResidueSelection) return undefined;
    return { sele: targetResidueSelection };
  }, [targetResidueSelection]);

  // If there is no target residue then render the viewer as usual
  if (targetResidue === null)
    return <ViewerWithControls {...props} />;

  // Wait for the topology to be loaded, since starting representations are only read once
  if (!targetResidueSelection) return <Loading />;

  return (
    <ViewerWithControls
      startingRepresentations={startingRepresentations}
      initialFocus={initialFocus}
      centering={targetResidueSelection}
      {...props}
    />
  );
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
  // Check if the user wants to target a specific residue
  // The value is the residue index
  const targetResidue = (() => {
    const originalInput = searchParams.get('targetResidue');
    if (originalInput === null) return null;
    if (!/^\d+$/.test(originalInput))
      throw new Error(`Invalid query parameter "targetResidue": "${originalInput}"`);
    return Number(originalInput);
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
          <EmbedViewer
            className={style.container}
            startingComponents={startingComponents || undefined}
            targetResidue={targetResidue}
            allowMolstar
          />
        </Card>
      </ProjectCtx.Provider>
    </ErrorBoundary>
  );
};

export default Embed;
