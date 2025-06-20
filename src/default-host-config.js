// Import auxiliar functions
import { copyObject } from "src/utils/auxiliar-functions";

// Import default query fields
import defaultQueryFields from "src/utils/constants/query-fields";

// Set the behaviour of the web client depending of the URL which makes the request
// Note that this script must be placed after the src directory for react to use it and JSX to be parsed

// Here are the parameters assigned here for every host
// Default values are assigned for every missing value
// api - API URL to query
// production - Set if this is production (true) or development (false)
// global - Set if the API is the global (true) or federated (false)
// name - Name to be displayed in the sheet header
// favicon - Icon filename (without the format extension) to be displayed in the sheet header
//           Icons are located at public/.
// description - Text or JSX to be displayed in the home page
// logo - Logo filename (without the format extension) to be dipslayed on the top-left corner, in the header
//        Images are located at src/images/.
// primaryColor - Color of the header and additional regions along the whole web page
// secondaryColor - Color of non-primary regions along the whole web page
// searchExample - Search example: This is shown in search bars as placeholder when they are empty
// optionsField - Field in projects metadata to be used as options in the browse selector and the data summary
//                If no options field is passed then ignore the options label and options nice names
// optionsLabel - Name of the options in the browse selector and the data summary
// optionsNiceNames - Nice names for every possible value in the options field
//                    Non-matching values will remain as they are
// queryFields - Fields to be queried in the search and advanced search pages and their configurations
// options - Additional flags which may be used by the cliente

// Get the requesting URL domain
const HOST = window.location.hostname;

// Set default values for every host config fields
// These values are used to fill missing values
const DEFAUL_HOST_CONFIGURATION = {
    api: `https://${HOST}/api/rest/`,
    production: false,
    name: 'MDposit',
    favicon: 'mdposit_favicon',
    description: <>
        <strong>MDposit</strong> is an open platform designed to provide web
        access to atomistic molecular dynamics (MD) simulations. The aim of
        this initiative is to ease and promote data sharing along the
        wide-world scientific community in order to contribute in research.
    </>,
    logo: 'logo-mdposit',
    logoLabel: '',
    primaryColor: '#808080', // Grey
    secondaryColor: '#fafafa', // Light grey
    searchExample: 'e.g. Orozco lab',
    optionsField: undefined, // No browser selector and no data summary pie chart by default
    optionsLabel: 'Options',
    optionsNiceNames: {},
    queryFields: defaultQueryFields,
    options: []
};

// Set the configuration for the collections option
// DANI: Para no repetirlo cada vez
const COLLECTION_OPTIONS = {
    optionsField: 'metadata.COLLECTIONS',
    optionsLabel: 'Collection',
    optionsNiceNames: {
        'cv19': 'BioExcel - COVID-19',
        'mcns': 'MoDEL - Central Nervous System',
        'model': 'MoDEL 2010',
        'bigna': 'BIGNASim',
        'abc': 'ABC',
        'modtox': 'ModTox',
        'null': 'Independent',
        [null]: 'Independent',
    }
};

// Set the configuration for covid19 specific units option
// DANI: Para no repetirlo cada vez
const UNIT_OPTIONS = {
    optionsField: 'metadata.CV19_UNIT',
    optionsLabel: 'Unit',
    optionsNiceNames: {} // There is no need to use nice names, they arleady are
};

// Set the configuration for MDposit node option
// DANI: Para no repetirlo cada vez
const NODE_OPTIONS = {
    optionsField: 'node',
    optionsLabel: 'Node',
    optionsNiceNames: {
        'mmb': 'IRB Barcelona, MMB',
        'abc': 'IRB Barcelona, ABC',
        'pklr': 'BSC - Pyruvate Kinase',
        'oxf': 'Oxford University',
        'cin': 'Cineca',
    }
};

// Set additional query fields
// DANI: Para no repetirlo cada vez

// Include the collections field, which makes no sense in some collection-specific nodes (e.g. covid, abc)
const queryFieldsWithCollections = copyObject(defaultQueryFields);
const collectionsField = {
    name: "Collections",
    path: "metadata.COLLECTIONS",
    type: "string",
    example: "cv19",
    options: true,
    checkbox : true,
    defaultOpen : true
};
queryFieldsWithCollections["General annotations"].unshift(collectionsField);

// Include the collections field, which makes no sense in some collection-specific nodes (e.g. covid, abc)
const queryFieldsWithNodesAndCollections = copyObject(defaultQueryFields);
queryFieldsWithNodesAndCollections["General annotations"].unshift(collectionsField);
queryFieldsWithNodesAndCollections["General annotations"].unshift({
    name: "Node",
    path: "node",
    type: "string",
    example: "mmb",
    options: true,
    checkbox : true,
    defaultOpen : true
});

