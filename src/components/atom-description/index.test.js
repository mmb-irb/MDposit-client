import React from 'react';
import { render } from '@testing-library/react';

import AtomDescription from '.';

const residue = {
  chainName: 'A',
  chain: { metadataChainName: 'Spike' },
  number: 64,
  referenceId: 'P0DTC2',
  referenceData: {},
  referenceName: 'Spike glycoprotein',
  referenceType: 'protein',
  referenceNumber: 60,
};

describe('<AtomDescription />', () => {
  it('describes the atom, its chain, residue and residue reference', () => {
    const { container } = render(
      <AtomDescription atomIndex={1234} atomName="CA" residueName="HIS" residue={residue} />,
    );
    const text = container.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('Atom 1234 (CA)');
    expect(text).toContain('Chain A (Spike)');
    expect(text).toContain('Residue 64 (HIS)');
    expect(text).toContain('Spike glycoprotein');
    expect(text).toContain('- Residue 60');
  });

  it('tells when the residue has no reference', () => {
    const { container } = render(
      <AtomDescription atomIndex={1} atomName="N" residueName="ALA" residue={{ ...residue, referenceId: 'noref' }} />,
    );
    expect(container.textContent).toContain('No referable');
  });
});
