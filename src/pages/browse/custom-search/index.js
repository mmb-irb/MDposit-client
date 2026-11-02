// React
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { parse } from 'qs';
import { isEqual } from 'lodash-es';

// Additional components
import Card from '../../../components/animated-card'; // The exceled parcels in which almost all features are based

// Visual assets
import {
  CardContent,
  TextField,
  FormControlLabel,
  Checkbox,
  Autocomplete,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

// CSS styles
import style from './style.module.css';

// Constants
import { BASE_PATH_PROJECTS, HOST_CONFIG } from '../../../utils/constants';
import { buildReturnQuery, formatOptionLabel, parseLocationSearch } from '../../../utils/auxiliar-functions';
import { buildFilter, parseFilter, getFiltersList, stringifyQuery } from '../../../utils/filters';
const SEARCH_DELAY = 500; // Half a second delay, same as in search component

// Hooks
import useAPI from '../../../hooks/use-api'; // API acces
import Loading from '../../../components/loading'; // Displays an animated "loading" circle

// Get the available search fields
const queryFields = HOST_CONFIG.queryFields;
const optionsField = HOST_CONFIG.optionsField;
const availableFields = HOST_CONFIG.availableFields;

// Set a regular expression for numeric values
const NUMERIC_REGEXP = new RegExp(/[0-9+-.,]*/);

// Parse the URL filters back to our internal query format
// Filters which are not built by this component are ignored
const parseUrlFilters = urlFilters => {
  const internalQuery = {};
  getFiltersList(urlFilters).forEach(filter => {
    const conditions = parseFilter(filter);
    // Filters with several conditions are never built by this component
    if (!conditions || conditions.length !== 1) return;
    const { path, operator, values } = conditions[0];
    const field = availableFields.find(f => f.path === path);
    if (!field) return;
    // Handle equality (for checkbox values)
    // Empty values stand for fields with no value
    if (operator === '==' && field.checkbox) {
      internalQuery[path] = values.map(value => value === null ? NA_TAG : value);
      return;
    }
    // The rest of components support one value only
    if (values.length !== 1 || values[0] === null) return;
    const value = values[0];
    // Handle string search
    if (operator === '~=' || operator === '==') {
      internalQuery[path] = value;
      return;
    }
    // Handle numeric ranges
    if (operator === '>' || operator === '<') {
      const rangeSide = operator === '>' ? 'min' : 'max';
      internalQuery[path] = { ...internalQuery[path], [rangeSide]: value };
    }
  });
  return internalQuery;
};

// Parse the query to an URL with the corresponding API filters
// Note that this function is called only at the end, when the search button is pressed
// The actual query is build below in the code
const parseQuery = (currentQuery, currentLocation) => {
  // Parse current URL parameters to preserve them
  const currentParams = parseLocationSearch(currentLocation.search);
  // Set a function to parse our queries to API filters
  const filters = [];
  let errors = 0;
  const parseAndAddFilter = ([key, value]) => {
    // Get the current field to know which is the expected type
    const currentField = availableFields.find(f => f.path === key);
    // In case it is a string search it means it comes from a string textfield
    if (typeof value === 'string') {
      if (value) filters.push(buildFilter(key, '~=', value));
      return;
    }
    // In case it has min or max propierties it comes from a number/date range pair of textfields
    // Numbers are passed as numbers while dates are passed as texts
    if (value.min || value.max) {
      const isNumeric = currentField.type !== 'date';
      for (const [ rangeSide, operator ] of [ ['min', '>'], ['max', '<'] ]) {
        const rangeValue = value[rangeSide];
        if (!rangeValue) continue;
        if (isNumeric && isNaN(+rangeValue)) return ++errors;
        filters.push(buildFilter(key, operator, isNumeric ? +rangeValue : rangeValue));
      }
      return;
    }
    if (!Array.isArray(value))
      throw new Error('Wrong ' + key + ' -> ' + value);
    // If value is not one of the previous it must be an array, so it comes from checkboxes
    // Several options are matched if any of them matches
    // The not defined option is an empty value, which stands for fields with no value
    filters.push(buildFilter(key, '==', value.map(v => v === NA_TAG ? null : v)));
  };

  // Parse the query
  Object.entries(currentQuery).forEach(entry => parseAndAddFilter(entry));

  // This may happen when a numeric textfield has text
  if (errors > 0) return;

  // Set the new filters while preserving the rest of parameters (e.g. sort parameters)
  const params = {
    ...currentParams,
    filter: filters.length > 0 ? filters : undefined,
  };

  // Return the query as a URL string with preserved parameters
  return '/browse?' + stringifyQuery(params);
};

// Check if an URL leads to the current location, regardless of how its parameters are encoded or sorted
export const isCurrentLocation = (url, currentLocation) => {
  const [pathname, search = ''] = url.split('?');
  if (pathname !== currentLocation.pathname) return false;
  return isEqual(
    parse(search),
    parse(currentLocation.search, { ignoreQueryPrefix: true }),
  );
};

// Set the tag to be shown for null and undefined values
const NA_TAG = 'Not defined';

// Advanced search page
const CustomSearch = () => {
  const theme = useTheme();

  // Get access to the history so wen can redirect the user later
  const history = useNavigate();

  // Get the location
  const location = useLocation();
  
  // Parse the filter parameter from URL
  const urlParams = parseLocationSearch(location.search);
  const urlFilters = urlParams.filter;
  // Get the browser searach
  const urlBrowserSearch = urlParams.search;
  // Get the "browser option", not to be confused with the options endpoint or its projections
  const urlBrowserOption = urlParams.option;
  
  // Initialize the query based on URL or empty object
  const initialQuery = parseUrlFilters(urlFilters);
  // Use URL search params as a dependency for state
  const [query, setQuery] = useState(initialQuery);
  // Track whether search was triggered by user action or URL change
  const isUserInitiatedSearchRef = useRef(false);

  // Reset query when URL changes
  useEffect(() => {
    setQuery(parseUrlFilters(urlFilters));
  }, [location.search]);

  // Make a function to parse the query once built and browse
  const parseAndSearch = () => {
    const browseURL = parseQuery(query, location);
    // The query is reset on every URL change, so navigating to the same URL would push a duplicate history entry
    if (isCurrentLocation(browseURL, location)) return;
    isUserInitiatedSearchRef.current = true; // Set the ref instead of state
    history(browseURL);
  };

  // Call the parse and search function after a delay time with no chnages in the query
  useEffect(() => {
    const timeout = setTimeout(parseAndSearch, SEARCH_DELAY);
    return () => clearTimeout(timeout);
  }, [query]);

  // Query all the available fields using the 'options' endpoint
  const returnQuery = buildReturnQuery(availableFields);

  // Build the API URL for the options requests
  // DANI: Se piden todas las options de golpe, lo cual no es muy eficiente y la API tarda 3 segundos aprox
  // DANI: Hemos decidido que este valor se guardará en la db y se actualizará periódicamente, cosa mucho más eficiente
  let optionsUrl = `${BASE_PATH_PROJECTS}/options?${returnQuery}`;
  // In case the user has searched some text in the browser
  if (urlBrowserSearch) {
    optionsUrl += '&' + stringifyQuery({ search: urlBrowserSearch });
  }
  // In case the user has selected a specific "browser option" we filter the query
  if (urlBrowserOption) {
    const browserOptionsField = HOST_CONFIG.optionsField;
    optionsUrl += '&' + stringifyQuery({ filter: buildFilter(browserOptionsField, '==', urlBrowserOption) });
  }
  const {
    loading: optionsLoading,
    payload: optionsPayload,
    error: optionsError
  } = useAPI(optionsUrl, { name: 'browse', cacheOn: true });

  // State to track expanded accordions
  const [expandedCategory, setExpandedCategory] = useState({});
  const [expandedFields, setExpandedFields] = useState({});

  // Initialize expanded state based on URL query
  const initializeExpandedState = (queryFields, query, defaultOpen = false) => {
    // Initialize category accordions as expanded
    const categoryState = Object.keys(queryFields).reduce((acc, category) => {
      acc[category] = true;
      return acc;
    }, {});
    // Initialize field accordions based on defaultOpen only (since query is empty)
    const fieldState = Object.values(queryFields).flat().reduce((acc, field) => {
      acc[field.path] = field.defaultOpen || (defaultOpen && field.path in query);
      return acc;
    }, {});
  
    return { categoryState, fieldState };
  };

  // Set initial expanded state based on URL query
  useEffect(() => {
    const { categoryState, fieldState } = initializeExpandedState(queryFields, query, true);
    setExpandedCategory(categoryState);
    setExpandedFields(fieldState);
  }, []);
  
  useEffect(() => {
    // Only reset accordions if URL was cleared externally (not by user action)
    // and there is no query or search options
    if (!urlFilters && !isUserInitiatedSearchRef.current && !location.search) {
      const { categoryState, fieldState } = initializeExpandedState(queryFields, query);
      setExpandedCategory(categoryState);
      setExpandedFields(fieldState);
    }
    // Reset the ref after handling the state update
    if (isUserInitiatedSearchRef.current) {
      isUserInitiatedSearchRef.current = false;
  }
  }, [location.search]);

  // Handle category accordion changes
  const handleCategoryChange = (category) => (event, isExpanded) => {
    setExpandedCategory({
      ...expandedCategory,
      [category]: isExpanded
    });
  };

  // Handle field accordion changes
  const handleFieldChange = (fieldPath) => (event, isExpanded) => {
    setExpandedFields({
      ...expandedFields,
      [fieldPath]: isExpanded
    });
  };
  // Stop here if any of the requests failed
  let noResults = false;
  if (optionsError) {
    if (optionsError.noResponse) noResults = true;
    else if (optionsError.response.status === 404) noResults = true;
    else return optionsError.toString();
  }

  // Helper function to update query state and trigger search
  const updateQueryValue = (fieldPath, value, options = {}) => {
    const { isArray = false, isRange = false, rangeSide = null } = options;
    
    if (isArray) {
      // Handle checkbox arrays
      if (!query[fieldPath]) {
        query[fieldPath] = [value];
      } else if (Array.isArray(query[fieldPath])) {
        const index = query[fieldPath].indexOf(value);
        if (index === -1) {
          query[fieldPath].push(value);
        } else {
          query[fieldPath].splice(index, 1);
          if (query[fieldPath].length === 0) {
            delete query[fieldPath];
          }
        }
      }
    } else if (isRange) {
      // Handle numeric ranges
      if (value === '') {
        if (!query[fieldPath]) return;
        if (query[fieldPath][rangeSide]) {
          delete query[fieldPath][rangeSide];
          if (Object.keys(query[fieldPath]).length === 0) {
            delete query[fieldPath];
          }
        }
      } else {
        if (!query[fieldPath]) {
          query[fieldPath] = { [rangeSide]: value };
        } else {
          query[fieldPath][rangeSide] = value;
        }
      }
    } else {
      // Handle simple string values
      if (value === '') {
        delete query[fieldPath];
      } else {
        query[fieldPath] = value;
      }
    }
    
    // Trigger state update and search
    setQuery({ ...query });
  };

  // Here is where queries are built by the user
  return (
    <Card className={style.tall}>
      <CardContent style={{ paddingLeft: '0' }}>
        <div className={style.advanced}>Use the <b>search</b> menu to create a specific query.
        Go to{' '} <a href="/#/advanced-search">advanced search</a> for a most complex query.
        </div>
        {Object.entries(queryFields).map(([category, fields], c) => {
          return (
            <Accordion 
              key={c} 
              expanded={!!expandedCategory[category]}
              onChange={handleCategoryChange(category)} 
              disableGutters={true} 
              className={style['category']}
            >
              <AccordionSummary 
                className={style.categorySummary}
              >
                <Typography variant='h6' >{category}</Typography>
              </AccordionSummary>
              <AccordionDetails className={style.section}>
                <div>
                  {fields.map((field, f) => {
                    if (field.path === optionsField) return null; // hide the one in OptionsFilter
                    // Hide a fields with no options
                    const emptyField = optionsPayload && field.options && Object.keys(optionsPayload[field.path]).length === 0;
                    return (
                      <Accordion 
                        key={f} 
                        className={style.accordion} 
                        disableGutters={true}
                        expanded={noResults === false && !!expandedFields[field.path]}
                        onChange={handleFieldChange(field.path)}
                        disabled={noResults || emptyField}
                      >
                        <AccordionSummary className={style.summary}>{field.name}</AccordionSummary>
                        <AccordionDetails>
                          {field.experimental && (
                            <p style={{ color: theme.vars.palette.error.main, fontSize: '0.8rem', margin: '0 0 6px' }}>
                              ⚠ This field is experimental. Results may be inaccurate.
                            </p>
                          )}
                          {(() => {
                            // Get the corresponding payload
                            if (optionsLoading) return <Loading />;
                            if (noResults) return;
                            // Save the current queries
                            const currentQuery = query;
                            // In case it is a field with options (i.e. input is specified through checkboxes)
                            if (field.options) {
                              const fieldData = optionsPayload[field.path];
                              // In case we have nulls or undefineds we merge them in a single 'Not defined' field
                              let notDefined = 0;
                              if (fieldData && fieldData.null) {
                                notDefined += fieldData.null;
                                delete fieldData.null;
                              }
                              if (!fieldData) return null;
                              // If the field values are set to be selectable as checkboxes
                              if (field.checkbox) {
                                // For each entry generate a checkbox
                                const entries = Object.entries(fieldData).sort(([aKey, aCount], [bKey, bCount]) => bCount - aCount);
                                return entries.map(([option, count], i) => {
                                  // Check if this option is selected from the URL query
                                  const isChecked = !!(currentQuery[field.path] && 
                                    Array.isArray(currentQuery[field.path]) && 
                                    currentQuery[field.path].includes(option));
                                  
                                  return (
                                    <FormControlLabel
                                      key={i}
                                      onChange={() => updateQueryValue(field.path, option, { isArray: true })}
                                      control={
                                        <Checkbox
                                          checked={isChecked}
                                          style={{ color: theme.vars.palette.text.secondary, padding: '4px 9px' }}
                                          inputProps={{ 'data-key': option }}
                                        />
                                      }
                                      label={`${formatOptionLabel(option)} (${count})`}
                                      style={{ color: theme.vars.palette.text.primary }}
                                    />
                                  );
                                });
                              }
                              else {
                                const options = Object.entries(fieldData).map(
                                  ([value, count]) => ({ label: value, count })
                                ).sort((a, b) => b.count - a.count);
                                
                                return (
                                  <div className={style.aligned}>
                                    <Autocomplete
                                      options={options}
                                      getOptionLabel={option => option.label}
                                      renderOption={(props, option) => <li {...props}>{option.label + ' (' + option.count + ')'}</li>}
                                      sx={{ width: '50vh' }}
                                      clearOnBlur={false}
                                      value={currentQuery[field.path] ? 
                                        options.find(opt => opt.label === currentQuery[field.path]) || null : 
                                        null}
                                      renderInput={(params) => 
                                        <TextField
                                          {...params}
                                          title={'Type here the value for the specified field'}
                                          placeholder={'e.g. ' + field.example}
                                          className={style.spaced}
                                        />}
                                      onChange={(event, newValue) => {
                                        const value = newValue ? newValue.label : '';
                                        updateQueryValue(field.path, value);
                                      }}
                                    />
                                  </div>
                                );
                              }
                            }
                            // In case it is a field without options (i.e. input is specified through a textfield)
                            else {
                              // If the field is a string we show a unique textfield
                              if (field.type === 'string') {
                                return (
                                  <div className={style.aligned}>
                                    <TextField
                                      title={'Type here the value for the specified field'}
                                      value={currentQuery[field.path] || ''}
                                      onChange={({ target: { value } }) => updateQueryValue(field.path, value)}
                                      onKeyPress={event => {
                                        if (event.key === 'Enter') {
                                          updateQueryValue(field.path, event.target.value);
                                        }
                                      }}
                                      placeholder={'e.g. ' + field.example}
                                      inputProps={{ inputMode: 'text' }}
                                      className={style.spaced}
                                    />
                                  </div>
                                );
                              }
                              // Otherwise it must be a number, since booleans will always be in options
                              // Then show two textfields: one for the minimum and one for the maximum
                              else if (field.type === 'int' || field.type === 'float') {
                                // Get min and max values from query if available
                                const minValue = currentQuery[field.path] && currentQuery[field.path].min || '';
                                const maxValue = currentQuery[field.path] && currentQuery[field.path].max || '';
                                
                                return (<>
                                  <div className={style.aligned}>
                                    <span style={{padding: '3px'}}>Greater than</span>
                                    <TextField
                                      title={'Type here the value for the specified field'}
                                      value={minValue}
                                      onChange={({ target: { value } }) => 
                                        updateQueryValue(field.path, value, { isRange: true, rangeSide: 'min' })}
                                      onKeyPress={event => {
                                        if (event.key === 'Enter') {
                                          updateQueryValue(field.path, event.target.value, 
                                            { isRange: true, rangeSide: 'min'}
                                          );
                                        }
                                      }}
                                      placeholder={'> e.g. ' + field.example}
                                      inputProps={{
                                        inputMode: 'numeric',
                                        pattern: NUMERIC_REGEXP,
                                      }}
                                      className={style.spaced}
                                      size="small"
                                    />
                                  </div>
                                  <div className={style.aligned}>
                                    <span style={{padding: '3px'}}>Lower than</span>
                                    <TextField
                                      title={'Type here the value for the specified field'}
                                      value={maxValue}
                                      onChange={({ target: { value } }) => 
                                        updateQueryValue(field.path, value, { isRange: true, rangeSide: 'max' })}
                                      onKeyPress={event => {
                                        if (event.key === 'Enter') {
                                          updateQueryValue(field.path, event.target.value, 
                                            {isRange: true, rangeSide: 'max'}
                                          );
                                        }
                                      }}
                                      placeholder={'< e.g. ' + field.example}
                                      inputProps={{
                                        inputMode: 'numeric',
                                        pattern: NUMERIC_REGEXP,
                                      }}
                                      className={style.spaced}
                                      size="small"
                                    />
                                  </div>
                                </>);
                              }
                              // If the field is a date then offer a specialized selector
                              else if (field.type === 'date') {
                                return (<>
                                  <div className={style.aligned}>
                                    <span style={{padding: '3px'}}>From</span>
                                    <TextField
                                      type="date"
                                      value={currentQuery[field.path]?.min || ''}
                                      onChange={({ target: { value } }) =>
                                        updateQueryValue(field.path, value, { isRange: true, rangeSide: 'min' })}
                                      size="small"
                                      className={style.spaced}
                                    />
                                  </div>
                                  <div className={style.aligned}>
                                    <span style={{padding: '3px'}}>To</span>
                                    <TextField
                                      type="date"
                                      value={currentQuery[field.path]?.max || ''}
                                      onChange={({ target: { value } }) =>
                                        updateQueryValue(field.path, value, { isRange: true, rangeSide: 'max' })}
                                      size="small"
                                      className={style.spaced}
                                    />
                                  </div>
                                </>);
                              }
                              else throw new Error(`Unknown field type ${field.type}`);
                            }
                          })()}
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </div>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default CustomSearch;
