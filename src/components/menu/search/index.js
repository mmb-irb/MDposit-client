import React, { useState, useEffect, useCallback } from 'react';
import { parse, stringify } from 'qs';
import { debounce } from 'lodash-es';

import Icon from '@material-ui/core/Icon';
import TextField from '@material-ui/core/TextField';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';

import style from './style.module.css';

const DEBOUNCE_DELAY = 500;

// define non-changing props
const inputProps = { 'aria-label': 'Search projects by text' };

// This function is never called directly, but it is called indirectly by calling "debouncedUpdateLocation"
export const updateLocation = (history, value) => {
  const { search, ...nextSearchObject } = parse(history.location.search, {
    ignoreQueryPrefix: true,
  });
  const shouldReplace = Boolean(search) === Boolean(value);
  if (value) nextSearchObject.search = value;
  if (search === value) return;
  // If this search is different to the previous search
  // Reset page to the first page
  nextSearchObject.page = undefined;
  // Update history
  history[shouldReplace ? 'replace' : 'push']({
    ...history.location,
    search: stringify(nextSearchObject),
  });
};

// "debounce" is a method from the "lodash" library that invokes a function after a time delay
// debounced functions are cancellable before the time delay has passed
// debounced function, to avoid changing the URL too much while typing
const debouncedUpdateLocation = debounce(updateLocation, DEBOUNCE_DELAY);

// This function is called each time that a letter is typed in the search bar
const Search = ({ history }) => {
  // Here, parse converts a query formatted search (e.g. "?search=x") in a string only with the text search (e.g. "x")
  // Return the parsed searh text (value) and a function to change this value (SetValue)
  const [value, setValue] = useState(
    parse(history.location.search, { ignoreQueryPrefix: true }).search,
  );
  // Cancel the last debouncedUpdateLocation if it has not been executed yet because there is a new change
  useEffect(() => debouncedUpdateLocation.cancel, []);
  // Update the state and the query search in the URL with the new searched value
  const handleChange = useCallback(
    ({ target: { value } }) => {
      setValue(value);
      debouncedUpdateLocation(history, value);
    },
    [history],
  );

  return (
    <span>
      {/* Render the lens icon */}
      <Icon>
        <FontAwesomeIcon
          icon={faSearch}
          className={value && style['search-active']}
        />
      </Icon>
      {/* Render the search bar text field */}
      <TextField
        value={value || ''}
        onChange={handleChange}
        className={style.search}
        inputProps={inputProps}
      />
    </span>
  );
};

export default Search;
