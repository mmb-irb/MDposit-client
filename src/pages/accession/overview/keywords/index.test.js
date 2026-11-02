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

// Browse URL filtering by one keyword, as the custom search builds it
const browseHref = keyword => `/browse?filter=keyword=eq='${encodeURIComponent(keyword)}'`;

describe('<SystemKeywords />', () => {
  it('shows each keyword as a link to Browse filtered by it', () => {
    renderKeywords(['protein', 'non-counter ion', 'double strand rna']);
    const links = screen.getAllByRole('link');
    expect(links.map(link => link.textContent)).toEqual(['Protein', 'Non-counter ion', 'Double strand RNA']);
    expect(links.map(link => link.getAttribute('href'))).toEqual(
      ['protein', 'non-counter ion', 'double strand rna'].map(browseHref),
    );
  });

  it('links to the keyword as stored, whatever its case', () => {
    renderKeywords(['DNA', 'Membrane']);
    const links = screen.getAllByRole('link');
    expect(links.map(link => link.textContent)).toEqual(['DNA', 'Membrane']);
    expect(links.map(link => link.getAttribute('href'))).toEqual(['DNA', 'Membrane'].map(browseHref));
  });

  it('accepts a single keyword stored as a string', () => {
    renderKeywords('membrane');
    expect(screen.getByRole('link').textContent).toBe('Membrane');
    expect(screen.getByText('Keywords')).toBeTruthy();
  });

  it('skips empty, repeated and non-string values', () => {
    renderKeywords(['lipid', '', '  ', null, 3, { name: 'x' }, 'lipid']);
    expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual(['Lipid']);
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
