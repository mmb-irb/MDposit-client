// The API sets this header in all its responses, errors included
// Responses with no header come from something in between (e.g. a proxy returning a 404 when it times out)
// Note that header names are read in lower case
export const API_HEADER = 'x-mddb-api';

// Text to be added to error messages when the response does not come from the API
export const NOT_FROM_API = 'not from the API';

// Check if a response comes from the API given its headers
// Headers may be a plain object (e.g. node http responses) or have a getter (e.g. axios and fetch responses)
export const isFromApi = headers => {
  if (!headers) return false;
  const value = typeof headers.get === 'function' ? headers.get(API_HEADER) : headers[API_HEADER];
  return Boolean(value);
};
