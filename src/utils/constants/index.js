export const BASE_PATH = process.env.REACT_APP_REST_ROOT;

export const BASE_PATH_PROJECTS = BASE_PATH + 'current/projects/';

// The name how this analysis is tagged in the webpage
// If no name is provided, the webpage will tag it with the defalt name
export const NICE_NAMES = new Map([
  ['overview', 'Overview'],
  ['trajectory', 'Trajectory'],
  ['files', 'Downloads'],
  ['dist', 'DIST'],
  ['rmsd', 'RMSd'],
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
]);

// The color of the graphics for this analysis
// WARNING: If no color is provided the graphics won't be visible
export const COLORS = new Map([
  ['dist', '#67b7dc'],
  ['rmsd', '#67b7dc'],
  ['rgyr', '#67b7dc'],
  ['rgyrx', '#fdd400'],
  ['rgyry', '#84b761'],
  ['rgyrz', '#cc4748'],
  ['rmsf', '#67b7dc'],
  ['fluct', '#67b7dc'],
  ['time', 'gray'],
]);
