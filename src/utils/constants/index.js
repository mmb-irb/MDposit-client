// Import host configuration
import hostConfig from "./host-config";

export const HOST_CONFIG = hostConfig;

// State the different reference types and how their data is organized
export const REFERENCES = {
    proteins: {
        idField: 'uniprot',
        projectIdsField: 'metadata.REFERENCES'
    },
    ligands: {
        idField: 'pubchem',
        projectIdsField: 'metadata.LIGANDS'
    },
    inchikeys: {
        idField: 'inchikey',
        projectIdsField: 'metadata.INCHIKEYS'
    },
    pdbs: {
        idField: 'id',
        projectIdsField: 'metadata.PDBIDS'
    },
    chains: {
        idField: 'sequence',
        projectIdsField: 'metadata.PROTSEQ'
    },
    collections: {
        idField: 'id',
        projectIdsField: 'metadata.COLLECTIONS'
    }
};
export const MDPOSIT_URL = 'https://mdposit.mddbr.eu';

export const BASE_PATH = HOST_CONFIG.api;
export const BASE_VERSIONED_PATH = HOST_CONFIG.api + 'current';

export const BASE_PATH_PROJECTS = BASE_VERSIONED_PATH + '/projects';

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
    ['rmsd', 'RMSD'],
    ['rmsds', 'RMSDs'],
    ['tmscores', 'TM scores'],
    ['rgyr', 'Radius of gyration'],
    ['rgyrx', 'RgyrX'],
    ['rgyry', 'RgyrY'],
    ['rgyrz', 'RgyrZ'],
    ['rmsf', 'Fluctuation'],
    ['fluctuation', 'Fluctuation'],
    ['pca', 'PCA'],
    ['rmsd-perres', 'RMSD per residue'],
    ['rmsd-pairwise', 'RMSD pairwise'],
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
    ['channels', 'Channels'],
    ['lipid-order', 'Lipid order'],
    ['lipid-inter', 'Lipid interactions'],
    ['dihenergies', 'Dihedral energies'],
    ['allostery', 'Allostery'],
    ['chemical-shifts', 'Chemical shifts'],
]);

// Set manually which references have entropies or epitopes
// This needs to be updated by hand when there is a new reference with entropies or epitopes
// This workaround prevents having to pass the references context to the root, which makes no sense
export const UNIPROTS_WITH_ENTROPIES = ['P0DTC2'];
export const UNIPROTS_WITH_EPITOPES = ['P0DTC2'];