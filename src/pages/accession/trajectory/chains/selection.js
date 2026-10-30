// Nightingale keeps the selection (highlight) as a string of position ranges (e.g. "10:10,25:40")

// Parse a highlight string into a list of [start, end] ranges
export const parseHighlight = highlight => {
  if (!highlight) return [];
  return highlight.split(',').map(range => range.split(':').map(Number));
};

// Sort the ranges and join those which overlap or are contiguous
export const mergeRanges = ranges => {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
};

// Format a list of ranges back into a highlight string
export const formatHighlight = ranges => {
  if (ranges.length === 0) return null;
  return mergeRanges(ranges).map(([start, end]) => `${start}:${end}`).join(',');
};

// Set the new selection after a click, given the clicked ranges and the keys held
// The selection works as in a text editor:
// - Plain click: select only the clicked residue or feature
// - Shift + click: select from the last clicked residue (the anchor) to this one
// - Ctrl/Cmd + click: add the clicked residue or feature to the current selection
// The base is the selection before the anchor was set, so a shift click may also shrink the range
export const clickSelection = ({ current, clicked, anchor, base, shift, add }) => {
  // The anchor is a single residue, so clicking a whole feature does not set it
  const clickedResidue = clicked.length === 1 && clicked[0][0] === clicked[0][1]
    ? clicked[0][0]
    : null;
  if (shift && anchor !== null && clickedResidue !== null) {
    const range = [Math.min(anchor, clickedResidue), Math.max(anchor, clickedResidue)];
    return { selection: mergeRanges([...base, range]), anchor, base };
  }
  if (shift || add) {
    const selection = mergeRanges([...current, ...clicked]);
    return { selection, anchor: clickedResidue, base: current };
  }
  return { selection: mergeRanges(clicked), anchor: clickedResidue, base: [] };
};

// Offset the sequence so its first residue is displayed at the position of the first residue number
// Nightingale positions start at 1 and sequence components have no argument for this
export const shiftSequence = (sequence, firstResidueNumber) =>
  ' '.repeat(firstResidueNumber - 1) + sequence;

