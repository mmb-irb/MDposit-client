// React logic
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

// String managers
import { parse, stringify } from 'qs';

// Classnames
import cn from 'classnames';

// Visual assets
import {
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  TableFooter,
  Typography,
  Chip,
} from '@mui/material';

// Additional components
import Card from '../../components/animated-card'; // The exceled parcels in which almost all features are based
import Highlight from '../../components/highlight'; // Used to underline text
import Loading from '../../components/loading'; // Displays an animated "loading" circle

// Hooks
import useAPI from '../../hooks/use-api'; // API acces

// Constants
import { BASE_PATH_PROJECTS, NICE_NAMES } from '../../utils/constants';

// CSS styles
import style from './style.module.css';

// It is used to check if the user has the reduced motion setting active
import reducedMotion from '../../utils/reduced-motion';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const na = 'Not available';

// Define non-changing props used by the table footer
const rowsPerPageOptions = [5, 10, 25, 50];
const backIconButtonProps = { title: 'Previous page' };
const nextIconButtonProps = { title: 'Next page' };

// These keyframes are used for an animate()
// An image opacity is iterated between 0 (invisible) and 1 (visible)
const keyframes = {
  opacity: [0, 1],
};

// Same image vertical position is iterated between 0 and 50 pixels (It may have no effect)
// This is only set when user has not activated the reduced motion option from the navigator
if (!reducedMotion()) {
  keyframes.transform = ['translateX(2.5%)', 'translateX(0)'];
}

// Set manually which references have entropies
// This needs to be updated by hand when there is a new reference with entropies
// This workaround prevents downloading all references data to ckeck it, which would be unefficient
const referencesWithEntropies = ['P0DTC2'];
const hasEntropies = reference => {
  return referencesWithEntropies.indexOf(reference) > -1;
};
const referencesWithEpitopes = ['P0DTC2'];
const hasEpitopes = reference => {
  return referencesWithEpitopes.indexOf(reference) > -1;
};

const Row = ({ project, highlight, index }) => {
  // Harvest data from the project object
  const {
    identifier,
    accession,
    published,
    pdbInfo,
    metadata,
    analyses,
    files,
  } = project;
  // Declare a hook from a type called "useRef"
  const ref = useRef(null);
  // This type of hook is like an "useEfect" but it is runned after the layout is calculated and before it is painted
  // useEffect here would re-render the whole page, thus creating "load hesitation" and a delay
  useLayoutEffect(() => {
    if (!(ref.current && ref.current.animate)) return;
    // Animate the rows to move from right to left when they appear
    const animation = ref.current.animate(keyframes, {
      fill: 'both',
      easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      duration: 750,
      // Set a delay which depends on the index to create a cascade effect
      delay: 100 + index * 75,
    });

    return () => animation.cancel();
  }, [index]);

  // Push the electrostatic surface analysis if we have interactions in metadata
  if (
    metadata &&
    metadata.INTERACTIONS &&
    metadata.INTERACTIONS.length > 0 &&
    analyses &&
    !analyses.includes('electrostatic')
  )
    analyses.push('electrostatic');

  // Push the populations analysis if we have the populations.json file
  if (
    files &&
    files.find(file => file.filename === 'populations.json') &&
    analyses &&
    !analyses.includes('populations')
  )
    analyses.push('populations');

  // Check if any metadata reference has entropies
  const references = metadata && metadata.REFERENCES;
  const anySuitableReferenceWithEntropies =
    references && references.some(reference => hasEntropies(reference));
  // Push the mutations analysis if so
  if (
    anySuitableReferenceWithEntropies &&
    analyses &&
    !analyses.includes('mutations')
  )
    analyses.push('mutations');
  // Check if any metadata reference has a map and its reference data has entropies
  const anySuitableReferenceWithEpitopes =
    references && references.some(reference => hasEpitopes(reference));
  // Push the entropies analysis if so
  if (
    anySuitableReferenceWithEpitopes &&
    analyses &&
    !analyses.includes('epitopes')
  )
    analyses.push('epitopes');

  // Returns a table with multiple rows
  // The 3 first rows: accession, PDB accession and name are searchable. Search text is highlighted when found
  return (
    <TableRow
      ref={ref} // "ref" is a method from TableRow and many other rendered elements
      className={cn({ [style['not-published']]: !published })}
    >
      {/* accession */}
      <TableCell>
        <Link
          to={{
            pathname: `/browse/${accession || identifier}/overview`,
            // We pass the selected project data so there is no need to query it again
            state: { projectData: project },
          }}
        >
          <Highlight highlight={highlight}>
            {accession || identifier}
            {!published && ' (not published)'}
          </Highlight>
        </Link>
      </TableCell>
      {/* name */}
      <TableCell>
        <Highlight highlight={highlight}>
          {metadata && metadata.NAME
            ? metadata.NAME
            : pdbInfo && pdbInfo.compound
            ? pdbInfo.compound
            : na}
        </Highlight>
      </TableCell>
      {/* groups */}
      <TableCell>{(metadata && metadata.GROUPS) || na}</TableCell>
      {/* analyses */}
      <TableCell>
        {analyses && analyses.length
          ? analyses
              // Available analyses are sorted alphabetically
              .sort()
              // Display only allowed analysis
              .filter(element =>
                [
                  'rmsds',
                  'rgyr',
                  'fluctuation',
                  'pca',
                  'rmsd-perres',
                  'rmsd-pairwise',
                  'dist-perres',
                  'hbonds',
                  'electrostatic',
                  'energies',
                  'pockets',
                  'mutations',
                  'epitopes',
                  'sasa',
                  'populations',
                ].includes(element),
              )
              // For each analysis create a clickable button which links to the analysis route
              .map(analysis => (
                <Chip
                  key={analysis}
                  clickable
                  className={style.analysis}
                  component={Link}
                  to={{
                    pathname: `/browse/${accession || identifier}/${analysis}`,
                    // We pass the selected project data so there is no need to query it again
                    state: { projectData: project },
                  }}
                  label={NICE_NAMES.get(analysis) || analysis}
                  variant="outlined"
                />
              ))
          : na}
      </TableCell>
    </TableRow>
  );
};

