// Set the behaviour of the web client depending of the URL which makes the request
// Default values are assigned for every missing value
// api - API URL to query
// production - Set if this is production or not (i.e. development)
// description - Text to be displayed in the home page
// logo - Logo filename (without the format extension) to be dipslayed on the top-left corner, in the header
// primaryColor - Color of the header and additional regions along the whole web page
// secondaryColor - Color of non-primary regions along the whole web page
// searchExample - Search example: This is shown in search bars as placeholder when they are empty
// optionsField - Field in projects metadata to be used as options in the browse selector and the data summary
//                If no options field is passed then ignore the options label and options nice names
// optionsLabel - Name of the options in the browse selector and the data summary
// optionsNiceNames - Nice names for every possible value in the options field
//                    Non-matching values will remain as they are

// Set the default description
const defaultDescription = <>
    <strong>MDposit</strong> is an open platform designed to provide web
    access to atomistic molecular dynamics (MD) simulations. The aim of
    this initiative is to ease and promote data sharing along the
    wide-world scientific community in order to contribute in research.
</>;

// Set default values for every host config fields
// These values are used to fill missing values
const DEFAUL_HOST_CONFIG = {
    api: 'https://mmb-dev.mddbr.eu/api/rest/',
    production: false,
    description: defaultDescription,
    logo: 'logo-mdposit',
    primaryColor: '#808080', // Grey
    secondaryColor: '#fafafa', // Light grey
    searchExample: 'e.g. Orozco lab',
    optionsField: undefined, // No browser selector and no data summary pie chart by default
    optionsLabel: 'Options',
    optionsNiceNames: {},
};

// Set default values for specific hosts
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
        'null': 'Independent',
        [null]: 'Independent',
    }
}

// Set every host configuration
const HOST_CONFIGS = {
    // Testing
    'localhost': {
        api: 'https://mmb-dev.mddbr.eu/api/rest/',
        primaryColor: '#5c6bc0', // Light indigo
    },
    // MDposit development
    'mdposit-dev.mddbr.eu': {
        api: 'https://mdposit-dev.mddbr.eu/api/rest/',
        primaryColor: '#5c6bc0', // Light indigo
        ...COLLECTION_OPTIONS,
    },
    // MDposit production
    'mdposit.mddbr.eu': {
        api: 'https://mdposit.mddbr.eu/api/rest/',
        production: true,
        primaryColor: '#5c6bc0', // Light indigo
        ...COLLECTION_OPTIONS,
    },
    // MDposit development (obsolete url)
    'mdposit-dev.bsc.es': {
        api: 'https://mdposit-dev.mddbr.eu/api/rest/',
        primaryColor: '#5c6bc0', // Light indigo
        ...COLLECTION_OPTIONS,
    },
    // MMB node development
    'mmb-dev.mddbr.eu': {
        api: 'https://mmb-dev.mddbr.eu/api/rest/',
        logo: 'logo-mdposit-mmb',
        primaryColor: '#8B008B', // Dark magenta
        description: <>
            {defaultDescription}<br/>
            This node contains simulations stored at the MMB group at IRB Barcelona.
        </>,
        ...COLLECTION_OPTIONS
    },
    // MMB node production
    'mmb.mddbr.eu': {
        api: 'https://mmb.mddbr.eu/api/rest/',
        production: true,
        logo: 'logo-mdposit-mmb',
        primaryColor: '#8B008B', // Dark magenta
        description: <>
            {defaultDescription}<br/>
            This node contains simulations stored at the MMB group at IRB Barcelona.
        </>,
        ...COLLECTION_OPTIONS
    },
    // ABC node development
    'abc-dev.mddbr.eu': {
        api: 'https://abc-dev.mddbr.eu/api/rest/',
        logo: 'logo-mdposit-abc',
        primaryColor: '#DC143C', // Crimson red
        description: <>
            {defaultDescription}<br/>
            This node contains simulations from the Ascona B-DNA Consortium.
        </>
    },
    // ABC node production
    'abc.mddbr.eu': {
        api: 'https://abc.mddbr.eu/api/rest/',
        production: true,
        logo: 'logo-mdposit-abc',
        primaryColor: '#DC143C', // Crimson red
        description: <>
            {defaultDescription}<br/>
            This node contains simulations from the Ascona B-DNA Consortium.
        </>
    },
};

// Set the current host configuration
const HOST_CONFIG = HOST_CONFIGS[window.location.hostname];

// Fill the host configuration gaps with default values
Object.entries(DEFAUL_HOST_CONFIG).forEach(([ field, defaultValue ]) => {
    if (!HOST_CONFIG[field]) HOST_CONFIG[field] = defaultValue;
});

export default HOST_CONFIG;