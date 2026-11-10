// Import auxiliar functions
// Import default query fields
import defaultQueryFields from "src/utils/constants/query-fields";

// Set the behaviour of the web client depending of the URL which makes the request
// This is the default configuration, used when there is no custom host-config.js at the repository root

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

// Get default values for every host config field, given the host name
// These values are used to fill missing values
// Note that these defaults are applied always, even when a custom host configuration is used
export const getDefaultHostConfig = host => ({
    host: host,
    api: host === 'localhost'
        ? 'http://localhost:8000/rest/'
        : `https://${host}/api/rest/`,
    production: false,
    name: 'MDposit',
    favicon: 'mdposit_favicon',
    description: <>
        <strong>MDposit</strong> is an open platform designed to provide web
        access to atomistic molecular dynamics (MD) simulations. The aim of
        this initiative is to ease and promote data sharing along the
        wide-world scientific community in order to contribute in research.
    </>,
    acknowledgements: null,
    logo: 'logo-mdposit',
    logoLabel: '',
    footers: [],
    primaryColor: '#808080', // Grey
    secondaryColor: '#fafafa', // Light grey
    searchExample: 'e.g. Orozco lab',
    contactText: 'If you find any error or have any doubt regarding this webpage please reach out.',
    contactUrls: [
        {
            url: 'http://mmb.irbbarcelona.org/www/locationmap',
            label: 'IRB Molecular Modeling and Bioinformatics group website'
        }
    ],
    contactMails: [
        {
            mail: 'daniel.beltran@irbbarcelona.org',
            label: 'Dani Beltrán'
        }
    ],
    metaURL: 'github.com/mmb-irb/MDDB-meta',
    optionsField: 'metadata.COLLECTIONS',
    optionsLabel: 'Collection',
    optionsNiceNames: {
        'null': 'Independent',
        [null]: 'Independent',
    },
    optionsData: {},
    queryFields: defaultQueryFields,
    singleCollection: false,
    flags: []
});
