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
// API filters builder
import { buildFilter, joinConditions, stringifyQuery } from '../../utils/filters';

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

// Set the basic logic operands to handle multiple conditions
const availableLogics = [ { name: 'AND' }, { name: 'OR' } ];
// Set the possible comparators to apply according to each field type
// Set also the API filter operator for each comparator, both in positive and negative
// Comparators with a fixed value do not need the user to type it
const availableComparators = {
  string: [
    { name: 'contains', operator: '~=', negatedOperator: '!~=' },
    { name: 'equals', operator: '==', negatedOperator: '!=' },
  ],
  float: [
    { name: 'greater than', operator: '>', negatedOperator: '<=' },
    { name: 'lower than', operator: '<', negatedOperator: '>=' },
  ],
  int: [
    { name: 'equals', operator: '==', negatedOperator: '!=' },
    { name: 'greater than', operator: '>', negatedOperator: '<=' },
    { name: 'lower than', operator: '<', negatedOperator: '>=' },
  ],
  boolean: [
    { name: 'true', operator: '==', negatedOperator: '!=', value: true },
    { name: 'false', operator: '==', negatedOperator: '!=', value: false },
  ],
  date: [
    { name: 'after', operator: '>', negatedOperator: '<=' },
    { name: 'before', operator: '<', negatedOperator: '>=' },
  ],
};
// Set the operators which support several values, which are matched if any value matches
const MULTIPLE_VALUES_OPERATORS = ['==', '~='];
// Set the maximum number of filters a query may be translated to
const MAX_FILTERS = 20;

// Translate a query object into a list of clauses which must all be matched
// Every clause is a list of conditions (path, operator and value) where any condition must be matched
// This is how the API filters work: several filters are combined with AND and conditions in a filter with OR
// Note that negated groups are translated thanks to De Morgan laws (e.g. NOT (A OR B) = NOT A AND NOT B)
// Note also that an OR of ANDs is distributed (e.g. (A AND B) OR C = (A OR C) AND (B OR C)), so it may grow fast
// Return an error if the query is too complex
export const getClauses = (object, positive = true) => {
  // In case it is a field
  if (object.field !== undefined) {
    const currentField = availableFields.find(field => field.name === object.field);
    const comparator = availableComparators[currentField.type].find(c => c.name === object.comparator);
    const isPositive = positive === object.is;
    const operator = isPositive ? comparator.operator : comparator.negatedOperator;
    // Numbers are passed as numbers, while the rest of values are passed as texts
    let value = comparator.value !== undefined ? comparator.value : object.value;
    if (currentField.type === 'int' || currentField.type === 'float') value = +value;
    return [ [ { path: currentField.path, operator, value } ] ];
  }
  // In case it is a logic
  const isPositive = positive === object.is;
  // Get clauses only for fields which are not empty
  const children = object.fields
    .filter(f => f.field || f.logic)
    .map(child => getClauses(child, isPositive));
  const childError = children.find(child => child.error);
  if (childError) return childError;
  const childrenClauses = children.filter(child => child.length > 0);
  // If there is no content in this logic then return nothing
  if (childrenClauses.length === 0) return [];
  // An AND, or a negated OR, matches when all clauses match
  const isAnd = (object.logic === 'AND') === isPositive;
  if (isAnd) return childrenClauses.flat();
  // Otherwise any child must match (OR), so clauses from different children are combined
  let clauses = [ [] ];
  for (const childClauses of childrenClauses) {
    clauses = clauses.flatMap(clause => childClauses.map(childClause => [ ...clause, ...childClause ]));
    if (clauses.length > MAX_FILTERS) return { error: `This query is too complex. ` +
      `Combining ANDs inside ORs multiplies the number of conditions. Please simplify the query.` };
  }
  return clauses;
};

// Translate a query object into a list of API filters
// Conditions in the same clause with the same field and operator are merged when possible
export const getFilters = query => {
  const clauses = getClauses(query);
  if (clauses.error) return clauses;
  if (clauses.length > MAX_FILTERS) return { error: `This query is too complex. Please simplify the query.` };
  return clauses.map(clause => {
    const conditions = [];
    clause.forEach(({ path, operator, value }) => {
      const sameCondition = MULTIPLE_VALUES_OPERATORS.includes(operator) &&
        conditions.find(condition => condition.path === path && condition.operator === operator);
      if (sameCondition) sameCondition.values.push(value);
      else conditions.push({ path, operator, values: [ value ] });
    });
    return joinConditions(conditions.map(({ path, operator, values }) => buildFilter(path, operator, values)));
  });
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

// Advanced search page
const AdvancedSearch = () => {
  const theme = useTheme();
  // Save the query
  const query = useRef(defaultQuery);

  // Track if the user has tried to search the current query
  // In case it has tried, all error messages appear if things are wrong
  const [displayErrors, setDisplayErrors] = useState(false);
  // Save the error when the query can not be translated to API filters
  const [queryError, setQueryError] = useState(null);

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

  // Parse the query to API filters which may be passed as an URL
  const searchQuery = () => {
    if (inputError) {
      setDisplayErrors(true);
      return;
    }
    // Translate the query to a list of filters
    const filters = getFilters(query.current);
    if (filters.error) {
      setQueryError(filters.error);
      return;
    }
    setQueryError(null);
    if (filters.length === 0) return;
    // Then make a browse with the new filters
    history({
      ...location,
      search: stringifyQuery({
        ...search,
        filter: filters,
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
          {queryError && <FormHelperText error>{queryError}</FormHelperText>}
        </div>
        <hr style={{ color: 'lightGrey', marginTop: '1em' }} />
        <ProjectBrowser style={{width: '100%'}} />
      </CardContent>
    </Card>
  );
};

export default AdvancedSearch;
