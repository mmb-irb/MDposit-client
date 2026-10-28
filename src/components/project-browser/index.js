// React logic
import React, { useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import Row from './row';
import Pagination from '../pagination';

// String managers
import { stringify } from 'qs';

// Classnames
import cn from 'classnames';

// Visual assets
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableFooter,
  Typography,
  Button
} from '@mui/material';

// Additional components
import Card from '../../components/animated-card'; // The exceled parcels in which almost all features are based
import Loading from '../../components/loading'; // Displays an animated "loading" circle

// API acces
import useAPI from '../../hooks/use-api';

// Constants
import { BASE_PATH_PROJECTS, HOST_CONFIG } from '../../utils/constants';
// Auxiliar functions
import { parseLocationSearch } from '../../utils/auxiliar-functions';

// CSS styles
import style from './style.module.css';

// It is used to check if the user has the reduced motion setting active
import { SCREENSHOT_FILENAME } from '../../utils/constants';

// Set some default parameters
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const DEFAULT_SORTING = { field: 'added', direction: -1 };

// Set the database fields to be queried by sorting options
const SORTING_ACTUAL_FIELDS = {
    accession: 'accession',
    name: 'metadata.NAME',
    added: '_id',
    updateDate: 'updateDate',
}

// Get the options field from the host configuration e.g. collections
const optionsField = HOST_CONFIG.optionsField;

// Component to handle sorting state
const parseSorting = search => {
    // -1 for descending, 1 for ascending
    const sorting = search
        ? { field: search.sortField, direction: search.sortDirection }
        : DEFAULT_SORTING
    // Set the parsed query parameter
    const actualField = SORTING_ACTUAL_FIELDS[sorting.field];
    const actualDirection = sorting.direction === 'asc' ? 1 : -1;
    // If we have query parameters then set the stringified API request argument
    if (actualField && actualDirection)
        // It must be JSON.stringify, not the qs.stringify
        sorting.query = JSON.stringify({ [actualField]: actualDirection })    
    return sorting;
};