const Browse = () => {
  // Get the location and the history
  const location = useLocation();
  const history = useNavigate();
  // Convert the URL string into an object
  // This "parse" comes from the "qs" library
  // WARNING: The default "parse" decoding behaviour has a strong conflict between '+' and blank space character
  // This workaround first decodes and then parses without decoding
  // The 'decoder' option is necessary for not decoding
  const decoded = decodeURIComponent(location.search);
  const search = parse(decoded, {
    ignoreQueryPrefix: true,
    decoder: c => c,
  });

  // Convert the specified object back to a single encoded string
  const searchString = stringify({
    search: search.search,
    query: search.query,
    page: search.page || DEFAULT_PAGE,
    limit: search.limit || DEFAULT_LIMIT,
  });

  // Scroll up when the page is changed
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [search.page]);

  // Save the previous payload. It is rendered in low opacity when the new payload is empty
  const previousPayload = useRef(null);

  // Download all necessary data from the API
  // 'payload' contains the main data
  const ApiUrl = `${BASE_PATH_PROJECTS}?${searchString}`;
  const { loading, payload, error } = useAPI(ApiUrl);

  // While loading
  // Code above is runned multiple times (around 5) each time the browser is loaded
  if (loading && !previousPayload.current) return <Loading />;

  // When error
  // This usually happens when the API does not work properly
  if (error) {
    return error.toString();
  }

  // Define the results for the final render since it won't support 'null's
  let results;
  let matchCount = 0;
  if (payload) {
    results = payload.projects;
    matchCount = payload.filteredCount;
    previousPayload.current = payload;
  } else if (previousPayload.current) {
    results = previousPayload.current.projects;
    matchCount = previousPayload.current.filteredCount;
  } else results = [];

  // When success
  return (
    <Card>
      <CardContent className={style.minheight}>
        {/* Render a 'no results' card when there are no results for the last search */}
        {!loading && !payload ? (
          <Card className={style['no-results-card']}>
            <Typography variant="h5" className={style['no-results-text']}>
              No results were found
            </Typography>
          </Card>
        ) : (
          []
        )}
        <Table>
          {/*className={cn({ [style['invalid-results']]: !payload })} */}
          {/* Table head with the names of each colum */}
          <TableHead className={style['table-head']}>
            <TableRow>
              <TableCell>accession</TableCell>
              <TableCell>name</TableCell>
              <TableCell>groups</TableCell>
              <TableCell>analyses</TableCell>
            </TableRow>
          </TableHead>
          {/* Table body with the content, which is defined above in the Row constant */}
          {/* When the search has no results the table gets an opacity of 0.25 */}
          <TableBody
            className={
              payload
                ? cn(style['table-body'])
                : cn(style['table-body'], style['invalid-results'])
            }
          >
            {/* Create a row for each project in the payload*/}
            {results.map((project, index) => (
              <Row
                // Load the propierties (inputs) that the class "Row" is expecting
                project={project} // Load identifier, accession, published, pdbInfo and analyses
                highlight={search.search} // Load the highlight
                index={index} // Load the index
                key={project.identifier} // Add a key for react to do not complain
              />
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              {/* Table footer used to change the page to see more results */}
              <TablePagination
                // IMPORTANT: Pagination is controled through the 'history', which may be updated from 'search'
                // Many of the following variables are methods from TablePagination (They are tagged as MTP). https://material-ui.com/api/table-pagination/
                rowsPerPageOptions={rowsPerPageOptions} // (MTP) Optional numbers of rows displayed in each page. It can be modified by the user.
                colSpan={6} // Set the anchor of columns which is taken as a reference for the horizontal position of the footer
                count={matchCount} // (MTP) Total number of rows
                rowsPerPage={+search.limit || DEFAULT_LIMIT} // (MTP) The actual number of rows displayed
                page={(+search.page || DEFAULT_PAGE) - 1} // (MTP) The actual page
                onPageChange={(_, page) => {
                  // (MTP) When the page is changed
                  history({
                    ...location, // Load all location variables: hast, pathname, search and state
                    // Convert into a single encoded string all parameters listed below
                    search: stringify({
                      search: search.search,
                      query: search.query,
                      page: page + 1 === DEFAULT_PAGE ? undefined : page + 1,
                      limit:
                        !search.limit || +search.limit === DEFAULT_LIMIT
                          ? undefined
                          : +search.limit,
                    }),
                  });
                }}
                onRowsPerPageChange={({ target: { value } }) => {
                  // (MTP) When the rowsPerPage is modified by the user
                  history({
                    ...location, // Load all location variables: hast, pathname, search and state
                    // Convert into a single encoded string all parameters listed below
                    search: stringify({
                      search: search.search,
                      query: search.query,
                      limit: +value === DEFAULT_LIMIT ? undefined : value,
                    }),
                  });
                }}
                backIconButtonProps={backIconButtonProps} // (MTP) Non-changing propierties of the back page button
                nextIconButtonProps={nextIconButtonProps} // (MTP) Non-changing propierties of the next page button
              />
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
};

export default Browse;
