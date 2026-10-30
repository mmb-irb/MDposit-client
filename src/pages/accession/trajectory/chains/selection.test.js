import {
  parseHighlight,
  formatHighlight,
  clickSelection,
  shiftSequence,
} from './selection';

// Simulate a sequence of clicks, each one with the clicked ranges and the keys held
const clickAll = clicks => {
  let state = { selection: [], anchor: null, base: [] };
  for (const { clicked, shift = false, add = false } of clicks)
    state = clickSelection({ current: state.selection, clicked, anchor: state.anchor, base: state.base, shift, add });
  return formatHighlight(state.selection);
};

describe('Chain analysis selection', () => {
  it('parses and formats highlights', () => {
    expect(parseHighlight(null)).toEqual([]);
    expect(parseHighlight('10:10,25:40')).toEqual([[10, 10], [25, 40]]);
    expect(formatHighlight([])).toBe(null);
    // Overlapping and contiguous ranges are merged
    expect(formatHighlight([[25, 40], [10, 12], [13, 15], [30, 50]])).toBe('10:15,25:50');
  });

  it('selects only the clicked residue or feature on a plain click', () => {
    expect(clickAll([{ clicked: [[10, 10]] }, { clicked: [[20, 20]] }])).toBe('20:20');
    expect(clickAll([{ clicked: [[10, 10]] }, { clicked: [[30, 40], [50, 60]] }])).toBe('30:40,50:60');
  });

  it('selects a range with shift click', () => {
    expect(clickAll([{ clicked: [[10, 10]] }, { clicked: [[40, 40]], shift: true }])).toBe('10:40');
    // Backwards
    expect(clickAll([{ clicked: [[40, 40]] }, { clicked: [[10, 10]], shift: true }])).toBe('10:40');
    // A further shift click moves the end of the range, it may also shrink
    expect(clickAll([
      { clicked: [[10, 10]] },
      { clicked: [[40, 40]], shift: true },
      { clicked: [[20, 20]], shift: true },
    ])).toBe('10:20');
  });

  it('adds non contiguous regions with ctrl click', () => {
    expect(clickAll([
      { clicked: [[10, 10]] },
      { clicked: [[40, 40]], shift: true },
      { clicked: [[60, 60]], add: true },
      { clicked: [[70, 70]], shift: true },
    ])).toBe('10:40,60:70');
    // Features are added as a whole
    expect(clickAll([{ clicked: [[10, 10]] }, { clicked: [[30, 40]], add: true }])).toBe('10:10,30:40');
  });

  it('adds the clicked residue on shift click when there is no anchor', () => {
    expect(clickAll([{ clicked: [[30, 40]] }, { clicked: [[50, 50]], shift: true }])).toBe('30:40,50:50');
  });

  // The same click may be handled twice, so repeating it must not change the selection
  it('is stable when the same click is repeated', () => {
    expect(clickAll([
      { clicked: [[10, 10]] },
      { clicked: [[60, 60]], add: true },
      { clicked: [[60, 60]], add: true },
      { clicked: [[70, 70]], shift: true },
      { clicked: [[70, 70]], shift: true },
    ])).toBe('10:10,60:70');
  });

  // Positions must match the residue numbers in the ruler and the InterPro features
  // e.g. the first residue (number 1) is displayed at position 1
  it('displays the first residue at the position of the first residue number', () => {
    expect(shiftSequence('MSH', 1)).toBe('MSH');
    expect(shiftSequence('MSH', 3)).toBe('  MSH');
  });
});
