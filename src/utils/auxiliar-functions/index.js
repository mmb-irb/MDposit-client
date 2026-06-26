import chroma from 'chroma-js';
import { range } from 'lodash-es';
import { parse } from 'qs';

// Createa a copy from an object thus not conserving any pointer to the original object contents
export const copyObject = object => JSON.parse(JSON.stringify(object));

// Add values
export const add = values => values.reduce((acc, curr) => acc + curr, 0);
// Get the average from a list of values
export const caluclateAverage = values => add(values) / values.length;

// Round a number to its neares cent
export const round2cents = number => Math.round(number * 100) / 100;

// Count the number of specific elements in an array
export const countElement = (array, target) => array.reduce((total, value) => value == target ? total + 1: total, 0);

// Get unique values in an array
export const unique = array => Array.from(new Set(array));

// Find the maximum value in a list
// Using the reduce function we can handle very large arrays, while Math.max can not
export const max = array => array.reduce((cv, nv) => Math.max(cv, nv), -Infinity);

// Find the minimum value in a list
// Using the reduce function we can handle very large arrays, while Math.min can not
export const min = array => array.reduce((cv, nv) => Math.min(cv, nv), Infinity);

// Create palettes of random spaced colors
export const createPalette = colorCount => {
    const colors = [];
    for (let i = 0; i < colorCount; i++) {
        const color = chroma.hcl(i / colorCount * 360, 80, 70).css();
        colors.push(color);
    }
    return colors;
};

// Join 2 ArrayBuffer
// https://stackoverflow.com/questions/10786128/appending-arraybuffers
export const appendBuffer = (buffer1, buffer2) => {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
}

// This function transforms a range selection string into a numeric array
// It handles abbreviated selection syntax to literal selection syntax
// e.g. "1, 3, 5-8" => [1, 3, 5, 6, 7, 8]
const rangedSyntax = /^([0-9]*)-([0-9]*)$/;
export const rangedSelectionParser = selection => {
  // Filter data
  const units = selection.split(', ');
  const parsedSelection = [];
  for (const u of units) {
    // If the ranged syntax is found, get all numbers in between
    if (u.match(rangedSyntax)) {
      const matches = rangedSyntax.exec(u);
      const rangedUnits = range(+matches[1], +matches[2] + 1);
      parsedSelection.push(...rangedUnits);
    } else parsedSelection.push(+u);
  }
  return parsedSelection;
};

// Do the opposite that the previous function
// e.g. [1, 3, 5, 6, 7, 8] => "1, 3, 5-8"
// In addition track the minimum serie length
// Return 'small' = true when there are series of 3 residues or less
// These small residue selections will be not represented in cartoon due to an NGL bug
// https://github.com/nglviewer/ngl/issues/223
export const parsedSelectionRanger = (selection, addWhiteSpaces = true) => {
  const separator = addWhiteSpaces ? ', ' : ',';
  let rangedSelection = '';
  let minimumSerieLength = Number.POSITIVE_INFINITY;
  selection.sort((a, b) => a - b); // Sort numbers numerically
  const selectionLength = selection.length;
  // When the selection is a single value
  if (selectionLength === 1) {
    return { rangedSelection: selection[0].toString(), small: true };
  }
  for (let i = 0; i < selectionLength; i++) {
    const num = selection[i];
    rangedSelection += separator + num;
    for (let j = i + 1; j < selectionLength; j++) {
      const nextNum = selection[j];
      let length = j - i; // The serie length
      if (nextNum - num !== length) {
        // End of the serie
        // The length here is the length which broke the serie
        // i.e. if the length here is 2 the actual serie length is 1
        length -= 1;
        minimumSerieLength = Math.min(length, minimumSerieLength);
        // If the length of the serie is <= 1 then no worth making a range here
        if (length > 1) {
          const prevNum = selection[j - 1];
          rangedSelection += '-' + prevNum;
          i = j - 1;
        }
        break;
      }
      if (j === selectionLength - 1) {
        // End of the selection
        minimumSerieLength = Math.min(length, minimumSerieLength);
        if (length > 1) {
          rangedSelection += '-' + nextNum;
          i = j;
        }
      }
    }
  }
  const small = minimumSerieLength <= 3;
  rangedSelection = rangedSelection.substring(separator.length); // Remove the first separator
  return { rangedSelection, small };
};

// Given an array of numbers, yield those number which are in a row
// e.g. [1, 3, 5, 6, 7, 8] => [1], [3], [5, 6, 7, 8]
export function* generateRanges (selection) {
  // Sort selection numbers numerically
  selection.sort((a, b) => a - b);
  // When there is no selection at all
  const selectionLength = selection.length;
  if (selectionLength === 0) return;
  // When the selection is a single value
  let currentRange = [ selection[0] ];
  if (selectionLength === 1) return yield currentRange;
  // Now iterate numbers in the selection
  for (let i = 1; i < selectionLength; i++) {
    const num = selection[i];
    const prevNum = selection[i-1];
    // If this is the next natural number then add it to the range and continue
    if (num === prevNum + 1) {
      currentRange.push(num);
      continue;
    }
    // This is the end of the range otherwise
    yield currentRange;
    currentRange = [ num ];
  }
  // Yield the last range
  yield currentRange;
};

// Convert the URL string into an object
// This "parse" comes from the "qs" library
// WARNING: The default "parse" decoding behaviour has a strong conflict between '+' and blank space character
// This workaround first decodes and then parses without decoding
// The 'decoder' option is necessary for not decoding
export const parseLocationSearch = locationSearch => {
  const decoded = decodeURIComponent(locationSearch);
  return parse(decoded, { ignoreQueryPrefix: true, decoder: c => c });
}

// Utility to build projection query string for options endpoints
export function buildProjectionQuery(fields) {
  const projectionStrings = fields.filter(field => field.options).map(field => 'projection=' + field.path);
  return projectionStrings.join('&');
}
// Check if an object is empty
export const isEmptyObj = obj => obj && Object.keys(obj).length === 0;

// Compare sets for equality
export const areSetsEqual = (a, b) => a.size === b.size && [...a].every(v => b.has(v));
// Compare arrays for having the same values
// Note that we do not care about duplicates or order
export const sameValues = (a, b) => areSetsEqual(new Set(a), new Set(b));

// Format bytes to human-readable string
export const formatBytes = (bytes) => {
    if (bytes === 0) return '0 bytes';
    const k = 1000;
    const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};