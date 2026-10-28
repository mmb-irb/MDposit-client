import React from 'react';

// Describe an atom in the tooltips of the molecular viewers (NGL and MolStar)
// The atom index is a whole system index and the residue is a topology manager residue
const AtomDescription = ({ atomIndex, atomName, residueName, residue }) => {
  const chainName = residue.chain.metadataChainName;
  // Get the residue reference id
  const referenceId = residue.referenceId;
  return (
    <>
      {`Atom ${atomIndex} (${atomName})
        Chain ${residue.chainName} ${chainName ? '(' + chainName + ')' : ''}
        Residue ${residue.number} (${residueName})`}
      {(() => {
        // If there is not reference at all it means it is not even a protein
        if (!referenceId) return;
        // No referable flag is for proteins which are not to be referenced
        // e.g. antibodies, synthetic constructs, etc.
        if (referenceId === 'noref') return (
          <div style={{ color: 'orange' }}>{'No referable'}</div>
        );
        // The not found flag is for proteins which failed to be aligned in a blast
        if (referenceId === 'notfound') return (
          <div style={{ color: 'salmon' }}>{'Reference not found'}</div>
        );
        // If the reference is missing in the database then show a disclaimer
        if (residue.referenceData === null) return (
          <div style={{ color: 'red' }}>{`Missing data for ${referenceId}`}</div>
        );
        // Show the reference and its residue references number
        return (
          <div>
            <div style={{ color: 'lightGreen' }}>{residue.referenceName}</div>
            {residue.referenceType === 'protein' && <div>{`- Residue ${residue.referenceNumber}`}</div>}
          </div>
        )
      })()}
    </>
  );
};

export default AtomDescription;
