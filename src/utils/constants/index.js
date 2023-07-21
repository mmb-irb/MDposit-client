export const BASE_PATH = process.env.REACT_APP_REST_ROOT;

export const BASE_PATH_PROJECTS = BASE_PATH + 'current/projects/';

export const MAIN_STRUCTURE_FILENAME = 'md.imaged.rot.dry.pdb';

export const MAIN_TRAJECTORY_FILENAME = 'md.imaged.rot.xtc';

export const PATH_MAIN_TOPOLOGY = '/files/md.imaged.rot.dry.pdb';

// The name how this analysis is tagged in the webpage
// If no name is provided, the webpage will tag it with the defalt name
export const NICE_NAMES = new Map([
  ['overview', 'Overview'],
  ['trajectory', 'Trajectory'],
  ['files', 'Downloads'],
  ['dist', 'DIST'],
  ['rmsd', 'RMSd'],
  ['rmsds', 'RMSds'],
  ['rgyr', 'Rgyr'],
  ['rgyrx', 'RgyrX'],
  ['rgyry', 'RgyrY'],
  ['rgyrz', 'RgyrZ'],
  ['rmsf', 'Fluctuation'],
  ['fluctuation', 'Fluctuation'],
  ['pca', 'PCA'],
  ['rmsd-perres', 'RMSd per residue'],
  ['rmsd-pairwise', 'RMSd pairwise'],
  ['dist-perres', 'Distance per residue'],
  ['hbonds', 'Hydrogen bonds'],
  ['electrostatic', 'Electrostatic p. surface'],
  ['energies', 'Energies'],
  ['pockets', 'Pockets'],
  ['mutations', 'Mutations'],
  ['epitopes', 'Epitopes'],
  ['sasa', 'Solvent accessible surface'],
  ['populations', 'Populations'],
  ['markov', 'Markov Graph'],
]);

// The name how this analysis is tagged in the webpage
// If no name is provided, the webpage will tag it with the defalt name
export const COLLECTION_NAMES = new Map([
  ['cv19', 'BioExcel - COVID-19'],
  ['mcns', 'MoDEL - Central Nervous System'],
  ['model', 'MoDEL 2010'],
  ['null', 'Independent'],
  [null, 'Independent'],
]);