// This component relies in the location search (the URL) to set the API query
// However we may force an additional URL-hidden unavoidable query
const ProjectBrowser = ({ internalQuery }) => {
    // Get the location and the history
    const location = useLocation();
    const history = useNavigate();

    // Parse the location search, including all current query parameters
    const search = useMemo(() => parseLocationSearch(location.search), [location.search]);
    // Parse the sorting parameters according to search values
    const sorting = parseSorting(search);

    // Convert the specified object back to a single encoded string for the query
    const searchString = useMemo(() => {
        const searchParameters = {
            search: search.search,
            query: search.query,
            ref: search.ref,
            countMds: 'true',
        }
        if (sorting) searchParameters.sort = sorting.query;
        if (search.page) searchParameters.page = search.page;
        if (search.limit) searchParameters.limit = search.limit;
        // DANI: Esto habría que mirar de hacerlo vía query, porque este sistema es viejo y redundante
        if (search.option && search.option !== 'All results')
            searchParameters.filter = `${optionsField}+*${search.option}`;
        // If there is an internal query then add it here
        if (internalQuery)
            if (search.query) {
                const parsedQuery = JSON.parse(searchParameters.query)
                const extendedQuery = Object.assign(parsedQuery, internalQuery);
                search.query = JSON.stringify(extendedQuery);
            }
            else search.query = JSON.stringify(internalQuery);
        return stringify(searchParameters);
    }, [search, sorting, internalQuery]);


    // Unified sort handler for both dropdown changes and column header clicks
    const handleSort = useCallback((field, direction) => {
        history({
            ...location,
            search: stringify({
                ...search,
                sortField: field,
                sortDirection: direction
            }),
        });
    }, [history, location, search]);

    // Save the previous query payload
    // It is rendered in low opacity when the new query payload is empty
    const previousPayload = useRef(null);

    // Projects data from the API
    const queryUrl = `${BASE_PATH_PROJECTS}?${searchString}`;
    const { loading: queryLoading, payload: queryPayload, error: queryError } = useAPI(queryUrl);

    // While loading
    // Code above is runned multiple times (around 5) each time the browser is loaded
    if (queryLoading && !previousPayload.current) return <Loading />;

    // When error
    // This usually happens when the API does not work properly
    if (queryError) return queryError.toString();

    // Define the results for the final render since it won't support 'null's
    let results;
    let matchCount = 0;
    let mdCount = 0;
    if (queryPayload) {
        results = queryPayload.projects;
        matchCount = queryPayload.filteredCount;
        mdCount = queryPayload.totalMdsCount;  
        previousPayload.current = queryPayload;
    } else if (previousPayload.current) {
        results = previousPayload.current.projects;
        matchCount = previousPayload.current.filteredCount;
        mdCount = previousPayload.current.totalMdsCount;  
    } else results = [];

    // Set the screenshot URLs for the API
    const screenshotsUrls = results.map(
        project => `${BASE_PATH_PROJECTS}/${project.identifier}/files/${SCREENSHOT_FILENAME}`
    );

    // Set handlers for the header sorters
    const onClickHeaderSorter = field => {
        // If this is a new sorting parameter then set the default direction as descendent
        // If this is the same sorting parameter then simply change the direction
        handleSort(field, sorting.field === field && sorting.direction === 'desc' ? 'asc' : 'desc' )
    }

    // When success
    return (

        <div>
            {/* Render a 'no results' card when there are no results for the last search */}
            {!queryLoading && !queryPayload ? (
            <Card className={style['no-results-card']}>
                <Typography variant="h5" className={style['no-results-text']}>
                No results were found
                </Typography>
            </Card>
            ) : []}

            <Table>
            {/*className={cn({ [style['invalid-results']]: !queryPayload })} */}
            {/* Table head with the names of each colum */}
            <TableHead className={style['table-head']}>
                <Pagination
                matchCount={matchCount}
                extraCount={mdCount}
                extraLabel="MDs"
                itemLabel="projects"
                search={search}
                location={location}
                history={history}
                DEFAULT_LIMIT={DEFAULT_LIMIT}
                DEFAULT_PAGE={DEFAULT_PAGE}
                />
                <TableRow>
                <TableCell className={style.center}>accession
                    <Button className={style.sort} onClick={() => onClickHeaderSorter('accession')}>
                    {sorting.field === 'accession' ? (sorting.direction === 'asc' ? "▲" : "▼") : "⋮"}
                    </Button>
                </TableCell>
                <TableCell className={style.center}>name
                    <Button className={style.sort} onClick={() => onClickHeaderSorter('name')}>
                    {sorting.field === 'name' ? (sorting.direction === 'asc' ? "▲" : "▼") : "⋮"}
                    </Button>
                </TableCell>
                <TableCell className={style.center}>preview</TableCell>
                <TableCell className={style.center}>analyses</TableCell>
                </TableRow>
            </TableHead>
            {/* Table body with the content, which is defined above in the Row constant */}
            {/* When the search has no results the table gets an opacity of 0.25 */}
            <TableBody
                className={queryPayload
                ? cn(style['table-body'])
                : cn(style['table-body'], style['invalid-results'])
                }
            >
                {/* Create a row for each project in the query payload*/}
                {results.map((project, index) => (
                <Row
                    // Load the propierties (inputs) that the class "Row" is expecting
                    projectData={project} // Load identifier, accession, published, pdbInfo and analyses
                    highlight={search.search} // Load the highlight
                    index={index} // Load the index
                    previewUrl={screenshotsUrls[index]}
                    key={index} // Add a key for react to do not complain
                />
                ))}
            </TableBody>
            <TableFooter>
                <Pagination
                    matchCount={matchCount}
                    extraCount={mdCount}
                    extraLabel="MDs"
                    itemLabel="projects"
                    search={search}
                    location={location}
                    history={history}
                    DEFAULT_LIMIT={DEFAULT_LIMIT}
                    DEFAULT_PAGE={DEFAULT_PAGE}
                />
            </TableFooter>
            </Table>
        </div>
    );
}

export default ProjectBrowser;