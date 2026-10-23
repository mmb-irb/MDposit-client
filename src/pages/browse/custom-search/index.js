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

// CSS styles
import style from './style.module.css';

// Constants
import { BASE_PATH_PROJECTS, HOST_CONFIG } from '../../../utils/constants';
import { buildProjectionQuery, formatOptionLabel } from '../../../utils/auxiliar-functions';
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

// Escape all regex sensible characters
const escapeRegExp = input => {
  return input.replace(/[-[/\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

// Parse the URL query back to our internal query format
const parseUrlQuery = (urlQuery) => {
  try {
    if (!urlQuery) return {};
    
    const parsedQuery = JSON.parse(urlQuery);
    const internalQuery = {};

    // Handle direct field queries (string search with regex)
    Object.entries(parsedQuery).forEach(([key, value]) => {
      if (key === '$and' || key === '$or') return;

      const field = availableFields.find(f => f.path === key);
      if (!field) return;

      // Handle regex string search
      if (value.$regex) {
        internalQuery[key] = value.$regex.replace(/\\/g, '');
        return;
      }

      // Handle numeric ranges
      if (value.$gt !== undefined || value.$lt !== undefined) {
        internalQuery[key] = {};
        if (value.$gt !== undefined) internalQuery[key].min = value.$gt;
        if (value.$lt !== undefined) internalQuery[key].max = value.$lt;
        return;
      }

      // Handle direct equality (for checkbox values)
      if (field.checkbox) {
        internalQuery[key] = [value === null ? NA_TAG : String(value)];
      } else {
        internalQuery[key] = value === null ? NA_TAG : String(value);
      }
    });

    // Handle $or queries (for checkboxes with multiple selections)
    if (parsedQuery.$or && Array.isArray(parsedQuery.$or)) {
      parsedQuery.$or.forEach(condition => {
        const entries = Object.entries(condition);
        if (entries.length !== 1) return;
        
        const [key, value] = entries[0];
        if (!internalQuery[key]) {
          internalQuery[key] = [value === null ? NA_TAG : String(value)];
        } else if (Array.isArray(internalQuery[key])) {
          internalQuery[key].push(value === null ? NA_TAG : String(value));
        }
      });
    }

    // Handle $and queries with nested $or conditions
    if (parsedQuery.$and && Array.isArray(parsedQuery.$and)) {
      parsedQuery.$and.forEach(condition => {
        if (condition.$or && Array.isArray(condition.$or)) {
          const firstCondition = condition.$or[0];
          const key = Object.keys(firstCondition)[0];
          
          if (!internalQuery[key]) {
            internalQuery[key] = [];
          }
          
          condition.$or.forEach(orCondition => {
            const orKey = Object.keys(orCondition)[0];
            const orValue = orCondition[orKey];
            if (orKey === key) {
              internalQuery[key].push(orValue === null ? NA_TAG : String(orValue));
            }
          });
        }
      });
    }

    return internalQuery;
  } catch (error) {
    console.error("Error parsing URL query:", error);
    return {};
  }
};

// Parse the query to an HTML string which may be passed as an URL
// Note that this function is called only at the end, when the search button is pressed
// The actual query is build below in the code
const parseQuery = (currentQuery, currentLocation) => {
  // Parse current URL parameters to preserve them
  const currentParams = parse(decodeURIComponent(currentLocation.search), {
    ignoreQueryPrefix: true,
    decoder: c => c,
  });
  // If the query is empty, rebuild the URL with only the currentParams
  if (Object.keys(currentQuery).length === 0) {
    delete currentParams.query; // Remove the 'query' key
    return '/browse?' + Object.entries(currentParams)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }
  
  // Set a function to parse our queries to a mongo query object
  const parsedQuery = {};
  let errors = 0;
  const parseAndAddQuery = ([key, value]) => {
    // DANI: Aquí me he quedado. Esto debería ser idéntico para las ref queries. Habría que aislar esta función.
    // Get the current field to know which is the expected type
    const currentField = availableFields.find(f => f.path === key);
    // Provided that value will allways be a string (or string array) do the corresponding parsing
    const parseType = string => {
      if (string === NA_TAG) return { $eq: null };
      if (currentField.type === 'string') return string;
      if (currentField.type === 'int' || currentField.type === 'float')
        return +string;
      if (currentField.type === 'boolean') return string === 'true';
    };
    // In case it is a string search it means it comes from a string textfield
    if (typeof value === 'string') {
      const parsedValue = escapeRegExp(value);
      parsedQuery[key] = { $regex: parsedValue, $options: 'i' };
      return;
    }
    // In case it has min or max propierties it comes from a number/date range pair of textfields
    if (value.min || value.max) {
      const parsedValue = {};
      if (value.min) {
        if (currentField.type === 'date') {
          parsedValue['$gt'] = value.min;
        } else {
          if (isNaN(+value.min)) return ++errors;
          parsedValue['$gt'] = +value.min;
        }
      }
      if (value.max) {
        if (currentField.type === 'date') {
          parsedValue['$lt'] = value.max;
        } else {
          if (isNaN(+value.max)) return ++errors;
          parsedValue['$lt'] = +value.max;
        }
      }
      parsedQuery[key] = parsedValue;
      return;
    }
    if (!Array.isArray(value))
      throw new Error('Wrong ' + key + ' -> ' + value);
    // If value is not one of the previous it must be an array, so it comes from checkboxes
    // If value array has only one element then search only for this option
    if (value.length === 1) {
      parsedQuery[key] = parseType(value[0]);
      return;
    }
    // Otherwise we must use a $or operand for each option
    // In case more than one field have more than one option we must use $and operand to declare multiple $or operands
    // So, if there is already an $and operator push the new $or operand to it
    const currentAnd = parsedQuery['$and'];
    if (currentAnd) {
      currentAnd.push({ $or: value.map(v => ({ [key]: parseType(v) })) });
      return;
    }
    // In case there is no $and operator but there is already an $or operand we must create the $and operator
    // Then the old $or operator must be copied into the $and operator and deleted from the query object
    const currentOr = parsedQuery['$or'];
    if (currentOr) {
      parsedQuery['$and'] = [
        { $or: currentOr },
        { $or: value.map(v => ({ [key]: parseType(v) })) },
      ];
      delete parsedQuery['$or'];
      return;
    }
    // In case there is no $and/$or operators we set the first $or operator alone
    parsedQuery['$or'] = value.map(v => ({ [key]: parseType(v) }));
  };

  // Parse the query
  Object.entries(currentQuery).forEach(entry => parseAndAddQuery(entry));

  // This may happen when a numeric textfield has text
  if (errors > 0) return;

  // Create params object with preserved sort parameters
  const params = {
    ...currentParams, // Preserve sort parameters
    query: JSON.stringify(parsedQuery),
  };

  // Filter out undefined values
  Object.keys(params).forEach(key => 
    params[key] === undefined && delete params[key]
  );

  // Return the query as a URL string with preserved parameters
  return '/browse?' + Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
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

  // Get access to the history so wen can redirect the user later
  const history = useNavigate();

  // Get the location
  const location = useLocation();
  
  // Parse the query parameter from URL 
  const urlParams = parse(location.search, { ignoreQueryPrefix: true });
  const urlQuery = urlParams.query;
  // Get the browser searach
  const urlBrowserSearch = urlParams.search;
  // Get the "browser option", not to be confused with the options endpoint or its projections
  const urlBrowserOption = urlParams.option;
  
  // Initialize the query based on URL or empty object
  const initialQuery = urlQuery ? parseUrlQuery(urlQuery) : {};
  // Use URL search params as a dependency for state
  const [query, setQuery] = useState(initialQuery);
  // Track whether search was triggered by user action or URL change
  const isUserInitiatedSearchRef = useRef(false);

  // Reset query when URL changes
  useEffect(() => {
    if (!urlQuery) {
      // Clear the query when there's no query parameter in URL
      setQuery({});
    } else {
      // Update query with parsed URL data
      setQuery(parseUrlQuery(urlQuery));
    }
  }, [location.search, urlQuery]);

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
  const projectionQuery = buildProjectionQuery(availableFields);

  // Build the API URL for the options requests
  // DANI: Se piden todas las options de golpe, lo cual no es muy eficiente y la API tarda 3 segundos aprox
  // DANI: Hemos decidido que este valor se guardará en la db y se actualizará periódicamente, cosa mucho más eficiente
  let optionsUrl = `${BASE_PATH_PROJECTS}/options?${projectionQuery}`;
  // In case the user has searched some text in the browser
  if (urlBrowserSearch) {
    optionsUrl += `&search=${urlBrowserSearch}`;
  }
  // In case the user has selected a specific "browser option" we filter the query
  if (urlBrowserOption) {
    const browserOptionsField = HOST_CONFIG.optionsField;
    const browserOptionsQuery = JSON.stringify({ [browserOptionsField]: urlBrowserOption });
    optionsUrl += `&query=${browserOptionsQuery}`;
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
    if (!urlQuery && !isUserInitiatedSearchRef.current && !location.search) {
      const { categoryState, fieldState } = initializeExpandedState(queryFields, query);
      setExpandedCategory(categoryState);
      setExpandedFields(fieldState);
    }
    // Reset the ref after handling the state update
    if (isUserInitiatedSearchRef.current) {
      isUserInitiatedSearchRef.current = false;
  }
  }, [location.search, urlQuery]);

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
                            <p style={{ color: '#e60000', fontSize: '0.8rem', margin: '0 0 6px' }}>
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
                                          style={{ color: 'rgb(110, 110, 110)', padding: '4px 9px' }}
                                          inputProps={{ 'data-key': option }}
                                        />
                                      }
                                      label={`${formatOptionLabel(option)} (${count})`}
                                      style={{ color: '#303030' }}
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
