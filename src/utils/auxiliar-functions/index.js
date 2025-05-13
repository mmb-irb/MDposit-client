import chroma from 'chroma-js';
import { range } from 'lodash-es';

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

// A class for handling versions
export class Version {
    constructor (versionString) {
        // If there is no version then consider it the 0.0.0
        if (versionString === undefined) versionString = '0.0.0';
        // Get the major, minor and patch versions
        const splits = versionString.split('.');
        this.major = splits[0] && +splits[0];
        this.minor = splits[1] && +splits[1];
        this.patch = splits[2] && +splits[2];
    }

    // Get the version back in string format
    // This has also an effect in the console-log display
    toString () {
        let string = this.major.toString();
        if (this.minor === undefined) return string;
        string += '.' + this.minor.toString();
        if (this.patch === undefined) return string;
        string += '.' + this.patch.toString();
        return string;
    }

    // Check if two versions are equal
    equals (other) {
        // If this is a string instead of a version the parse it
        if (typeof other === 'string') return this.equals(new Version(other));
        // Check if versions are equal for all major, minor and patch versions
        // If other version has not explicit patch or minor version then they are not compared
        if (other.major !== this.major) return false;
        if (other.minor !== undefined && other.minor !== this.minor) return false;
        if (other.patch !== undefined && other.patch !== this.patch) return false;
        return true;
    }
}