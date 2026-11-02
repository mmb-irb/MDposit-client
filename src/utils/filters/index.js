// Build and parse the API 'filter' and 'return' arguments
// Fields are passed to the API by their alias when they have one (e.g. 'type' instead of 'metadata.TYPE')
// Aliases are defined in the query fields of the MDDB database
// Every filter is one or several conditions separated by ';', which are matched if any condition matches
// Every condition is a field, an operator and one or several values separated by ',' (e.g. "type=eq='ensemble','md'")
// Text values are quoted with single quotes, so they may include any character, while numbers and booleans are not
// An empty value with '=eq=' or '=ne=' stands for fields with no value (e.g. 'pdbId=eq=')
// This syntax relies on characters which do not need to be percent encoded in URLs, so filters remain readable
import { stringify } from 'qs';
import { PATH_QUERY_FIELDS, ALIAS_QUERY_FIELDS } from 'mddb-database/utils/constants';

// Set the separator of several conditions in a single filter
export const CONDITIONS_SEPARATOR = ';';
// Set the separator of several values in a single condition
export const VALUES_SEPARATOR = ',';
// Set the character used to quote text values and the character to escape characters inside quotes
const QUOTE = "'";
const ESCAPE = '\\';

// The client handles operators by their symbols, while URLs use operator words
// Note that the API supports both
const OPERATOR_WORDS = {
  '==': '=eq=',
  '!=': '=ne=',
  '~=': '=ct=',
  '!~=': '=nc=',
  '>': '=gt=',
  '>=': '=ge=',
  '<': '=lt=',
  '<=': '=le=',
};
// Set the symbol of every operator name, both words and symbols
// Names are sorted from the longest to the shortest so they are not confused when parsing (e.g. '>=' and '>')
const OPERATOR_SYMBOLS = Object.fromEntries([
  ...Object.keys(OPERATOR_WORDS).map(symbol => [symbol, symbol]),
  ...Object.entries(OPERATOR_WORDS).map(([symbol, word]) => [word, symbol]),
]);
const OPERATOR_NAMES = Object.keys(OPERATOR_SYMBOLS).sort((a, b) => b.length - a.length);

// Field names are alphanumeric words separated by dots
const FIELD_PATTERN = /^[A-Za-z0-9_.]+/;

// Get the alias of a field given its path
// Fields with no alias (e.g. 'metadata.SNAPSHOTS') are passed by their path, which the API supports as well
export const getAlias = path => {
  const queryField = PATH_QUERY_FIELDS[path];
  return queryField ? queryField.alias : path;
};

// Get the path of a field given its alias or its path
// Fields which are not among the query fields are taken as paths
export const getPath = name => {
  const queryField = ALIAS_QUERY_FIELDS[name] || PATH_QUERY_FIELDS[name];
  return queryField ? queryField.path : name;
};

// Format a value for a filter
// Texts are quoted, numbers and booleans are not, and null stands for fields with no value
export const formatValue = value => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return QUOTE + String(value).replace(/[\\']/g, character => ESCAPE + character) + QUOTE;
};

// Build a single condition filter given the field path, the operator symbol and the value or values
export const buildFilter = (path, operator, values) => {
  const word = OPERATOR_WORDS[operator];
  if (!word) throw new Error(`Unknown filter operator "${operator}"`);
  const valuesList = Array.isArray(values) ? values : [values];
  return `${getAlias(path)}${word}${valuesList.map(formatValue).join(VALUES_SEPARATOR)}`;
};

// Join several conditions in a single filter, which is matched if any condition matches
export const joinConditions = conditions => conditions.join(CONDITIONS_SEPARATOR);

// Build the URL query string of fields to be returned given their paths
export const buildReturn = paths => paths.map(path => 'return=' + getAlias(path)).join('&');

// Parse a filter string back to its conditions
// Every condition has its field path, operator symbol and values
// Fields may be passed by their alias or by their path, and operators by their word or their symbol
// Values are always returned as texts, or null for empty values
// Return null if the filter is not valid
export const parseFilter = filter => {
  if (typeof filter !== 'string') return null;
  const conditions = [];
  let position = 0;
  const skipSpaces = () => {
    while (position < filter.length && /\s/.test(filter[position])) position++;
  };
  while (true) {
    // Read the field and the operator
    skipSpaces();
    const fieldMatch = filter.slice(position).match(FIELD_PATTERN);
    if (!fieldMatch) return null;
    const fieldName = fieldMatch[0];
    position += fieldName.length;
    const path = getPath(fieldName);
    skipSpaces();
    const operatorName = OPERATOR_NAMES.find(name => filter.startsWith(name, position));
    if (!operatorName) return null;
    position += operatorName.length;
    // Read the values
    const values = [];
    while (true) {
      skipSpaces();
      if (filter[position] === QUOTE) {
        let text = '';
        position++;
        while (position < filter.length && filter[position] !== QUOTE) {
          if (filter[position] === ESCAPE) position++;
          if (position < filter.length) text += filter[position];
          position++;
        }
        if (position >= filter.length) return null;
        position++;
        skipSpaces();
        values.push(text);
      }
      else {
        const start = position;
        while (position < filter.length && filter[position] !== VALUES_SEPARATOR
          && filter[position] !== CONDITIONS_SEPARATOR) position++;
        const text = filter.slice(start, position).trim();
        values.push(text === '' ? null : text);
      }
      if (filter[position] !== VALUES_SEPARATOR) break;
      position++;
    }
    conditions.push({ path, operator: OPERATOR_SYMBOLS[operatorName], values });
    if (position >= filter.length) return conditions;
    if (filter[position] !== CONDITIONS_SEPARATOR) return null;
    position++;
  }
};

// Get the filter argument from the URL as a list of filters
// It may be missing, a single filter or a list of filters
export const getFiltersList = filters => {
  if (filters === undefined || filters === null || filters === '') return [];
  if (Array.isArray(filters)) return [...filters];
  return [filters];
};

// Encode URL query parameters leaving the filter characters which are safe in URLs as they are
// Note that encodeURIComponent already leaves letters, numbers and - _ . ! ~ * ' ( ) as they are
// Characters which change the meaning of the URL (e.g. '&', '#', '+', '%' or '?') are always encoded
const SAFE_ENCODED_CHARACTERS = /%(3D|2C|3B|3A)/g;
const encodeQueryComponent = string => encodeURIComponent(string)
  .replace(SAFE_ENCODED_CHARACTERS, decodeURIComponent);

// Build the URL query string of an object of parameters
// Lists are passed as repeated parameters (e.g. 'filter=a&filter=b')
export const stringifyQuery = parameters => stringify(parameters, {
  arrayFormat: 'repeat',
  encoder: string => encodeQueryComponent(String(string)),
});
