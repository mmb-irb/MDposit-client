// The API sets this header in all its responses, errors included
// Responses with no header come from something in between (e.g. a proxy returning a 404 when it times out)
// Note that header names are read in lower case
export const API_HEADER = 'x-mddb-api';

// Text to be added to error messages when the response does not come from the API
export const NOT_FROM_API = 'not from the API';

// Text to be added to error messages when there is no response we can read (e.g. a network error)
// This happens when the node is down, the connection is cut or the browser blocks the response
// Note that browsers block responses with no CORS headers from other origins (e.g. a proxy error page)
export const NO_API_RESPONSE = 'no readable response from the API';

// Check if a response comes from the API given its headers
// Headers may be a plain object (e.g. node http responses) or have a getter (e.g. axios and fetch responses)
export const isFromApi = headers => {
  if (!headers) return false;
  const value = typeof headers.get === 'function' ? headers.get(API_HEADER) : headers[API_HEADER];
  return Boolean(value);
};
