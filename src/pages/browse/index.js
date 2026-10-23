// React logic
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import { useLocation, useNavigate } from 'react-router';
import CustomSearch from './custom-search';

// String managers
import { stringify } from 'qs';

// Visual assets
import {
  CardContent,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
} from '@mui/material';

// Additional components
import Card from '../../components/animated-card'; // The exceled parcels in which almost all features are based
// The main table including all project results
import ProjectBrowser from 'src/components/project-browser';

// API acces
import useAPI from '../../hooks/use-api';

// Constants
import {
  BASE_VERSIONED_PATH,
  BASE_PATH_PROJECTS,
  HOST_CONFIG,
} from '../../utils/constants';

// CSS styles
import style from './style.module.css';

// Import auxiliar functions
import { parseLocationSearch } from '../../utils/auxiliar-functions';

// The search bar
import SearchBar from '../../components/search-bar';

// Available sort options with both ascending and descending for each field
const SORT_OPTIONS = {
  'Accession ▼': { field: 'accession', direction: 'desc' },
  'Accession ▲': { field: 'accession', direction: 'asc' },
  'Name ▼': { field: 'name', direction: 'desc' },
  'Name ▲': { field: 'name', direction: 'asc' },
  'Added date ▼': { field: 'added', direction: 'desc' },
  'Added date ▲': { field: 'added', direction: 'asc' },
  'Update date ▼': { field: 'updateDate', direction: 'desc' },
  'Update date ▲': { field: 'updateDate', direction: 'asc' },
};

// Component to handle sorting state
const parseSorting = search => {
    if (!search) return { label: '' };
    if (!search.sortField || !search.sortDirection) return { label: '' }
    const sorting = { field: search.sortField, direction: search.sortDirection };
    // Find the label which corresponds to the current sorting
    sorting.label = Object.keys(SORT_OPTIONS).find(key => {
      const option = SORT_OPTIONS[key];
      return option.field == sorting.field && option.direction == sorting.direction;
    })
    return sorting;
};

// Placeholder for when there is no option selected
const ALL = 'All results';

// Get the options field from the host configuration e.g. collections
const optionsField = HOST_CONFIG.optionsField;

// Options Filter Component
const OptionsFilter = ({ location, search, history }) => {
  // State of the selected option
  const [selectedOption, setSelectedOption] = useState(search.option || ALL);

  // Options data from the API
  const optionsUrl = optionsField ? `${BASE_PATH_PROJECTS}/options?projection=${optionsField}` : null;
  const { payload: optionsPayload, error: optionsError } = useAPI(optionsUrl);

  // If the options field is metadata collections (which is usual) then get collecion names
  // DANI: De momento estamos lejos de llegar a las 100, en un futuro habría que paginar
  // DANI: Cuando este día llegue igual ya no merece la pena que la option sea collections
  const referencesUrl = optionsField === 'metadata.COLLECTIONS' ?
    `${BASE_VERSIONED_PATH}/references/collections?limit=100` : null;
  const { payload: referencesPayload, error: referencesError } = useAPI(referencesUrl);
  if (referencesPayload) {
    const collectionNames = {};
    referencesPayload.references.forEach(reference => {
      collectionNames[reference.id] = reference.name;
    });
    Object.assign(HOST_CONFIG.optionsNiceNames, collectionNames);
  }

  // Add the all flag at the beginning as default value
  // Remove null values since they are not queryable
  const availableOptions = useMemo(() => {
    let actualOptions = [];
    if (optionsPayload)
      actualOptions = Object.keys(optionsPayload[optionsField]).filter(key => key !== 'null');
    return [ALL, ...actualOptions];
  }, [optionsPayload]);

  // Sync selectedOption with the URL (search.option)
  useEffect(() => {
    setSelectedOption(search.option || ALL);
  }, [search.option]);

  // Handle when user clicks on the option selector
  const handleChange = useCallback(
    ({ target: { value } }) => {
      // Set the search parameters
      const searchParameters = {
        ...search,
        option: value && value !== ALL ? value : undefined,
      }
      // Thus if option is changed then the page is reset
      if (searchParameters.page !== undefined)
        delete searchParameters.page;
      // Update the history (which does not rerender the page)
      history({
        ...location,
        search: stringify({
          ...search,
          // Thus if option is changed then the page is reset
          option: value && value !== ALL ? value : undefined,
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
        value={selectedOption !== ALL ? selectedOption : ''}
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

// Sorter Component
const Sorter = ({ history, location, search }) => {
  // Parse the sorting parameters according to search values
  const sorting = parseSorting(search);
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
  // Render the component
  return (
    <FormControl className={style.selector}>
      <InputLabel>Sort by</InputLabel>
      <Select
        label="Sort by"
        value={sorting.label}
        onChange={({ target: { value } }) => {
          const option = SORT_OPTIONS[value];
          handleSort(option.field, option.direction);
        }}
        className={style.fillheight}
      >
        {Object.keys(SORT_OPTIONS).map(optionLabel => (
          <MenuItem key={optionLabel} value={optionLabel}>
            {optionLabel}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

const Browse = () => {
  // Get the location and the history
  const location = useLocation();
  const history = useNavigate();
  // Parse the location search, including all current query parameters
  const search = useMemo(() => parseLocationSearch(location.search), [location.search]);
  // When success
  return (
    <Card>
      <CardContent className={style.browser}>
        <div className={style['left-bar']}>
          <CustomSearch /> {/* Add the CustomSearch component */}
        </div>
        <div className={style['right-bar']}>
          <div className={style.search}>
            <SearchBar />
            <OptionsFilter location={location} search={search} history={history} />
            <Sorter location={location} search={search} history={history}/>
          </div>
          <ProjectBrowser/>
        </div>
      </CardContent>
    </Card>
  );
};

Browse.displayName = 'Browse';
export default Browse;
