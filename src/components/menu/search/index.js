import React, { useState, useEffect, useCallback } from 'react';
import { parse, stringify } from 'qs';
import { debounce } from 'lodash-es';

import { Icon, TextField } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';

import { docs } from '../../../pages/help/documentation';

import style from './style.module.css';
import { useLocation, useNavigate } from 'react-router-dom';

// Half second delay (500 ms) to process changes in the search bar
const DEBOUNCE_DELAY = 500;

// define non-changing props
const inputProps = { 'aria-label': 'Search projects by text' };

// This function is never called directly, but it is called indirectly by calling "debouncedUpdateLocation"
export const updateLocation = (location, history, value) => {
  const { search, ...nextSearchObject } = parse(location.search, {
    ignoreQueryPrefix: true,
  });
  // If should replace it would be like a history.replace
  // Otheriwse it would be like a history.push
  const shouldReplace = Boolean(search) === Boolean(value);
  if (value) nextSearchObject.search = value;
  if (search === value) return;
  // If this search is different to the previous search
  // Reset page to the first page
  nextSearchObject.page = undefined;
  // Update history
  history({
    ...location,
    search: stringify(nextSearchObject),
    replace: shouldReplace,
  });
};

// "debounce" is a method from the "lodash" library that invokes a function after a time delay
// debounced functions are cancellable before the time delay has passed
// debounced function, to avoid changing the URL too much while typing
const debouncedUpdateLocation = debounce(updateLocation, DEBOUNCE_DELAY);

// This function is called each time that a letter is typed in the search bar
const Search = () => {
  // Get the history and the location
  const location = useLocation();
  const history = useNavigate();
  // Here, parse converts a query formatted search (e.g. "?search=x") in a string only with the text search (e.g. "x")
  // Return the parsed searh text (value) and a function to change this value (SetValue)
  const [value, setValue] = useState(
    parse(location.search, { ignoreQueryPrefix: true }).search,
  );
  // Cancel the last debouncedUpdateLocation if it has not been executed yet because there is a new change
  useEffect(() => debouncedUpdateLocation.cancel, []);
  // Update the state and the query search in the URL with the new searched value
  const handleChange = useCallback(
    ({ target: { value } }) => {
      setValue(value);
      debouncedUpdateLocation(location, history, value);
    },
    [location, history],
  );
  const doc = docs.find(doc => doc.id === 'browser');

  return (
    <span className={style.searchbar}>
      {/* Render the lens icon */}
      <Icon className={style.rightmargin}>
        <FontAwesomeIcon
          icon={faSearch}
          className={value && style['search-active']}
        />
      </Icon>
      {/* Render the search bar text field */}
      <TextField
        title={doc.text}
        value={value || ''}
        onChange={handleChange}
        className={style.search}
        inputProps={inputProps}
        placeholder={'e.g. Orozco lab'}
      />
    </span>
  );
};

export default Search;
