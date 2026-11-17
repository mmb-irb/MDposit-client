import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import SystemKeywords from '.';

afterEach(cleanup);

const renderKeywords = keywords =>
  render(
    <MemoryRouter>
      <SystemKeywords keywords={keywords} />
    </MemoryRouter>,
  );

// Get the text of every rendered keyword chip
const chipLabels = container =>
  [...container.querySelectorAll('.MuiChip-label')].map(label => label.textContent);

describe('<SystemKeywords />', () => {
  it('shows each keyword as a chip with a formatted label', () => {
    const { container } = renderKeywords(['protein', 'non-counter ion', 'double strand rna']);
    expect(chipLabels(container)).toEqual(['Protein', 'Non-counter ion', 'Double strand RNA']);
  });

  it('does not make the keywords links', () => {
    renderKeywords(['DNA', 'Membrane']);
    expect(screen.queryAllByRole('link')).toEqual([]);
    expect(screen.queryAllByRole('button')).toEqual([]);
  });

  it('accepts a single keyword stored as a string', () => {
    const { container } = renderKeywords('membrane');
    expect(chipLabels(container)).toEqual(['Membrane']);
  });

  it('skips empty, repeated and non-string values', () => {
    const { container } = renderKeywords(['lipid', '', '  ', null, 3, { name: 'x' }, 'lipid']);
    expect(chipLabels(container)).toEqual(['Lipid']);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['an empty list', []],
    ['an empty string', ''],
    ['an object', {}],
    ['a list without strings', [null, 1]],
  ])('renders nothing when the keywords are %s', (_, keywords) => {
    const { container } = renderKeywords(keywords);
    expect(container.innerHTML).toBe('');
  });
});
