import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import useAPI from '../../hooks/use-api';
import CollectionBrowser from '.';

vi.mock('../../hooks/use-api', () => ({ default: vi.fn() }));
vi.mock('./row', () => ({ default: ({ data }) => <tr><td>{`Row ${data.id}`}</td></tr> }));
vi.mock('src/components/search-bar', () => ({ default: () => null }));
vi.mock('../../components/pagination', () => ({ default: ({ matchCount }) => <tr><td>{`${matchCount} matches`}</td></tr> }));

const renderWith = (payload, search) => {
  useAPI.mockReturnValue({ loading: false, payload, error: null });
  return render(
    <MemoryRouter initialEntries={[`/collections${search}`]}>
      <CollectionBrowser />
    </MemoryRouter>
  );
};

afterEach(cleanup);

describe('CollectionBrowser', () => {
  it('lists the collections found by the search', () => {
    renderWith({ referencesCount: 1, references: [{ id: 'AB-DB', name: 'AB-DB' }] }, '?search=ab');
    expect(screen.getByText('Row AB-DB')).toBeTruthy();
    expect(screen.queryByText('No results were found')).toBeNull();
  });

  // The API answers a search with no matches with an empty list, not with an error
  it('shows a no results message when the search matches no collection', () => {
    renderWith({ referencesCount: 0, references: [] }, '?search=wtf');
    expect(screen.getByText('No results were found')).toBeTruthy();
    expect(screen.queryByText(/^Row /)).toBeNull();
    expect(screen.getByText('0 matches')).toBeTruthy();
  });
});
