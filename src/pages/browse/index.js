// React logic
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CustomSearch from './custom-search';
import Row from './row';

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
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Button
} from '@mui/material';

// Additional components
import Card from '../../components/animated-card'; // The exceled parcels in which almost all features are based
import Loading from '../../components/loading'; // Displays an animated "loading" circle

// API acces
import useAPI from '../../hooks/use-api';

// Constants
import {
  BASE_PATH_PROJECTS,
  HOST_CONFIG,
} from '../../utils/constants';

// CSS styles
import style from './style.module.css';

// It is used to check if the user has the reduced motion setting active
import { SCREENSHOT_FILENAME } from '../../utils/constants';

// The search bar
import Search from'./search';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

// Placeholder for when there is no option selected
const all = 'All results';

// Get the options field from the host configuration e.g. collections
const optionsField = HOST_CONFIG.optionsField;

// Define non-changing props used by the table footer
const rowsPerPageOptions = [5, 10, 25, 50];
const backIconButtonProps = { title: 'Previous page' };
const nextIconButtonProps = { title: 'Next page' };

// Options Filter Component
const OptionsFilter = ({ location, search, history }) => {
  // State of the selected option
  const [ selectedOption, setSelectedOption ] = useState(search.option || all);

  // Options data from the API
  const optionsUrl = optionsField ? `${BASE_PATH_PROJECTS}/options?projection=${optionsField}` : null;
  const { payload: optionsPayload, error: optionsError } = useAPI(optionsUrl);

  // Add the all flag at the beginning as default value
  // Remove null values since they are not queryable
  const availableOptions = useMemo(() => {
    let actualOptions = [];
    if (optionsPayload)
      actualOptions = Object.keys(optionsPayload[optionsField]).filter(key => key !== 'null');
    return [ all, ...actualOptions ];
  }, [optionsPayload]);

  // Sync selectedOption with the URL (search.option)
  useEffect(() => {
    setSelectedOption(search.option || all);
  }, [search.option]);

  // Handle when user clicks on the option selector
  const handleChange = useCallback(
    ({ target: { value } }) => {
      // Update the history (which does not rerender the page)
      history({
        ...location,
        search: stringify({
          ...search,
          // Do not keep the page
          page: DEFAULT_PAGE,
          // Thus if option is changed then the page is reset
          option: value && value !== all ? value : undefined,
        }),
      });
      // Update the actual value thus rerendering the page
      setSelectedOption(value);
    }, [location, search, setSelectedOption]
  );

  if (!optionsField) return null;
  if (optionsError) return optionsError.toString();

  return (
    <FormControl className={style.selector}>
      <InputLabel>{HOST_CONFIG.optionsLabel}</InputLabel>
      <Select
        label={HOST_CONFIG.optionsLabel}
        value={selectedOption !== all ? selectedOption : ''}
        onChange={handleChange}
        className={style.fillheight}
      >
        {availableOptions.map((value, i) => (
          <MenuItem key={i} value={value}>
            {HOST_CONFIG.optionsNiceNames[value] || value}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

// Component to handle sorting state
const SortLogic = ({ search, location, history }) => {
    // Combined state for sort configuration
    const [sortState, setSortState] = useState(() => {
      // Initialize from URL if available
      if (search.sortField && search.sortDirection) {
        return {
          field: search.sortField,
          direction: search.sortDirection === 'asc' ? 1 : -1, //-1 for descending, 1 for ascending
          option: `${search.sortField}-${search.sortDirection}`
        };
      }
      // Default sort state
      return { field: 'added', direction: -1, option: 'added-desc'};
    });
  
    // Syncronize search and sortState
    useEffect(() => {
      if (search.sortField && search.sortDirection) {
        setSortState({
          field: search.sortField,
          direction: search.sortDirection === 'asc' ? 1 : -1,
          option: `${search.sortField}-${search.sortDirection}`,
        });
      } else {
        // Reset to default sort state if no sort parameters are in the URL
        setSortState({ field: 'added', direction: -1, option: 'added-desc' });
      }
    }, [search]);
  
    // Available sort options with both ascending and descending for each field
    const sortOptions = [
      { value: 'accession-desc', label: 'Accession ▼', field: 'accession', direction: 'desc' },
      { value: 'accession-asc', label: 'Accession ▲', field: 'accession', direction: 'asc' },
      { value: 'name-desc', label: 'Name ▼', field: 'name', direction: 'desc' },
      { value: 'name-asc', label: 'Name ▲', field: 'name', direction: 'asc' },
      { value: 'added-desc', label: 'Added Date ▼', field: 'added', direction: 'desc' },
      { value: 'added-asc', label: 'Added Date ▲', field: 'added', direction: 'asc' },
      { value: 'updateDate-desc', label: 'Update Date ▼', field: 'updateDate', direction: 'desc' },
      { value: 'updateDate-asc', label: 'Update Date ▲', field: 'updateDate', direction: 'asc' },
    ];
  
    // Unified sort handler for both dropdown changes and column header clicks
    const handleSort = useCallback((fieldOrValue, fromColumnHeader = false) => {
      let field, direction;
      
      if (fromColumnHeader) {
        // If coming from column header, toggle direction for same field or use ascending for new field
        field = fieldOrValue;
        direction = sortState.field === field ? 
          (sortState.direction === 1 ? 'desc' : 'asc') : 
          'asc';
      } else {
        // If coming from dropdown, get field and direction from the selected option
        const selectedOption = sortOptions.find(option => option.value === fieldOrValue);
        if (!selectedOption) return;
        
        field = selectedOption.field;
        direction = selectedOption.direction;
      }
      
      // Convert direction string to number (asc = 1, desc = -1)
      const directionValue = direction === 'asc' ? 1 : -1;
      // Update the combined sort state
      const newSortState = { field, direction: directionValue, option: `${field}-${direction}` };
  
      setSortState(newSortState);
      
      // Use metadata.NAME for name sorting, added for date sorting, updateDate for update date sorting
      let sortField = field;
      if (field === 'name') sortField = 'metadata.NAME';
      else if (field === 'added') sortField = '_id';
      else if (field === 'updateDate') sortField = 'updateDate';
      
      history({
        ...location,
        search: stringify({
          ...search,
          sort: JSON.stringify({ [sortField]: directionValue }),
          sortField: field,
          sortDirection: direction
        }),
      });
    }, [sortOptions, location, search, sortState, history]);

  return { sortState, sortOptions, handleSort };
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
  const search = useMemo(() => {
    const decoded = decodeURIComponent(location.search);
    return parse(decoded, {
      ignoreQueryPrefix: true,
      decoder: c => c,
    });
  }, [location.search]);
  // State for sorting
  const { sortState, sortOptions, handleSort } = SortLogic({ search, location, history });

  // Convert the specified object back to a single encoded string for the query
  const searchString = useMemo(() => 
    stringify({
      search: search.search,
      query: search.query,
      ref: search.ref,
      page: search.page || DEFAULT_PAGE,
      limit: search.limit || DEFAULT_LIMIT,
      filter: search.option && search.option !== all && `${optionsField}+*${search.option}`,
      sort: JSON.stringify({ 
        [sortState.field === 'name' ? 'metadata.NAME' : 
         sortState.field === 'added' ? '_id' : 
         sortState.field === 'updateDate' ? 'updateDate' : 
         sortState.field]: sortState.direction 
      }),
    }), 
    [search, sortState]
  );

  // Scroll up when the page is changed
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [search.page]);
  
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
  if (queryPayload) {
    results = queryPayload.projects;
    matchCount = queryPayload.filteredCount;
    previousPayload.current = queryPayload;
  } else if (previousPayload.current) {
    results = previousPayload.current.projects;
    matchCount = previousPayload.current.filteredCount;
  } else results = [];

  // Set the screenshot URLs for the API
  const screenshotsUrls = results.map(
    project => `${BASE_PATH_PROJECTS}/${project.identifier}/files/${SCREENSHOT_FILENAME}`
  );

  // When success
  return (
    <Card>
      <CardContent className={style.browser}>
        <div className={style['left-bar']}>
          <CustomSearch /> {/* Add the CustomSearch component */}
        </div>
        <div className={style['right-bar']}>
          <div className={style.search}>
            <Search/>
            <OptionsFilter location={location} search={search} history={history} />
            <FormControl className={style.selector}>
              <InputLabel>Sort by</InputLabel>
              <Select
                label="Sort by"
                value={sortState.option}
                onChange={({ target: { value } }) => handleSort(value)}
                className={style.fillheight}
              >
                {sortOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
          
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
            <TableRow>
              <TableCell className={style.center}>accession
                <Button className={style.sort} onClick={() => handleSort('accession', true)}>
                  {sortState.field === 'accession' ? (sortState.direction === 1 ? "▲" : "▼") : "⋮"}
                </Button>
              </TableCell>
              <TableCell className={style.center}>name
                <Button className={style.sort} onClick={() => handleSort('name', true)}>
                  {sortState.field === 'name' ? (sortState.direction === 1 ? "▲" : "▼") : "⋮"}
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
                      option: search.option,
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
                      option: search.option,
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
        </div>
      </CardContent>
    </Card>
  );
};

Browse.displayName = 'Browse';
export default Browse;
