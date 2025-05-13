// React logic
import React, { useMemo } from 'react';

// Constants
import { BASE_PATH, NICE_NAMES } from 'src/utils/constants';
// Hook to request several URLs to the API at the same time
import useBatchAPI from '../../../hooks/use-batch-api';

// Visual assets
import { Accordion, AccordionSummary, AccordionDetails, Typography } from '@mui/material';
import Loading from '../../../components/loading';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TextLink from 'src/components/text-link';

// Given a URL get a label for the endpoint
const getEndpointLabel = url => {
  const splits = url.split('/');
  // If the last step is the accession then the previous step is 'projects'
  if (splits[splits.length - 2] === 'projects') return 'Project data';
  const label = splits[splits.length - 1];
  return NICE_NAMES.get(label) || label;
}

// Decoder for the API responsed
const dec = new TextDecoder('utf-8');

// API response parser
const parseResponse = payload => {
  if (payload === null) return;
  // Decode the response
  const actualResponse = dec.decode(payload);
  // Now format it to make it more human friendly
  const object = JSON.parse(actualResponse);
  const prettyJSON = JSON.stringify(object, null, 4);
  return <pre>{prettyJSON}</pre>;
};

// Set the API endpoints to be shown (in addition to project data) depending on the subpage
const ENDPOINTS = {
  overview: [],
  trajectory: [],
  files: ['filenotes'],
  rgyr: ['analyses/rgyr'],
  rmsds: ['analyses/rmsds', 'analyses/tmscores'],
  'rmsd-perres': ['analyses/rmsd-perres'],
  'rmsd-pairwise': ['analyses/rmsd-pairwise'],
  pca: ['analyses/pca'],
  fluctuation: ['analyses/fluctuation'],
  sasa: ['analyses/sasa'],
  'dist-perres': ['analyses/dist-perres'],
  hbonds: ['analyses/hbonds'],
  energies: ['analyses/energies'],
  pockets: ['analyses/pockets'],
  markov: ['analyses/markov'],
  clusters: ['analyses/clusters'],
  density: ['analyses/density'],
  thickness: ['analyses/thickness'],
  apl: ['analyses/apl'],
  'lipid-order': ['analyses/lipid-order'],
  'lipid-inter': ['analyses/lipid-inter'],
  electrostatic: ['analyses/interactions'],
  mutations: ['references'],
  epitopes: ['references'],
  populations: [`files/populations.json`],
  'ligand-descriptors': ['references'],
  ligands: ['analyses/ligands'],
  dihenergies: ['analyses/dihenergies'],
}

// Set a flag for the subpages that are not implemented yet
const NOT_IMPLEMENTED_ERROR = 'Subpage data is not configured';

// This subpage displays the different API endpoints used in a specific subpage
const DataViewer = ({ accessionAndMdNumber, subPage }) => {
  // Get all API URLs together in a memoized array
  // Otherwise the API call makes the page rerender forever
  const apiUrls = useMemo(() => {
    // Set the project URL
    const projectUrl = `${BASE_PATH}current/projects/${accessionAndMdNumber}`;
    // Get additional endpoints according to the subpage
    const additionalEndpoints = ENDPOINTS[subPage];
    if (additionalEndpoints === undefined) return NOT_IMPLEMENTED_ERROR;
    // Convert endpoints to valid API URLs
    const additionalUrls = additionalEndpoints.map(endpoint => `${projectUrl}/${endpoint}`);
    return [ projectUrl, ...additionalUrls ]
  }, [accessionAndMdNumber, subPage]);
  console.log(apiUrls);
  if (apiUrls === NOT_IMPLEMENTED_ERROR) return NOT_IMPLEMENTED_ERROR;
  // Request all API URLs
  const apiResponses = useBatchAPI(apiUrls);
  console.log(apiResponses);
  // Render every requested URL, even if we still have no response
  return apiResponses.map((response, i) => 
    <Accordion key={i} slotProps={{ transition: { timeout: 500 } }} defaultExpanded={apiResponses.length === 1}>
      <AccordionSummary>
        <ChevronRightIcon color="primary" fontSize='large'/>
        <Typography variant="h6">{getEndpointLabel(response.url)}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <TextLink name={response.url} url={response.url} style={{ padding: '1em' }}/>
        {(response.loading && <Loading />) || parseResponse(response.payload)}
      </AccordionDetails>
    </Accordion>
  );
};

export default DataViewer;
