import { isCurrentLocation } from '.';

describe('isCurrentLocation', () => {
  it('matches the same parameters despite a different encoding or order', () => {
    const location = { pathname: '/browse', search: '?search=kin&query=%7B%22a%22%3A1%7D' };
    expect(isCurrentLocation('/browse?query={"a":1}&search=kin', location)).toBe(true);
  });

  it('matches an empty search', () => {
    expect(isCurrentLocation('/browse?', { pathname: '/browse', search: '' })).toBe(true);
  });

  it('does not match when a parameter changes', () => {
    const location = { pathname: '/browse', search: '?search=kin' };
    expect(isCurrentLocation('/browse?search=kinase', location)).toBe(false);
  });

  it('does not match a different path', () => {
    const location = { pathname: '/', search: '?search=kin' };
    expect(isCurrentLocation('/browse?search=kin', location)).toBe(false);
  });
});
