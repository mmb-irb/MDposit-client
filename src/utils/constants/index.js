// Import host configuration
import hostConfig from "./host-config";

export const HOST_CONFIG = hostConfig;

export const BASE_PATH = HOST_CONFIG.api;

export const BASE_PATH_PROJECTS = BASE_PATH + 'current/projects';

export const MAIN_STRUCTURE_FILENAME = 'structure.pdb';

export const MAIN_TRAJECTORY_FILENAME = 'trajectory.xtc';

export const SCREENSHOT_FILENAME = 'screenshot.jpg';

// The name how this analysis is tagged in the webpage
// If no name is provided, the webpage will tag it with the default name
export const NICE_NAMES = new Map([
    ['overview', 'Overview'],
    ['trajectory', 'Trajectory'],
    ['files', 'Downloads'],
    ['dist', 'DIST'],
    ['rmsd', 'RMSd'],
    ['rmsds', 'RMSds'],
    ['tmscores', 'TM scores'],
    ['rgyr', 'Radius of gyration'],
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
    ['ligand-descriptors', 'Ligand descriptors'],
    ['clusters', 'Clusters'],
    ['density', 'Density'],
    ['thickness', 'Thickness'],
    ['apl', 'Area per lipid'],
    ['lipid-order', 'Lipid order'],
]);

// Set manually which references have entropies or epitopes
// This needs to be updated by hand when there is a new reference with entropies or epitopes
// This workaround prevents having to pass the references context to the root, which makes no sense
export const REFERENCES_WITH_ENTROPIES = ['P0DTC2'];
export const REFERENCES_WITH_EPITOPES = ['P0DTC2'];