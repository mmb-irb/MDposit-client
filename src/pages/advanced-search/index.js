// React
import React, { useState, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';

// Additional components
import Card from '../../components/animated-card'; // The exceled parcels in which almost all features are based

// Visual assets
import {
  CardContent,
  Select,
  MenuItem,
  FormControl,
  TextField,
  IconButton,
  Button,
  FormHelperText,
  FormControlLabel,
  Checkbox,
  ListSubheader,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  faPlusCircle,
  faTrash,
  faSearch,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// The table where matched projects are shown
import ProjectBrowser from  '../../components/project-browser';

// CSS styles
import style from './style.module.css';

// It is used to check if the user has the reduced motion setting active
import reducedMotion from '../../utils/reduced-motion';

// Get the host congifuration
import { HOST_CONFIG } from "../../utils/constants";
// Auxiliar functions
import { parseLocationSearch } from '../../utils/auxiliar-functions';
// String managers
import { stringify } from 'qs';

// Get the available search fields
const queryFields = HOST_CONFIG.queryFields;
const availableFields = Object.values(queryFields).reduce((acc, curr) => acc.concat(curr), []);

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

// Escape all regex sensible characters
const escapeRegExp = input => {
  return input.replace(/[-[/\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

// Set the basic logic operands to handle multiple conditions
const availableLogics = [
  { name: 'AND', operator: '$and', noperator: '$not' },
  { name: 'OR', operator: '$or', noperator: '$nor' },
];
// Set the possible comparators to apply according to each field type
// Set also the format in the mongo query for each comparator
const simpleFormat = (comparator, value) => {
  return { [comparator]: value };
};
const regexFormat = (comparator, value) => {
  return { [comparator]: value, $options: 'i' };
};
const numericFormat = (comparator, value) => {
  return { [comparator]: +value };
};
const booleanFormat = (comparator, _) => comparator === 'true';
const dateFormat = (comparator, value) => ({ [comparator]: value });
const availableComparators = {
  string: [
    {
      name: 'contains',
      operator: '$regex',
      formatter: (comparator, value) => {
        // Regex characters must be scaped here
        const parsedVaue = escapeRegExp(value);
        return regexFormat(comparator, parsedVaue);
      },
    },
    { name: 'equals', operator: '$eq', formatter: simpleFormat },
    { name: 'regular expression', operator: '$regex', formatter: regexFormat },
  ],
  float: [
    { name: 'greater than', operator: '$gt', formatter: numericFormat },
    { name: 'lower than', operator: '$lt', formatter: numericFormat },
  ],
  int: [
    { name: 'equals', operator: '$eq', formatter: numericFormat },
    { name: 'greater than', operator: '$gt', formatter: numericFormat },
    { name: 'lower than', operator: '$lt', formatter: numericFormat },
  ],
  boolean: [
    { name: 'true', operator: 'true', formatter: booleanFormat },
    { name: 'false', operator: 'false', formatter: booleanFormat },
  ],
  date: [
    { name: 'after', operator: '$gt', formatter: dateFormat },
    { name: 'before', operator: '$lt', formatter: dateFormat },
  ],
};

// Set the default query configuration
const defaultQuery = {
  logic: 'AND',
  is: true,
  fields: [
    { field: '', is: true, comparator: '', value: '' },
    { field: '', is: true, comparator: '', value: '' },
  ],
};

// How arithmetic signs results
const signLogic = (positive1, positive2) => {
  if (positive1) {
    if (positive2) return true;
    if (!positive2) return false;
  } else {
    if (positive2) return false;
    if (!positive2) return true;
  }
};

// DANI: a esta página dejé de darle mantenimiento al introducir las queries a la colección de references
// DANI: con la implementación actual de la API esto rompe un poco la idea de una única query
// DANI: las queries a references van por separado internamente en la API
// DANI: los resultados de queries a projects y queries a references se suman mediante AND por defecto
// DANI: montar un sistema en que el usuario pueda decidir sumar estos resultados miedante un OR es un marrón
// DANI: no permitir un OR entre estos campos no sería coherente, y dificil de entender para el usuario
// DANI: prefiero dejar de mantener esta versión de búsqueda de momento y centrarme en la otra

// Advanced search page
const AdvancedSearch = () => {
  const theme = useTheme();
  // Save the query
  const query = useRef(defaultQuery);

  // Track if the user has tried to search the current query
  // In case it has tried, all error messages appear if things are wrong
  const [displayErrors, setDisplayErrors] = useState(false);

  // Get the location and the history so wen can update the URL later
  const location = useLocation();
  const history = useNavigate();

  // Parse the location search, including all current query parameters
  const search = useMemo(() => parseLocationSearch(location.search), [location.search]);

  // This is a trick to force the page rerender
  const [, setUpdater] = useState(true);
  const forceUpdate = () => {
    setUpdater(value => !value);
  };

  // Track if there is any input error
  let inputError = false;

  const ComparatorSelector = ({
    object,
    label,
    options,
    handleChange,
    error,
    helpText,
  }) => (
    <FormControl className={style.spaced}>
      <Select
        id="select"
        title={'Select the desired ' + label}
        value={object[label]}
        onChange={handleChange}
        displayEmpty
        error={error}
      >
        <MenuItem disabled value={''} key={'placeholder'}>
          <em className={style.grey}>{label}</em>
        </MenuItem>
        {options.map(key => (
          <MenuItem value={key} key={key}>
            {key}
          </MenuItem>
        ))}
      </Select>
      {helpText && <FormHelperText>{helpText}</FormHelperText>}
    </FormControl>
  );

  const LogicsAndFieldsSelector = ({
    object,
    label,
    options,
    handleChange,
  }) => (
    <FormControl className={style.spaced}>
      <Select
        id="select"
        title={'Select the desired ' + label}
        value={object[label]}
        onChange={handleChange}
        displayEmpty
      >
        <MenuItem disabled value={''} key={'placeholder'}>
          <em className={style.grey}>{label}</em>
        </MenuItem>
        {options.map(category => {
          // Note that each object has a single entry
          const [ categoryName, categoryOptions ] = Object.entries(category)[0];
          return [
            <ListSubheader color={'primary'}>{categoryName}</ListSubheader>,
            ...categoryOptions.map(categoryOption => (
              <MenuItem value={categoryOption} key={categoryOption}>
                {categoryOption}
              </MenuItem>
            ))
          ];
        })}
      </Select>
    </FormControl>
  );

  // The inputMode is useful for mobiles
  const inputParameteres = {
    string: { inputMode: 'text' },
    int: {
      inputMode: 'numeric',
      pattern: '[0-9+-]*',
      helpText: 'integer numbers accepted only',
    },
    float: {
      inputMode: 'numeric',
      pattern: '[0-9.,+-]*',
      helpText: 'numbers accepted only',
    },
  };

  // Represent the query object
  // Set the layout for query fields
  // In case of logic (i.e. AND, OR, etc.), call this function for each element
  const Represent = ({ object, parent, index }) => {
    // Find the field options
    // Field options include logicals
    // DANI: descartamos fields de references, que no funcionarían por defecto
    const logicOptions = availableLogics.map(operand => operand.name);
    const fieldOptions = Object.entries(queryFields).map(([category, fields]) => {
      return { [category]: fields.map(field => field.name) };
    });
    // We set this as a list objects with a single value each instead of a single object
    // This is because the order is to be respected
    const logicsAndFields = [
      { 'Logic operators': logicOptions },
      ...fieldOptions
    ];
    // In case it is a field set the layout
    if (object.field !== undefined) {
      // Get the parameters for the current field
      const currentField = availableFields.find(
        field => field.name === object.field,
      );
      // Get the available comparator options for the current field type
      const comparatorOptions = currentField &&
        availableComparators[currentField.type].map(c => c.name);
      // Seth whenever the value text input must be rendered
      const isBoolean = currentField && currentField.type === 'boolean';
      const isDate = currentField && currentField.type === 'date';
      // Handle input errors
      const missingComparator = currentField && !object.comparator;
      const helpTextComparator =
        missingComparator && 'please select a comparator';
      const missingValue = currentField && !isBoolean && !isDate && !object.value;
      const parameters = currentField && !isBoolean && !isDate &&
        inputParameteres[currentField.type];
      const match = currentField && !isBoolean && !isDate && parameters.pattern &&
        object.value.match(parameters.pattern);
      const wrongValue = match && match[0] !== object.value;
      const helpTextValue =
        (missingValue && 'please specify a value') ||
        (wrongValue && parameters.helpText);
      if (missingComparator || missingValue || wrongValue) inputError = true;
      // Handle when the text input has changed
      const handleInputChange = event => {
        const newValue = event.target.value;
        object.value = newValue;
        forceUpdate();
      };
      return (
        <div className={style.margined}>
          <LogicsAndFieldsSelector
            object={object}
            label={'field'}
            options={logicsAndFields}
            handleChange={event => {
              const newValue = event.target.value;
              const isLogic = logicOptions.includes(newValue);
              // If the new value is a logic
              if (isLogic) {
                delete object.field;
                delete object.comparator;
                delete object.value;
                object.logic = newValue;
                object.is = true;
                object.fields = [];
                forceUpdate();
                return;
              }
              // If the new value is another field
              object.field = newValue;
              const newField = availableFields.find(
                field => field.name === newValue,
              );
              const newComparatorOptions =
                newField &&
                availableComparators[newField.type].map(c => c.name);
              // If the new field has not the previously selected comparator option then we reset it
              if (newComparatorOptions.indexOf(object.comparator) === -1)
                object.comparator = '';
              forceUpdate();
            }}
          />
          {currentField && !isBoolean && (
            <FormControlLabel
              onChange={() => {
                object.is = !object.is;
                forceUpdate();
              }}
              control={
                <Checkbox
                  checked={!object.is}
                  icon={
                    <FontAwesomeIcon
                      icon={faTimes}
                      size="xs"
                      style={{ visibility: 'hidden' }}
                    />
                  }
                  checkedIcon={<FontAwesomeIcon icon={faTimes} size="xs" />}
                  style={{ color: theme.vars.palette.text.primary }}
                />
              }
              label={'NOT'}
              style={{ color: object.is ? theme.vars.palette.text.disabled : theme.vars.palette.text.primary }}
              className={style.outlined}
            />
          )}
          {currentField && (
            <ComparatorSelector
              object={object}
              label={'comparator'}
              options={comparatorOptions}
              handleChange={event => {
                const newValue = event.target.value;
                object.comparator = newValue;
                forceUpdate();
              }}
              helpText={displayErrors && helpTextComparator}
              error={displayErrors && missingComparator}
            />
          )}
          {currentField && !isBoolean && !isDate && (
            <TextField
              title={'Type here the value for the specified field'}
              defaultValue={object['value']}
              // When pressing enter
              onKeyPress={event => {
                if (event.key === 'Enter') handleInputChange(event);
              }}
              // When clicking out, pressing tabulator, etc.
              onBlur={handleInputChange}
              placeholder={'e.g. ' + currentField.example}
              inputProps={{ inputMode: parameters.inputMode }}
              helperText={displayErrors && helpTextValue}
              error={displayErrors && (missingValue || wrongValue)}
            />
          )}
          {currentField && isDate && (
            <TextField
              type="date"
              value={object.value || ''}
              onChange={({ target: { value } }) => {
                object.value = value;
                forceUpdate();
              }}
              size="small"
            />
          )}
          <IconButton
            variant="contained"
            onClick={() => {
              parent.splice(index, 1);
              forceUpdate();
            }}
            className={style.trash}
            size="large"
          >
            <FontAwesomeIcon icon={faTrash} size="xs" />
          </IconButton>
        </div>
      );
    }
    // In case it is a logic call this function for each containing field
    if (object.fields !== undefined) {
      return (
        <div className={style.margined}>
          <LogicsAndFieldsSelector
            object={object}
            label={'logic'}
            options={logicsAndFields}
            handleChange={event => {
              const newValue = event.target.value;
              const isField = logicOptions.indexOf(newValue) === -1;
              // If the new value is a field
              if (isField) {
                delete object.fields;
                delete object.logic;
                object.field = newValue;
                object.is = true;
                object.comparator = '';
                object.value = '';
                forceUpdate();
                return;
              }
              // If the new value is another logic
              object.logic = newValue;
              forceUpdate();
            }}
          />
          <FormControlLabel
            onChange={() => {
              object.is = !object.is;
              forceUpdate();
            }}
            control={
              <Checkbox
                checked={!object.is}
                icon={
                  <FontAwesomeIcon
                    icon={faTimes}
                    size="xs"
                    style={{ visibility: 'hidden' }}
                  />
                }
                checkedIcon={<FontAwesomeIcon icon={faTimes} size="xs" />}
                style={{ color: theme.vars.palette.text.primary }}
              />
            }
            label={'NOT'}
            style={{ color: object.is ? theme.vars.palette.text.disabled : theme.vars.palette.text.primary }}
            className={style.outlined}
          />
          <IconButton
            variant="contained"
            onClick={() => {
              object.fields.unshift({
                field: '',
                is: true,
                comparator: '',
                value: '',
              });
              forceUpdate();
            }}
            className={style.unpadded}
            size="large"
          >
            <FontAwesomeIcon icon={faPlusCircle} />
          </IconButton>
          {parent && (
            <IconButton
              variant="contained"
              onClick={() => {
                parent.splice(index, 1);
                forceUpdate();
              }}
              className={style.unpadded}
              size="large"
            >
              <FontAwesomeIcon icon={faTrash} size="xs" />
            </IconButton>
          )}
          {object.fields.map((field, i) => (
            <Represent
              key={i}
              object={field}
              parent={object.fields}
              index={i}
            />
          ))}
        </div>
      );
    }
  };

  // Parse a query object
  // Replace names by tags
  const parseQuery = object => {
    // In case it is a field
    if (object.field !== undefined) {
      // Get the parameters for the current field
      const currentField = availableFields.find(
        field => field.name === object.field,
      );
      // Get the path to the field to be queried
      const fieldPath = currentField.path;
      // Get the available comparators for the current field type
      const comparators =
        currentField && availableComparators[currentField.type];
      // Get the parameters for the current comparator
      const currentComparator = comparators.find(
        c => c.name === object.comparator,
      );
      // Get the comparator operator
      const operator = currentComparator.operator;
      // Get the formatter for using this comparator
      const formatter = currentComparator.formatter;
      // Return the object with the mongo format
      if (object.is) return { [fieldPath]: formatter(operator, object.value) };
      return { [fieldPath]: { $not: formatter(operator, object.value) } };
    }
    // In case it is a logic
    if (object.logic !== undefined) {
      const logic = object.logic;
      const logicOperator = availableLogics.find(l => l.name === logic)[
        object.is ? 'operator' : 'noperator'
      ];
      // Get only fields which are not empty
      const fields = object.fields.filter(f => f.field || f.logic);
      // If there is no content in this logic then return nothing
      if (fields.length === 0) return;
      // If there is only 1 field in this logic then the logic makes not sense
      if (fields.length === 1) {
        const uniqueField = fields[0];
        uniqueField.is = signLogic(uniqueField.is, object.is);
        return parseQuery(uniqueField);
      }
      // If there are several fields
      return { [logicOperator]: fields.map(child => parseQuery(child)) };
    }
  };

  // Parse the query to an HTML string which may be passed as an URL
  const searchQuery = () => {
    if (inputError) {
      setDisplayErrors(true);
      return;
    }
    // Sum up the query parameters into an abreviated object
    const currentQuery = query.current;
    const parsedQuery = parseQuery(currentQuery);
    // Convert the summary obejct to a single string
    const stringQuery = JSON.stringify(parsedQuery);
    if (!stringQuery) return;
    // Then make a browse with the new query
    //history('/browse?query=' + stringQuery);
    history({
      ...location,
      search: stringify({
        ...search,
        query: stringQuery,
        // If we had a new query then reset the page
        page: 0,
      }),
    });
  };

  return (
    <Card className={style.tall}>
      <CardContent>
        Use the <b>advanced search</b> query builder to create complex database
        queries.<br />
        <hr style={{ color: 'lightGrey' }} />
        <Represent object={query.current} />
        <div className={style.right}>
          <Button variant="contained" onClick={searchQuery} className={style.search}>
            <FontAwesomeIcon icon={faSearch} />
            &nbsp;
            <span>Search</span>
          </Button>
        </div>
        <hr style={{ color: 'lightGrey', marginTop: '1em' }} />
        <ProjectBrowser style={{width: '100%'}} />
      </CardContent>
    </Card>
  );
};

export default AdvancedSearch;
