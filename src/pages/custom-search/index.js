// React
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Additional components
import Card from '../../components/animated-card'; // The exceled parcels in which almost all features are based

// Visual assets
import {
  CardContent,
  TextField,
  Button,
  FormControlLabel,
  Checkbox,
  Autocomplete,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography
} from '@mui/material';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// CSS styles
import style from './style.module.css';

// It is used to check if the user has the reduced motion setting active
import reducedMotion from '../../utils/reduced-motion';

// Constants
import { BASE_PATH_PROJECTS } from '../../utils/constants';

// Hooks
import useAPI from '../../hooks/use-api'; // API acces
import Loading from '../../components/loading'; // Displays an animated "loading" circle

// Get the host congifuration
import { HOST_CONFIG } from "../../utils/constants";

// Get the avilable search fields
const queryFields = HOST_CONFIG.queryFields;
const availableFields = Object.values(queryFields).reduce((acc, curr) => acc.concat(curr), []);

// These keyframes are used for an animate()
// An image opacity is iterated between 0 (invisible) and 1 (visible)
const keyframes = { opacity: [0, 1] };

// Same image vertical position is iterated between 0 and 50 pixels (It may have no effect)
// This is only set when user has not activated the reduced motion option from the navigator
if (!reducedMotion()) {
  keyframes.transform = ['translateX(2.5%)', 'translateX(0)'];
}