// BioExcel Covid19 specific fields
const queryFieldsWithCovid = copyObject(defaultQueryFields);
// Add the unit field at the beginning of the gener annotations
queryFieldsWithCovid["General annotations"].unshift(
    {
        "name": "Unit",
        "path": "metadata.CV19_UNIT",
        "type": "string",
        "example": "ACE2",
        "options": true,
        "checkbox" : true,
        "defaultOpen" : true
    }
);
// Create a new category for covid specific fields and add some
queryFieldsWithCovid["Covid-specific annotations"] = [
    {
        "name": "Variants",
        "path": "metadata.CV19_VARIANT",
        "type": "string",
        "example": "Delta",
        "options": true
    },
    {
        "name": "Presence of antibodies",
        "path": "metadata.CV19_ABS",
        "type": "boolean",
        "options": true,
        "checkbox" : true
    },
    {
        "name": "Presence of nanobodies",
        "path": "metadata.CV19_NANOBS",
        "type": "boolean",
        "options": true,
        "checkbox" : true
    },
    {
        "name": "Spike starting conformation",
        "path": "metadata.CV19_STARTCONF",
        "type": "string",
        "options": true,
        "checkbox" : true
    },
];

// Set a custom description for the covid host
const covidDescription = <>
    <strong>BioExcel-CV19</strong> is a platform designed to provide
    web-access to <strong>atomistic-MD trajectories</strong> for
    macromolecules involved in the COVID-19 disease.<br/>
    <br/>
    The project is part of the open access initiatives promoted by the
    world-wide scientific community to share information about COVID-19
    research.<br/>
    <br/>
    <strong>BioExcel-CV19 web server interface</strong> presents the
    resulting trajectories, with a set of quality control analyses and
    system information. All data produced by the project is available to
    download from an associated programmatic access API.
</>;

