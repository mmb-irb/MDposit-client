import { isCurrentLocation } from '.';

describe('isCurrentLocation', () => {
  it('matches the same parameters despite a different encoding or order', () => {
    const location = { pathname: '/browse', search: "?search=kin&filter=node%3Deq%3D%27mmb%27%2C%27inria%27" };
    expect(isCurrentLocation("/browse?filter=node=eq='mmb','inria'&search=kin", location)).toBe(true);
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
