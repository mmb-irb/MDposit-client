import { buildReturn } from '../filters';

// Fields requested to the API to build the rows of the project browser
// Note that when the API gets the 'return' argument it sends the raw database projects, not the formatted ones
// Raw projects keep every MD apart, so the fields from the MD level are requested for all MDs
export const BROWSER_RETURN_FIELDS = [
  'accession',
  'published',
  'deleted',
  'mdref',
  'pdbInfo.compound',
  'metadata.NAME',
  'metadata.METHOD',
  'metadata.REFERENCES',
  'analyses.name',
  'mds.name',
  'mds.removed',
  'mds.analyses.name',
  'mds.files.name',
];

// The URL query string to be added to the projects request in the browser
export const BROWSER_RETURN_QUERY = buildReturn(BROWSER_RETURN_FIELDS);

// Convert a raw project, as the API returns it when some fields are requested, into a formatted project
// The result has the same structure than the formatted project which the API returns by default
// This must be kept in sync with the project formatter in the API, but only for the fields in BROWSER_RETURN_FIELDS
export const formatRawProject = rawProject => {
  const identifier = rawProject.accession || rawProject._id;
  // Errors are returned in the same way the API does, so the browser rows are able to display them
  if (rawProject.deleted)
    return { accession: rawProject.accession, error: `Project ${identifier} was deleted and is no longer available.` };
  if (!rawProject.mds)
    return { accession: rawProject.accession, error: `Project ${identifier} is missing mds. Is it in an old format?` };
  if (!rawProject.metadata)
    return { accession: rawProject.accession, error: `Project ${identifier} is missing metadata, which should never happen. Was it added manually?` };
  // Get the reference MD, which is the one shown in the browser
  const mdIndex = rawProject.mdref;
  const mdData = rawProject.mds[mdIndex];
  if (!mdData)
    return { accession: rawProject.accession, error: `The requested MD does not exist in project ${identifier}. Please try with numbers between 1 and ${rawProject.mds.length}.` };
  // Merge project and MD analyses and files and keep their names only
  const projectAnalyses = rawProject.analyses || [];
  const mdAnalyses = mdData.analyses || [];
  const mdFiles = mdData.files || [];
  const { _id, mds, analyses, ...rest } = rawProject;
  return {
    ...rest,
    identifier,
    mdIndex,
    mdNumber: mdIndex + 1,
    analyses: projectAnalyses.concat(mdAnalyses).map(analysis => analysis.name),
    files: mdFiles.map(file => file.name),
    mds: mds.map(md => md && (md.name || 'unnamed') + (md.removed ? ' (removed)' : '')),
  };
};
