// Fields of the formatted project which are needed by the browser table
// They are requested with the API 'get' argument, which keeps only these fields after formatting the projects
// Note that, unlike 'return', 'get' does not make the API send raw projects
// Paths are not converted to aliases since they are paths of the formatted project, not of the database
export const BROWSER_GET_FIELDS = [
  'identifier',
  'accession',
  'published',
  'mdNumber',
  'pdbInfo.compound',
  'metadata.NAME',
  'metadata.METHOD',
  'metadata.REFERENCES',
  'analyses',
  'mds',
  'files',
];

// The URL query string to be added to the projects request in the browser
export const BROWSER_GET_QUERY = BROWSER_GET_FIELDS.map(field => 'get=' + field).join('&');
