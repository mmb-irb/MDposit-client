// The colour of text and lines. Black is not visible in dark mode, so it is the text colour of the theme
export const INK = 'var(--mui-palette-text-primary)';

// Replace black (or no colour at all) by the ink, so a series defined as black is visible in both modes
const ink = color => (!color || color === 'black' ? INK : color);

export default ink;
