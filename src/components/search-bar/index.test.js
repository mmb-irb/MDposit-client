import { updateLocation } from '.';

describe('updateLocation', () => {
  it('replaces the history entry while the search text is being edited', () => {
    const history = jest.fn();
    updateLocation({ pathname: '/browse', search: '?search=kin' }, history, 'kinase');
    expect(history).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/browse', search: 'search=kinase' }),
      { replace: true },
    );
  });

  it('pushes a new history entry when a search starts', () => {
    const history = jest.fn();
    updateLocation({ pathname: '/browse', search: '' }, history, 'kinase');
    expect(history).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/browse', search: 'search=kinase' }),
      { replace: false },
    );
  });
});