// Escape all regex sensible characters
const escapeRegExp = input => {
  return input.replace(/[-[/\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

// Parse the query to an HTML string which may be passed as an URL
// Note that this function is called only at the end, when the search button is pressed
// The actual query is build below in the code
const parseQuery = currentQuery => {
  // If the query is empty then do not search
  if (Object.keys(currentQuery).length === 0) return;
  // Set a function to parse our queries to a mongo query object
  const parsedQuery = {};
  let errors = 0;
  const parseAndAddQuery = ([key, value]) => {
    // DANI: Aquí me he quedado. Esto debería ser idéntico para las ref queries. Habría que aislar esta función.
    // Get the current field to know which is the expected type
    const currentField = availableFields.find(f => f.path === key);
    // Provided that value will allways be a string (or string array) do the corresponding parsing
    const parseType = string => {
      if (string === naTag) return { $eq: null };
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
    // In case it has min or max propierties it comes from a number range pair of textfields
    if (value.min || value.max) {
      const parsedValue = {};
      if (value.min) {
        if (isNaN(+value.min)) return ++errors;
        parsedValue['$gt'] = +value.min;
      }
      if (value.max) {
        if (isNaN(+value.max)) return ++errors;
        parsedValue['$lt'] = +value.max;
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

  // Prase the query
  Object.entries(currentQuery).forEach(entry => parseAndAddQuery(entry));

  // This may happen when a numeric textfield has text
  if (errors > 0) return;

  // Return the query made a single URL string
  return '/browse?query=' + JSON.stringify(parsedQuery);
};

// Set the tag to be shown for null and undefined values
const naTag = 'Not defined';

// Store queries per location id, since I am not able to make the location remember a bloody state
const storedQueries = {};

// Advanced search page
const CustomSearch = () => {

  // Get access to the history so wen can redirect the user later
  const history = useNavigate();

  // Get the location
  const location = useLocation();
  if (!storedQueries[location.key]) storedQueries[location.key] = {};

  // Save the query
  const [query] = useState(storedQueries[location.key]);

  // Make a function to parse the query once built and browse
  const parseAndSearch = () => {
    const browseURL = parseQuery(query);
    history(browseURL);
  };

  // Add event handler for Enter key
  React.useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Enter') {
        parseAndSearch();
      }
    };

    document.addEventListener('keypress', handleKeyPress);
    return () => {
      document.removeEventListener('keypress', handleKeyPress);
    };
  }, []);

  // Query all the available fields using the 'options' endpoint
  const projectionStrings = availableFields.filter(field => field.options).map(field => 'projection=' + field.path);
  const projectionQuery = projectionStrings.join('&');

  // Build the API URL for the options requests
  // DANI: Se piden todas las options de golpe, lo cual no es muy eficiente y la API tarda 3 segundos aprox
  // DANI: Hemos decidido que este valor se guardará en la db y se actualizará periódicamente, cosa mucho más eficiente
  const optionsUrl = `${BASE_PATH_PROJECTS}/options?${projectionQuery}`;
  const { payload: optionsPayload, error: optionsError } = useAPI(optionsUrl);

  // Stop here if any of the requests failed
  if (optionsError) return optionsError.toString();

  // Here is where queries are built by the user
  return (
    <Card className={style.tall}>
      <CardContent style={{ paddingLeft: '0' }}>
        <div className={style.advanced}>Use the <b>search</b> menu to create a specific query.
        Go to{' '} <a href="/#/advanced-search">advanced search</a> for a most complex query.
        </div>
        {Object.entries(queryFields).map(([category, fields], c) => {
          return (
            <Accordion key={c} defaultExpanded={false} disableGutters="true">
              <AccordionSummary 
                expandIcon={<FontAwesomeIcon icon="chevron-down" />} 
                className={style.categorySummary}
              >
                <Typography variant='h6' className={style.margined}>{category}</Typography>
              </AccordionSummary>
              <AccordionDetails  className={style.section}>
                <div>
                  {fields.map((field, f) => (
                    <Accordion key={f}  className={style.accordion} disableGutters="true" defaultExpanded={field.defaultOpen || field.path in query}>
                      <AccordionSummary className={style.summary}>{field.name}</AccordionSummary>
                      <AccordionDetails>
                        {(() => {
                          // Get the corresponding payload
                          if (!optionsPayload) return <Loading />;
                          // Save the current queries
                          const currentQuery = query;
                          // In case it is a field with options (i.e. input is specified through checkboxes)
                          if (field.options) {
                            const fieldData = optionsPayload[field.path];
                            // In case we have nulls or undefineds we merge them in a single 'Not defined' field
                            let notDefined = 0;
                            if (fieldData.null) {
                              notDefined += fieldData.null;
                              delete fieldData.null;
                            }
                            // DANI: De momento los not defined se descartan y ya
                            // DANI: Está bien poder ver cuantos 'not defined' hay en cada campo, el problema es que la query no va
                            // DANI: Es complicado dar soporte a esto por los muchos formatos en los campos y los muchos tipos de faltas
                            // DANI: Not defined puede ser una lista vacía, un null, etc.
                            //if (notDefined > 0) fieldData[naTag] = notDefined;
                            // If the field values are set to be selectable as checkboxes
                            if (field.checkbox) {
                              // For each entry generate a checkbox
                              const entries = Object.entries(fieldData).sort(([aKey, aCount], [bKey, bCount]) => bCount - aCount);
                              return entries.map(([option, count], i) => (
                                <FormControlLabel
                                  key={i}
                                  onChange={({ target: { checked } }) => {
                                    if (checked) {
                                      if (currentQuery[field.path])
                                        currentQuery[field.path].push(option);
                                      else currentQuery[field.path] = [option];
                                    } else {
                                      const currentIndex = currentQuery[field.path].indexOf(
                                        option,
                                      );
                                      currentQuery[field.path].splice(currentIndex, 1);
                                      if (currentQuery[field.path].length === 0)
                                        delete currentQuery[field.path];
                                    }
                                  }}
                                  control={
                                    <Checkbox
                                      defaultChecked={
                                        currentQuery[field.path] &&
                                        currentQuery[field.path].indexOf(option) !== -1
                                      }
                                      style={{ color: 'black' }}
                                      inputProps={{ 'data-key': option }}
                                    />
                                  }
                                  label={`${option} (${count})`}
                                  style={{ color: 'black' }}
                                  //className={style.outlined}
                                />
                              ));
                            }
                            else {
                              const handleInputChange = ({ target: { value } }) => {
                                currentQuery[field.path] = value;
                                if (value === '') delete currentQuery[field.path];
                              };
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
                                    renderInput={(params) => 
                                      <TextField
                                        {...params}
                                        title={'Type here the value for the specified field'}
                                        defaultValue={currentQuery[field.path]}
                                        // When pressing enter
                                        onKeyPress={event => {
                                          if (event.key === 'Enter') handleInputChange(event);
                                        }}
                                        // When clicking out, pressing tabulator, etc.
                                        onBlur={handleInputChange}
                                        placeholder={'e.g. ' + field.example}
                                        className={style.spaced}
                                      />}
                                  />
                                </div>
                              );
                            }
                          }
                          // In case it is a field without options (i.e. input is specified through a textfield)
                          else {
                            // If the field is a string we show a unique textfield
                            if (field.type === 'string') {
                              const handleInputChange = ({ target: { value } }) => {
                                currentQuery[field.path] = value;
                                if (value === '') delete currentQuery[field.path];
                              };
                              return (
                                <div className={style.aligned}>
                                  <TextField
                                    title={'Type here the value for the specified field'}
                                    defaultValue={currentQuery[field.path]}
                                    // When pressing enter
                                    onKeyPress={event => {
                                      if (event.key === 'Enter') handleInputChange(event);
                                    }}
                                    // When clicking out, pressing tabulator, etc.
                                    onBlur={handleInputChange}
                                    placeholder={'e.g. ' + field.example}
                                    inputProps={{ inputMode: 'text' }}
                                    className={style.spaced}
                                  />
                                </div>
                              );
                            }
                            // Otherwise it must be a number, since booleans will always be in options
                            // Then show two textfields: one for the minimum and one for the maximum
                            else {
                              const handleInputChange = ({ target: { value } }, side) => {
                                if (value === '') {
                                  if (!currentQuery[field.path]) return;
                                  if (!currentQuery[field.path][side]) return;
                                  delete currentQuery[field.path][side];
                                  if (Object.keys(currentQuery[field.path]).length === 0)
                                    delete currentQuery[field.path];
                                } else {
                                  if (!currentQuery[field.path])
                                    return (currentQuery[field.path] = { [side]: value });
                                  currentQuery[field.path][side] = value;
                                }
                              };
                              return (
                                <div className={style.aligned}>
                                  <TextField
                                    title={'Type here the value for the specified field'}
                                    defaultValue={
                                      currentQuery[field.path] &&
                                      currentQuery[field.path].min
                                    }
                                    // When pressing enter
                                    onKeyPress={event => {
                                      if (event.key === 'Enter')
                                        handleInputChange(event, 'min');
                                    }}
                                    // When clicking out, pressing tabulator, etc.
                                    onBlur={event => handleInputChange(event, 'min')}
                                    placeholder={'e.g. ' + field.example}
                                    inputProps={{
                                      inputMode: 'numeric',
                                      pattern: '[0-9.,+-]*',
                                    }}
                                    className={style.spaced}
                                  />
                                  <span style={{padding: '3px'}}>-</span>
                                  <TextField
                                    title={'Type here the value for the specified field'}
                                    defaultValue={
                                      currentQuery[field.path] &&
                                      currentQuery[field.path].max
                                    }
                                    // When pressing enter
                                    onKeyPress={event => {
                                      if (event.key === 'Enter')
                                        handleInputChange(event, 'max');
                                    }}
                                    // When clicking out, pressing tabulator, etc.
                                    onBlur={event => handleInputChange(event, 'max')}
                                    placeholder={'e.g. ' + field.example}
                                    inputProps={{
                                      inputMode: 'numeric',
                                      pattern: '[0-9.,+-]*',
                                    }}
                                    className={style.spaced}
                                  />
                                </div>
                              );
                            }
                          }
                        })()}
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </div>
              </AccordionDetails>
            </Accordion>
          );
        })}
        <div className={style.button}>
          <Button variant="contained" onClick={parseAndSearch} className={style.search}>
            <FontAwesomeIcon icon={faSearch} />
            &nbsp;
            <span>Search</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomSearch;
