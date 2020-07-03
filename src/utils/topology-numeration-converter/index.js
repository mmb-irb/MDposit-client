// Functions to handle numeric conversions

// This function converts absolute residue numbers (0,1,... n) to topology residue numbers (17, 18, 17...)
export const absolute2topologyResidue = (topology, residue) => {
  const relativeresidue = topology.file.residueStore.resno[residue];
  //console.log(residue + ' => ' + relativeresidue);
  return relativeresidue;
};

// Get first atom number from resiude number
export const residue2atom = (topology, residue) => {
  const atom = topology.file.residueStore.atomOffset[residue - 1] + 1;
  //console.log(residue + ' => ' + atom);
  return atom;
};
