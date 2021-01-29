// Statistics
// Provide some usual statistics functions

// Set a function which returns just the average
export const getMean = data => {
  if (!data) return;
  const sum = data.reduce((pv, cv) => pv + cv, 0);
  const n = data.length;
  return sum / n;
};

// Set a function which returns the average and standard deviation from a numeric array
export const getMeanAndStdv = data => {
  if (!data) return;
  const sum = data.reduce((pv, cv) => pv + cv, 0);
  const n = data.length;
  const mean = sum / n;
  const stdv = Math.sqrt(
    data.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n,
  );
  return { mean, stdv };
};
