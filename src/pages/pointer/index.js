import React, { useMemo } from 'react';
import { useLocation } from 'react-router';
// Load a custom hook to quert the API
import useAPI from 'src/hooks/use-api';
// Automatic parsers for URL search or additional arguments
import { parse } from 'qs';
// Constants
import { BASE_VERSIONED_PATH, HOST_CONFIG } from '../../utils/constants';
// Import web components
import Card from '../../components/animated-card';
import {
  CardContent,
  Typography,
} from '@mui/material';
import Loading from 'src/components/loading';
// Import local components
import PointerRow, { PROJECTION_METADATA } from './row';

// Set ID names for the different references
const ID_NAMES = {
  proteins: 'UniProt ID',
  inchikeys: 'InChI Key',
  pdbs: 'PDB code'
};

// Display projects associated with external references
const Pointer = () => {
  // Get the URL arguments
  const location = useLocation();
  const argsString = location.search.slice(1); // Remove the initial '?'
  const args = parse(argsString);
  // Make sure the arguments were passed
  const reference = args.ref;
  const referenceId = args.id && args.id.toUpperCase();
  if (!reference) return 'Missing reference';
  if (!referenceId) return 'Missing reference id';
  // Set project metadata values to retrieve from the pointers endpoint
  const projectionParameters = '?' + Object.values(PROJECTION_METADATA)
    .map(field => 'projection=' + field).join('&');
  // Get pointers data using the API
  const pointerURL = `${BASE_VERSIONED_PATH}/pointers/${reference}/${referenceId}${projectionParameters}`;
  const { loading, payload, error } = useAPI(pointerURL);
  // Group results according to the grouper parameter
  const groupedData = useMemo(() => {
    if (!payload) return;
    const groupedData = {};
    // Get the unique available values in the grouper parameters
    payload.forEach(project => {
      const group = project[HOST_CONFIG.optionsField];
      if (!groupedData[group]) groupedData[group] = [];
      groupedData[group].push(project);
    })
    return groupedData;
  }, [payload]);
  // Wait for the response
  if (loading) return <Loading />;
  if (error) return error.message;
  if (!payload) return 'Something went wrong';
  // Set the name of the referece id
  const idName = ID_NAMES[reference] || `${reference} ID`;
  // Render the page
  return (<Card>
    <CardContent>
      <Typography variant="h5" style={{ marginBottom: '0.6em' }}>
        {`Entries including "${referenceId}" ${idName} (${payload.length} results)`}
      </Typography>
      {Object.entries(groupedData).map(([group, projects]) =>
        <PointerRow key={group} group={group} projects={projects} />
      )}
    </CardContent>
  </Card>);
};

export default Pointer;