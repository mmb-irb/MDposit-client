// Example of a host configuration which serves several hosts with a different behaviour for each
// To use it, copy this file to the repository root as host-config.js
// See src/utils/constants/default-host-config.js for a description of every field
// Missing fields are filled with the default values

// Import the footer logos
// Logos which are specific of your node may be placed at src/images/untracked/, which is ignored by git
import myLabLogo from 'src/images/untracked/my-lab-logo.png';

// Here are the parameters assigned here for every host
// Default values are assigned for every missing value
// host - Host name used to set some default values (e.g. the API URL)
//        The requesting URL domain is used by default
// api - API URL to query
// production - Set if this is production (true) or development (false)
// global - Set if the API is the global (true) or federated (false)
// name - Name to be displayed in the sheet header
// favicon - Icon filename (without the format extension) to be displayed in the sheet header
//           Icons are located at public/.
// description - Text or JSX to be displayed in the home page
// logo - Logo filename (without the format extension) to be dipslayed on the top-left corner, in the header
//        Images are located at src/images/.
// logoLabel - Small text to be written right below the logo
// footers - Image paths/URLs and the URLs to redirect on click for the webpage footer logos.
//           The MDDB logo is not optional.
// primaryColor - Color of the header and additional regions along the whole web page
// secondaryColor - Color of non-primary regions along the whole web page
// searchExample - Search example: This is shown in search bars as placeholder when they are empty
// contactText - Text to be displayed in the contact page
// contactUrls - List of URLs to be displayed in the contact page
// contactMails - List of mails to be displayed in the conact page
// metaURL - GitHub or GitLab repository where the meta-dynamics notebooks are hosted
// optionsField - Field in projects metadata to be used as options in the browse selector and the data summary
//                If no options field is passed then ignore the options label and options nice names
// optionsLabel - Name of the options in the browse selector and the data summary
// optionsNiceNames - Nice names for every possible value in the options field
//                    Non-matching values will remain as they are
// optionsData - Additional data related to options
// queryFields - Fields to be queried in the search and advanced search pages and their configurations
// options - Additional flags which may be used by the cliente

// Get the requesting URL domain
const HOST = window.location.hostname;

// Set every host configuration
const HOST_CONFIGURATIONS = {
    // Testing
    'localhost': {
        api: 'http://localhost:8000/rest/',
    },
    // Development
    'my-node-dev.mydomain.org': {
        palette: {
            primary: {
                main: '#5c6bc0', // Light indigo
                dark: '#1400ca', // R65 G22 B163
                contrastText: '#ffffff', 
            },
            secondary: {
                main: '#4d4d4d', // R58 G41 9915E7
                dark: '#2c2c2c', // R153 G21 B231 not used
                contrastText: 'rgb(255, 255, 255)',
            },
        },
    },
    // Production
    'my-node.mydomain.org': {
        // Show only simulations flaged as 'published' and hide the rest
        production: true,
        // Estetical setup
        name: 'My node',
        logoLabel: 'My node',
        palette: {
            primary: {
            main: '#CF44CB',
            dark: '#6529CF',
            contrastText: '#fff', 
            },
            secondary: {
            main: '#aa00ff',
            dark: '#9915E7',
            contrastText: 'rgb(236, 236, 236)',
            },
        },
        // Further customization
        description: <>
            This node contains the simulations from my group.
        </>,
        footers: [
            {
                image: myLabLogo,
                url: "https://my-lab.org/",
            },
            {
                image: "https://my-university.org/logo.png",
                url: "https://my-university.org/",
            },
        ],
        contactUrls: [
            {
                url: "https://my-lab.org/contact",
                label: 'My lab'
            }
        ],
        contactMails: [
            {
                mail: 'my.mail@myuniversity.org',
                label: 'John Doe'
            }
    ],
    },
};

// Set the current host configuration
// Set also a fallback in case we have an unexpected host
if (!(HOST in HOST_CONFIGURATIONS))
    console.error(`Unknown host "${HOST}". Using default configuration.`)
const HOST_CONFIG = HOST_CONFIGURATIONS[HOST] || HOST_CONFIGURATIONS['localhost'];

export default HOST_CONFIG;