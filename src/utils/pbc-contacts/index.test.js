import { getPbcContactsWarning, canShowPbcContacts, getContactImages } from '.';

const pbcWarning = {
  tag: 'pbcontacts', frame: 3, selection_a: { at: [1] }, selection_b: { at: [[4, 6]] }, images: [0, 1, 0],
};

describe('getPbcContactsWarning', () => {
  it('returns the first PBC contacts warning', () => {
    const repeated = { ...pbcWarning, frame: 7 };
    const metadata = { WARNINGS: [{ tag: 'other' }, pbcWarning, repeated] };
    expect(getPbcContactsWarning(metadata)).toBe(pbcWarning);
  });

  it('returns null when there are no warnings', () => {
    expect(getPbcContactsWarning({})).toBeNull();
    expect(getPbcContactsWarning({ WARNINGS: [{ tag: 'other' }] })).toBeNull();
  });
});

describe('canShowPbcContacts', () => {
  it('requires both the warning and the box', () => {
    expect(canShowPbcContacts({ WARNINGS: [pbcWarning], BOX: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] })).toBe(true);
    expect(canShowPbcContacts({ WARNINGS: [pbcWarning], BOX: 'dyn' })).toBe(true);
    expect(canShowPbcContacts({ WARNINGS: [pbcWarning], BOX: null })).toBe(false);
    expect(canShowPbcContacts({ WARNINGS: [], BOX: 'dyn' })).toBe(false);
  });
});

describe('getContactImages', () => {
  const box = [[10, 0, 0], [1, 20, 0], [0, 2, 30]];

  it('translates the system by the images vector in both directions', () => {
    expect(getContactImages(box, [0, 1, 0])).toEqual({
      forward: { label: '+y', translation: [1, 20, 0] },
      backward: { label: '-y', translation: [-1, -20, 0] },
    });
  });

  it('accepts flat box vectors and combines vectors with their signs', () => {
    expect(getContactImages(box.flat(), [1, 0, -1])).toEqual({
      forward: { label: '+x-z', translation: [10, -2, -30] },
      backward: { label: '-x+z', translation: [-10, 2, 30] },
    });
  });

  it('fails with invalid images', () => {
    expect(() => getContactImages(box, [0, 0, 0])).toThrow();
    expect(() => getContactImages(box, [false, true, false])).toThrow();
    expect(() => getContactImages(box, [0, 2, 0])).toThrow();
  });
});
