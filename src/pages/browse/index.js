// React logic
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CustomSearch from '../custom-search';

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
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Button
} from '@mui/material';

import LazyImg from '../../components/lazy-img';

// Additional components
import Card from '../../components/animated-card'; // The exceled parcels in which almost all features are based
import Highlight from '../../components/highlight'; // Used to underline text
import Loading from '../../components/loading'; // Displays an animated "loading" circle

// API acces
import useAPI from '../../hooks/use-api';

// Constants
import {
  BASE_PATH_PROJECTS,
  HOST_CONFIG,
  NICE_NAMES,
} from '../../utils/constants';

// CSS styles
import style from './style.module.css';

// It is used to check if the user has the reduced motion setting active
import reducedMotion from '../../utils/reduced-motion';
import { SCREENSHOT_FILENAME } from '../../utils/constants';
// Project manager
import { Project } from '../../utils/project-manager';

// The search bar
import Search from'./search';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const na = 'Not available';
// Placeholder for when there is no option selected
const all = 'All results';

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

const Row = ({ projectData, highlight, index, previewUrl }) => {
  // Parse the project data using the project manager
  const project = new Project(projectData);
  // Harvest data from the project object
  const {
    identifier,
    accession,
    published,
    pdbInfo,
    metadata,
    mdCount,
    directions
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

  // In case we retrieve an errored entry
  if (project.error) return (
    <TableRow ref={ref} className={style['error-row']}>
      {/* accession */}
      <TableCell className={style.center}> {project.accession} </TableCell>
      {/* name */}
      <TableCell className={style.center}> {project.error} </TableCell>
      {/* groups */}
      <TableCell className={style.center}> - </TableCell>
      {/* analyses */}
      <TableCell className={style.center}> - </TableCell>
    </TableRow>
  );

  // Returns a table with multiple rows
  // The 3 first rows: accession, PDB accession and name are searchable. Search text is highlighted when found
  return (
    <TableRow
      ref={ref} // "ref" is a method from TableRow and many other rendered elements
      className={cn({ [style['not-published']]: !published })}
    >
      {/* accession */}
      <TableCell className={style.center}>
        <Link
          to={{
            pathname: `/id/${accession || identifier}/overview`,
            // We pass the selected project data so there is no need to query it again
            state: { projectData: project },
          }}
        >
          <Highlight highlight={highlight}>
            {accession || identifier}
            {!published && <div>(not published)</div>}
          </Highlight>
        </Link>
        {mdCount > 1 && <div className={style.small}>{`${mdCount} MDs`}</div>}
      </TableCell>
      {/* name */}
      <TableCell className={style.center}>
        <Highlight highlight={highlight}>
          {metadata && metadata.NAME
            ? metadata.NAME
            : pdbInfo && pdbInfo.compound
            ? pdbInfo.compound
            : na}
        </Highlight>
      </TableCell>
      {/* preview */}
      <TableCell className={style.center}>
        <LazyImg
          src={previewUrl}
          width="110"
          height="110"
          loading="lazy"
          alt={`Project preview`}
        />
      </TableCell>
      {/* analyses */}
      <TableCell className={style.center}>
        {Object.entries(directions)
          // Display only available directions
          .filter(([direction, available]) => available)
          // For each direction create a clickable button which links to the direction route
          .map(([direction, available]) => (
            <Chip
              key={direction}
              clickable
              className={style.analysis}
              component={Link}
              to={{
                pathname: `/id/${accession || identifier}/${direction}`,
                // We pass the selected project data so there is no need to query it again
                state: { projectData: project },
              }}
              label={NICE_NAMES.get(direction) || direction}
              variant="outlined"
            />
          ))}
      </TableCell>
      {/* date */}
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

  // State of the selected option
  const [ selectedOption, setSelectedOption ] = useState(search.option || all);
  // State for the sort direction
  const [sortConfig, setSortConfig] = useState({ field: 'added', direction: -1 }); // -1 for descending, 1 for ascending
  // State for the selected sort option and direction combined
  const [selectedSortOption, setSelectedSortOption] = useState(
    search.sortField && search.sortDirection 
      ? `${search.sortField}-${search.sortDirection}` 
      : 'added-desc'
  );

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

  // Handle when user clicks on the option selector
  const handleChange = useCallback(
    ({ target: { value } }) => {
      // Update the history (which does not rerender the page)
      history({
        ...location,
        search: stringify({
          search: search.search,
          query: search.query,
          // Do not keep the page
          // Thus if option is changed then the page is reset
          option: value && value !== all ? value : undefined,
        }),
      });
      // Update the actual value thus rerendering the page
      setSelectedOption(value);
    }, [location, search, setSelectedOption]
  );

  // Handle combined sort option and direction change
  const handleSortOptionChange = useCallback(({ target: { value } }) => {
    setSelectedSortOption(value);
    
    const selectedOption = sortOptions.find(option => option.value === value);
    if (selectedOption) {
      applySorting(selectedOption.field, selectedOption.direction);
    }
  }, []);

  // Apply the sorting with field and direction
  const applySorting = (field, direction) => {
    // Convert direction string to number (asc = 1, desc = -1)
    const directionValue = direction === 'asc' ? 1 : -1;
    
    // Update the sort configuration
    setSortConfig({ field, direction: directionValue });
    
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
  };

  // Handler for toggling sort direction (used for column header clicks)
  const handleSort = (field) => {
    // If clicking the same field, toggle direction, otherwise use ascending
    const currentDirection = sortConfig.field === field ? 
      (sortConfig.direction === 1 ? 'desc' : 'asc') : 
      'asc';
    
    // Set the combined sort option
    setSelectedSortOption(`${field}-${currentDirection}`);
    
    applySorting(field, currentDirection);
  };

  // Get the options field from the host configuration
  const optionsField = HOST_CONFIG.optionsField;
  // Set the selected option filter
  const selectedOptionFilter = selectedOption && selectedOption !== all && `${optionsField}+*${selectedOption}`;

  // Convert the specified object back to a single encoded string
  const searchString = stringify({
    search: search.search,
    query: search.query,
    ref: search.ref,
    page: search.page || DEFAULT_PAGE,
    limit: search.limit || DEFAULT_LIMIT,
    filter: selectedOptionFilter,
    sort: JSON.stringify({ 
      [sortConfig.field === 'name' ? 'metadata.NAME' : 
       sortConfig.field === 'added' ? '_id' : 
       sortConfig.field]: sortConfig.direction 
    }),
  });

  // Scroll up when the page is changed
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [search.page]);

  // Initialize sort config from URL parameters
  useEffect(() => {
    if (search.sort) {
      try {
        const sortParam = JSON.parse(search.sort);
        const field = Object.keys(sortParam)[0];
        const direction = sortParam[field];
      
        // Map metadata.NAME back to 'name' for UI purposes
        let uiField = field;
        if (field === 'metadata.NAME') uiField = 'name';
        else if (field === '_id') uiField = 'added';
        else if (field === 'updateDate') uiField = 'updateDate';
        
        // Set direction string based on number value
        const dirString = direction === 1 ? 'asc' : 'desc';
        
        setSortConfig({ field: uiField, direction });
        setSelectedSortOption(`${search.sortField || uiField}-${search.sortDirection || dirString}`);
      } catch (error) {
        // Handle invalid sort parameter
        console.error("Invalid sort parameter", error);
      }
    }
  }, [search.sort]);

  // Save the previous query payload
  // It is rendered in low opacity when the new query payload is empty
  const previousPayload = useRef(null);

  // Options data from the API
  const optionsUrl = optionsField ? `${BASE_PATH_PROJECTS}/options?projection=${optionsField}` : null;
  const { payload: optionsPayload, error: optionsError } = useAPI(optionsUrl);

  // Add the all flag at the begining as default value
  // Remove null values since they are not queryable
  const availableOptions = useMemo(() => {
    let actualOptons = [];
    if (optionsPayload)
      actualOptons = Object.keys(optionsPayload[optionsField]).filter(key => key !== 'null');
    return [ all, ...actualOptons ];
  }, [optionsPayload]);

  // Projects data from the API
  const queryUrl = `${BASE_PATH_PROJECTS}?${searchString}`;
  const { loading: queryLoading, payload: queryPayload, error: queryError } = useAPI(queryUrl);

  // While loading
  // Code above is runned multiple times (around 5) each time the browser is loaded
  if (queryLoading && !previousPayload.current) return <Loading />;

  // When error
  // This usually happens when the API does not work properly
  if (queryError) return queryError.toString();
  if (optionsError) return optionsError.toString();

  // Download project screenshots
  // First set the URLs for the API
  
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
        <div  className={style['right-bar']}>
          <div className={style.search}>
            <Search/>
            {optionsField && <FormControl className={style.selector}>
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
            }   
            
            <FormControl className={style.selector}>
              <InputLabel>Sort by</InputLabel>
              <Select
                label="Sort by"
                value={selectedSortOption}
                onChange={handleSortOptionChange}
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
                <Button className={style.sort} onClick={() => handleSort('accession')}>
                  {sortConfig.field === 'accession' ? (sortConfig.direction === 1 ? "▲" : "▼") : "⋮"}
                </Button>
              </TableCell>
              <TableCell className={style.center}>name
                <Button className={style.sort} onClick={() => handleSort('name')}>
                  {sortConfig.field === 'name' ? (sortConfig.direction === 1 ? "▲" : "▼") : "⋮"}
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

export default Browse;
