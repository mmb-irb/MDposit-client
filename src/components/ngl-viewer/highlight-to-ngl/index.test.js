import highlightToNgl from '.';

// Fake topology with chain A residues numbered from 1 to 300
const topologyManager = {
  getResidueByParameters: (chainName, number) => {
    if (!(number >= 1 && number <= 300))
      throw new Error(`Residue with chain ${chainName}, number ${number} and no icode does not exist`);
    return { chainName, number };
  },
};

describe('Nightingale highlight to NGL selection', () => {
  it('converts a single range', () => {
    expect(highlightToNgl(topologyManager, 'A', '101:117')).toBe(':A and 101-117');
    expect(highlightToNgl(topologyManager, 'A', '100:100')).toBe(':A and 100-100');
  });

  // Shift and ctrl clicks select several regions, which must all be displayed
  it('converts several non contiguous ranges', () => {
    expect(highlightToNgl(topologyManager, 'A', '100:100,107:107,118:118'))
      .toBe(':A and 100-100 or :A and 107-107 or :A and 118-118');
    expect(highlightToNgl(topologyManager, 'A', '10:40,60:70'))
      .toBe(':A and 10-40 or :A and 60-70');
  });
});
