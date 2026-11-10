// Example of a host configuration for a single host
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
// acknowledgements - Text or JSX to be displayed in the home page, below the MDDB acknowledgements
//                    The MDDB acknowledgements (European funding) are always displayed and can not be changed
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

const HOST_CONFIG = {
    // API to be queried
    api: 'https://my-node.mydomain.org/api/rest/',
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
    // Displayed below the MDDB acknowledgements in the home page
    acknowledgements: <>
        This node is funded by My University.
    </>,
    searchExample: 'e.g. My lab',
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
};

export default HOST_CONFIG;
