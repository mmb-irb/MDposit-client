import chroma from 'chroma-js';

// Createa a copy from an object thus not conserving any pointer to the original object contents
export const copyObject = object => JSON.parse(JSON.stringify(object));

// Get the average from a list of values
export const caluclateAverage = values => {
    const addition = values.reduce((acc, curr) => acc + curr, 0);
    return addition / values.length;
}

// Round a number to its neares cent
export const round2cents = number => Math.round(number * 100) / 100;

// Create palettes of random spaced colors
export const createPalette = colorCount => {
    const colors = [];
    for (let i = 0; i < colorCount; i++) {
        const color = chroma.hcl(i / colorCount * 360, 80, 70).css();
        colors.push(color);
    }
    return colors;
};