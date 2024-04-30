// Set the behaviour of the web client depending of the URL which makes the request
// Default values are assigned for every missing value
// api - API URL to query
// prod - Set if this is production or not (i.e. development)
// description - Text to be displayed in the home page
// logo - Logo filename (without the format extension) to be dipslayed on the top-left corner, in the header
// primary - Color of the header and additional regions along the whole web page
// secondary - Color of non-primary regions along the whole web page

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
    prod: false,
    description: defaultDescription,
    logo: 'logo-mdposit',
    primary: '#808080', // Grey
    secondary: '#fafafa', // Light grey
};

// Set every host configuration
const HOST_CONFIGS = {
    'localhost': {
        api: 'https://mmb-dev.mddbr.eu/api/rest/',
        primary: '#5c6bc0', // Light indigo
    },
    'mdposit-dev.mddbr.eu': {
        api: 'https://mdposit-dev.mddbr.eu/api/rest/',
        primary: '#5c6bc0', // Light indigo
    },
    'mdposit.mddbr.eu': {
        api: 'https://mdposit.mddbr.eu/api/rest/',
        prod: true,
        primary: '#5c6bc0', // Light indigo
    },
    'mdposit-dev.bsc.es': {
        api: 'https://mdposit-dev.mddbr.eu/api/rest/',
        primary: '#5c6bc0', // Light indigo
    },
    'mmb-dev.mddbr.eu': {
        api: 'https://mmb-dev.mddbr.eu/api/rest/',
        logo: 'logo-mdposit-mmb',
        primary: '#8B008B', // Dark magenta
        description: <>
            {defaultDescription}<br/>
            This node contains simulations stored at the MMB group at IRB Barcelona.
        </>
    },
    'mmb.mddbr.eu': {
        api: 'https://mmb.mddbr.eu/api/rest/',
        prod: true,
        logo: 'logo-mdposit-mmb',
        primary: '#8B008B', // Dark magenta
        description: <>
            {defaultDescription}<br/>
            This node contains simulations stored at the MMB group at IRB Barcelona.
        </>
    },
    'abc-dev.mddbr.eu': {
        api: 'https://abc-dev.mddbr.eu/api/rest/',
        logo: 'logo-mdposit-abc',
        primary: '#DC143C', // Crimson red
        description: <>
            {defaultDescription}<br/>
            This node contains simulations from the Ascona B-DNA Consortium.
        </>
    },
    'abc.mddbr.eu': {
        api: 'https://abc.mddbr.eu/api/rest/',
        prod: true,
        logo: 'logo-mdposit-abc',
        primary: '#DC143C', // Crimson red
        description: <>
            {defaultDescription}<br/>
            This node contains simulations from the Ascona B-DNA Consortium.
        </>
    },
};

// Set the current host configuration
const HOST_CONFIG = HOST_CONFIGS[window.location.hostname];

// Fill the host configuration gaps
Object.entries(DEFAUL_HOST_CONFIG).forEach(([ field, defaultValue ]) => {
    if (!HOST_CONFIG[field]) HOST_CONFIG[field] = defaultValue;
});

export default HOST_CONFIG;