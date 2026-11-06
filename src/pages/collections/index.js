// React logic
import React, { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import Row from './row';
import Pagination from '../../components/pagination';

// Visual assets
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableFooter,
  Typography,
} from '@mui/material';

// Additional components
import Card from '../../components/animated-card'; // The exceled parcels in which almost all features are based
import Loading from '../../components/loading'; // Displays an animated "loading" circle
import SearchBar from 'src/components/search-bar';

// API acces
import useAPI from '../../hooks/use-api';

// Constants
import { BASE_VERSIONED_PATH } from '../../utils/constants';
// Auxiliar functions
import { parseLocationSearch } from '../../utils/auxiliar-functions';
import { buildFilter, stringifyQuery } from '../../utils/filters';
// Reference handler
import { Reference } from 'src/utils/reference-manager';
// String managers

// Classnames
import cn from 'classnames';
// CSS styles
import style from './style.module.css';

// Set some default parameters
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

// This component relies in the location search (the URL) to set the API query
// However we may force an additional URL-hidden unavoidable query
const CollectionBrowser = () => {
    // Get the location and the history
    const location = useLocation();
    const history = useNavigate();

    // Parse the location search, including all current query parameters
    const search = useMemo(() => parseLocationSearch(location.search), [location.search]);

    // Convert the specified object back to a single encoded string for the query
    const searchString = useMemo(() => {
        const searchParameters = {}
        if (search.page) searchParameters.page = search.page;
        if (search.limit) searchParameters.limit = search.limit;    
        if (search.search) searchParameters.filter = buildFilter('references.collections.name', '~=', search.search);
        return stringifyQuery(searchParameters);
    }, [search]);

    // Reference data from the API
    const collectionsUrl = `${BASE_VERSIONED_PATH}/references/collections?${searchString}`;
    const {
        loading: collectionsLoading,
        payload: collectionsPayload,
        error: collectionsError
    } = useAPI(collectionsUrl);

    // Set a reference for the collection browser component
    const componentRef = useRef();
    // Smoothly scroll up when the page is changed
    useEffect(() => {
        const component = componentRef.current;
        if (!component) return;
        window.scrollTo({ top: component.offsetTop, behavior: 'smooth' });
    }, [search.page]);

    // Save the previous query payload
    // It is rendered in low opacity when the new query payload is empty
    const previousPayload = useRef(null);

    // Define the results for the final render since it won't support 'null's
    let results;
    let matchCount = 0;
    if (collectionsPayload) {
        results = collectionsPayload.references;
        matchCount = collectionsPayload.referencesCount;
        previousPayload.current = collectionsPayload;
    } else if (previousPayload.current) {
        results = previousPayload.current.references;
        matchCount = previousPayload.current.referencesCount;
    } else results = [];

    // Note that the API answers a search with no matches with an empty list, not with an error
    const noResults = !collectionsPayload || collectionsPayload.references.length === 0;

    // Use the reference handler to parse the results
    const parsedResults = useMemo(() => {
        return results.map(ref => new Reference('collections', ref));
    }, [results]);

    // While loading
    // Code above is runned multiple times (around 5) each time the browser is loaded
    if (collectionsLoading) return <Loading />;

    // When error
    // This usually happens when the API does not work properly
    if (collectionsError) return collectionsError.toString();

    // When success
    return (

        <div ref={componentRef}>
            <SearchBar/>
            {/* Render a 'no results' card when there are no results for the last search */}
            {noResults ? (
            <Card className={style['no-results-card']} style={{ marginTop: '1em' }}>
                <Typography variant="h5" className={style['no-results-text']}>
                No results were found
                </Typography>
            </Card>
            ) : []}

            <Table style={{ marginTop: '1em' }}>
                {/* Table head with the names of each colum */}
                <TableHead className={style['table-head']}>
                    <TableRow>
                        <TableCell className={style.center} style={{ minWidth: '15%' }}>name</TableCell>
                        <TableCell className={style.center}>summary</TableCell>
                        <TableCell className={style.center}>system keywords</TableCell>
                        <TableCell className={style.center}>logo</TableCell>
                        <TableCell className={style.center}>size</TableCell>
                    </TableRow>
                </TableHead>
                {/* Table body with the content, which is defined above in the Row constant */}
                {/* When the search has no results the table gets an opacity of 0.25 */}
                <TableBody
                    className={noResults
                    ? cn(style['table-body'], style['invalid-results'])
                    : cn(style['table-body'])
                    }
                >
                    {/* Create a row for each reference in the query payload*/}
                    {parsedResults.map((reference, index) =>
                        <Row
                            // Load the propierties (inputs) that the class "Row" is expecting
                            data={reference} // Load reference data (id, name, description, image URL, ...)
                            highlight={search.search} // Load the highlight
                            index={index} // Load the index
                            key={index} // Add a key for react to do not complain
                        />
                    )}
                </TableBody>
                <TableFooter>
                    <Pagination
                        matchCount={matchCount}
                        itemLabel="references"
                        colSpan={5}
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

export default CollectionBrowser;