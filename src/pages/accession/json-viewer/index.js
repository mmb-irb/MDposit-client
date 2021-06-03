// React logic
import React from 'react';

import useAPI from '../../../hooks/use-api';

// Visual assets

import Loading from '../../../components/loading';

const JsonViewer = params => {
  const url = params.url;

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(url);

  if (!url) return 'No URL provided';

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  // Format the json payload to be pretty
  const prettyJson = JSON.stringify(payload, null, 4);

  return <pre>{prettyJson}</pre>;
};

export default JsonViewer;
