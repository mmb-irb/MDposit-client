// Function involved in getting text pixels width
// WARNING: These functions do not work properly in Chrome (not an easy problem)

// This function allows to calculate the width of a given string text
// The font for the calculation in the d3 default font
export const getTextWidth = (text, font = 'bold 10px sans-serif') => {
  const canvas =
    getTextWidth.canvas ||
    (getTextWidth.canvas = document.createElement('canvas'));
  const context = canvas.getContext('2d');
  context.font = font;
  const metrics = context.measureText(text);
  return metrics.width;
};

// Alternative way to obtain text width
// Probably the only way to obtain text height
export const getTextSizeDOM = (text, font = 'bold 10px sans-serif') => {
  const element = document.createElement('div');
  const content = document.createTextNode(text);
  element.appendChild(content);
  Object.assign(element.style, {
    font: font,
    position: 'absolute',
    visibility: 'hidden',
    height: 'auto',
    width: 'auto',
    'white-space': 'nowrap',
  });
  document.body.appendChild(element);
  return { width: element.clientWidth, height: element.clientHeight };
};

// Get the whole body width
export const getBodyWidth = () => {
  return Math.max(
    document.body.scrollWidth,
    document.documentElement.scrollWidth,
    document.body.offsetWidth,
    document.documentElement.offsetWidth,
    document.documentElement.clientWidth,
  );
};

// Get the whole body height
export const getBodyHeight = () => {
  return Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight,
    document.documentElement.clientHeight,
  );
};
