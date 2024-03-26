// Given an array of strings, return a single string with the follwoing format:
// e.g. ['red', 'green', 'blue'] => 'red, green and blue'
// Handle when the values is a string instead of an array (old values)
export const prettyEnumerate = array => {
    if (typeof array === 'string') return array;
    if (array.length === 0) return '';
    if (array.length === 1) return array[0];
    return `${array.slice(0, array.length - 1).join(', ')} and ${array[array.length - 1]}`;
}

// Just separte values by semicolons
// Handle when the values is a string instead of an array (old values)
export const rawEnumerate = array => {
    if (typeof array === 'string') return array;
    return array.join('; ');
}