// Createa a copy from an object thus not conserving any pointer to the original object contents
export const copyObject = object => JSON.parse(JSON.stringify(object));

// Get the average from a list of values
export const caluclateAverage = values => {
    const addition = values.reduce((acc, curr) => acc + curr, 0);
    return addition / values.length;
}