// Set every host configuration
const HOST_CONFIGURATIONS = {
    // Testing
    'localhost': {
        api: 'https://irb-dev.mddbr.eu/api/rest/',
        palette: {
            primary: {
            light: '#eeeeee',
            main:'rgb(145, 142, 142)', // Grey
            dark:'rgb(223, 223, 223)',
            contrastText: '#fff',
            },  
            secondary: {
            light: '#f5f5f5',
            main:'rgb(122, 122, 122)',
            dark: 'rgb(163, 163, 163)',
            contrastText: '#fff',
            },
        },
    },
    // MDposit development
    'mdposit-dev.mddbr.eu': {
        global: true,
        primaryColor: '#5c6bc0', // Light indigo
        ...NODE_OPTIONS,
        queryFields: queryFieldsWithNodesAndCollections,
    },
    // MDposit production
    'mdposit.mddbr.eu': {
        production: true,
        global: true,
        primaryColor: '#5c6bc0', // Light indigo
        ...NODE_OPTIONS,
        queryFields: queryFieldsWithNodesAndCollections,
    },
    // MDposit development (obsolete url)
    'mdposit-dev.bsc.es': {
        api: 'https://mdposit-dev.mddbr.eu/api/rest/',
        global: true,
        primaryColor: '#5c6bc0', // Light indigo
        ...NODE_OPTIONS,
        queryFields: queryFieldsWithNodesAndCollections,
    },
    // MMB node development
    'mmb-dev.mddbr.eu': {
        logoLabel: 'MMB node',
        primaryColor: '#BB00BB', // Purple
        description: <>
            {DEFAUL_HOST_CONFIGURATION.description}<br/>
            This node contains simulations stored at the MMB group at IRB Barcelona.
        </>,
        ...COLLECTION_OPTIONS,
        queryFields: queryFieldsWithCollections,
    },
    // MMB node production
    'mmb.mddbr.eu': {
        production: true,
        logoLabel: 'MMB node',
        primaryColor: '#BB00BB', // Purple
        description: <>
            {DEFAUL_HOST_CONFIGURATION.description}<br/>
            This node contains simulations stored at the MMB group at IRB Barcelona.
        </>,
        ...COLLECTION_OPTIONS,
        queryFields: queryFieldsWithCollections,
    },
    // IRB node development
    'irb-dev.mddbr.eu': {
        logoLabel: 'IRB node',
        palette: {
            primary: {
            main: '#cf05ca', // R207 G5 B202
            dark: '#4116a3', // R65 G22 B163
            contrastText: '#fff', 
            },
            secondary: {
            main: '#aa00ff', // R58 G41 9915E7
            dark: '#9915E7', // R153 G21 B231 not used
            contrastText: 'rgb(236, 236, 236)',
            },
        },
        description: <>
            {DEFAUL_HOST_CONFIGURATION.description}<br/>
            This node contains simulations stored at the MMB group at IRB Barcelona.
        </>,
        ...COLLECTION_OPTIONS,
        queryFields: queryFieldsWithCollections,
    },
    // IRB node production
    'irb.mddbr.eu': {
        production: true,
        logoLabel: 'IRB node',
        primaryColor: '#BB00BB', // Purple
        secondaryColor: '#4116a3', // Dark Purple
        description: <>
            {DEFAUL_HOST_CONFIGURATION.description}<br/>
            This node contains simulations stored at the MMB group at IRB Barcelona.
        </>,
        ...COLLECTION_OPTIONS,
        queryFields: queryFieldsWithCollections,
    },
    // ABC node development
    'abc-dev.mddbr.eu': {
        logoLabel: 'ABC node',
        primaryColor: '#DC143C', // Crimson red
        description: <>
            {DEFAUL_HOST_CONFIGURATION.description}<br/>
            This node contains simulations from the Ascona B-DNA Consortium.
        </>
    },
    // ABC node production
    'abc.mddbr.eu': {
        production: true,
        logoLabel: 'ABC node',
        primaryColor: '#DC143C', // Crimson red
        description: <>
            {DEFAUL_HOST_CONFIGURATION.description}<br/>
            This node contains simulations from the Ascona B-DNA Consortium.
        </>
    },
    // Oxford node development
    'oxford-dev.mddbr.eu': {
        logoLabel: 'Oxford node',
        primaryColor: '#66CC00', // Green as it is the Oxfrod landscape <3
        description: <>
            {DEFAUL_HOST_CONFIGURATION.description}<br/>
            This node contains simulations from the Oxford University node.
        </>
    },
    // Oxford node production
    'oxford.mddbr.eu': {
        production: true,
        logoLabel: 'Oxford node',
        primaryColor: '#66CC00', // Green as it is the Oxfrod landscape <3
        description: <>
            {DEFAUL_HOST_CONFIGURATION.description}<br/>
            This node contains simulations from the Oxford University node.
        </>
    },
    // Cineca node
    'cineca.mddbr.eu': {
        //production: true,
        logoLabel: 'Cineca node',
        palette: {
            primary: {
            light: '#00e5ff',
            main: '#99FFFF', // Light blue
            dark: '#00b8d4',
            contrastText: '#fff',
            },
            secondary: {
                light: '#84ffff',
                main: '#00e5ff',
                dark: '#00b8d4',
                contrastText: '#000',
            },
        },
        description: <>
            {DEFAUL_HOST_CONFIGURATION.description}<br/>
            This node contains simulations from the Cineca node in Bologna.
        </>
    },
    // BioExcel covid19 development
    'bioexcel-cv19-dev.mddbr.eu': {
        description: covidDescription,
        name: 'BioExcel - Covid19',
        favicon: 'bioexcel_favicon',
        logo: 'logo-bioexcel-cv19',
        primaryColor: '#607D8B', // Light grey
        secondaryColor: '#76FF03', // Light green
        ...UNIT_OPTIONS,
        queryFields: queryFieldsWithCovid,
        options: ['covid'] // Enable covid specific analyses
    },
    // BioExcel covid19 production
    'bioexcel-cv19.mddbr.eu': {
        production: true,
        name: 'BioExcel - Covid19',
        favicon: 'bioexcel_favicon',
        description: covidDescription,
        logo: 'logo-bioexcel-cv19',
        primaryColor: '#607D8B', // Light grey
        secondaryColor: '#76FF03', // Light green
        ...UNIT_OPTIONS,
        queryFields: queryFieldsWithCovid,
        options: ['covid'] // Enable covid specific analyses
    },
    // JSC
    'jsc.mddbr.eu': {
        production: true,
        primaryColor: '#c5b96b', // Golden,
        logoLabel: 'JSC node',
        name:'MDposit JSC'
    },
    // BSC
    'bsc.mddbr.eu': {
        production: true,
        primaryColor: '#a8cdf3', // Golden,
        logoLabel: 'PKLR node',
        name:'PKLR@MDDB'
    },
    // FLORIDA DEV
    'devmddb.rc.ufl.edu': {
        production: false,
        primaryColor: '#eb94d3', // pink,
        logoLabel: 'florida node',
        name:'MDposit florida'
    },
    // INRIA
    'inria.mddbr.eu': {
        production: true,
        primaryColor: '#5e8568', // green,
        logoLabel: 'inria node',
        name:'MDposit inria'
    },
    // RPBS
    'rpbs.mddbr.eu': {
        production: true,
        primaryColor: '#6bc5b8', // Turquoise,
        logoLabel: 'RPBS node',
        name:'MDposit RPBS'
    },
    // PODMAN DEV
    'devmddb.rc.ufl.edu': {
        production: false,
        primaryColor: '#ff0000', // Golden,
        logoLabel: 'Podman node',
        name:'MDposit Podman'
    },
    // Nostrum
    '3.144.224.102': {
        api: `http://3.144.224.102/api/rest/`,
        primaryColor: '#00cfbf', // Light blue
        logo: 'logo-nostrum',
        name:'XNA Hub'
    },
};

// Set the current host configuration
if (!(HOST in HOST_CONFIGURATIONS)) console.error(`Unknown host "${HOST}". Using default configuration.`)
const HOST_CONFIG = HOST_CONFIGURATIONS[HOST] || HOST_CONFIGURATIONS['localhost'];
//const HOST_CONFIG = HOST_CONFIGURATIONS['mdposit-dev.mddbr.eu'];

// Fill the host configuration gaps with default values
Object.entries(DEFAUL_HOST_CONFIGURATION).forEach(([ field, defaultValue ]) => {
    if (!HOST_CONFIG[field]) HOST_CONFIG[field] = defaultValue;
});

export default HOST_CONFIG;