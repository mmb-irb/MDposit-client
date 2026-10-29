// Structure formats the API may return from the /structure endpoint
// The client does not ask for any format in particular, so both viewers (NGL and molstar) find it out
// from the downloaded text itself
export const PDB = 'pdb';
export const MMCIF = 'mmcif';

// Find out the format of a structure from its first lines
// mmCIF files always start with a 'data_' block header, which may only be preceded by comments or empty lines
// PDB files start with any record (HEADER, REMARK, CRYST1, MODEL, ATOM...), but never with 'data_'
export const getStructureFormat = text => {
  let start = 0;
  while (start < text.length) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = text.length;
    const line = text.slice(start, end).trim();
    start = end + 1;
    if (line === '' || line.startsWith('#')) continue;
    return line.startsWith('data_') ? MMCIF : PDB;
  }
  throw new Error('The structure is empty');
};
