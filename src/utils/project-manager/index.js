// Function to request data through the API
import useAPI from '../../hooks/use-api';
// Constants
import { BASE_PATH_PROJECTS } from '../constants';
// Load the topology manager class
import { Topology } from '../../utils/topology-manager';

// Set the project class
export class Project {
    constructor(projectPayload) {
        // Replicate all payload values in the project object
        // This includes values such as metadata, files index, accession, etc.
        Object.entries(projectPayload).forEach(([key, value]) => {
            this[key] = value;
        });
        // Calculate a few internal things
        // Get the accession and the MD number in a single string which is useful to make API requests
        // If project is in the old format then do not add the point and the MD number
        this.accessionAndMdNumber = this.mds ? `${this.accession}.${this.mdNumber}` : this.accession;
        // Check if there are interactions
        this.hasInteractions = Boolean(this.metadata.INTERACTIONS && this.metadata.INTERACTIONS.length > 0);
        // Check if the populations file is found in the files index
        this.isPopulated = Boolean(
            this.files && this.files.find(filename => filename === 'populations.json'),
        );
        // Set an internal object to save data requested through the API
        this._apiResponses = {
            topology: null,
            interactions: null,
            references: null,
            fileDescriptors: null,
            populations: null
        };
        // Save the topology manager apart so we do not have to re-instantiate the class every time
        this._topologyManager = null;
        // Set the project base URL to request the API
        this._apiBaseUrl = `${BASE_PATH_PROJECTS}/${this.accessionAndMdNumber}`
    }
    // Declare the different field endpoints to request the API
    _apiEndpoints = {
        topology: `/topology`,
        interactions: `/analyses/interactions`,
        references: `/references`,
        fileDescriptors: `/files?descriptor`,
        populations: `/files/populations.json`,
    }
    // Set a function to query the API and store the response for internal variables
    _apiQuery = (fieldname, available = true) => {
        // Set the request URL
        let url = this._apiBaseUrl + this._apiEndpoints[fieldname];
        // Request the value if it is available only
        if (!available) url = null;
        // If data for the requested fieldname is already saved then set the url as null
        // This makes the useAPI hook not to repeat the query
        if (this._apiResponses[fieldname] && this._apiResponses[fieldname].payload) url = null;
        // Do the API query but save the result only if the url is not null
        // Note that if url is null from the first render (i.e. there is not value at all) then its value will be null
        const query = useAPI(url);
        if (url !== null) this._apiResponses[fieldname] = query;
        // If we are still loading then
        return this._apiResponses[fieldname];
    };

    // Topology getter
    get topology () {
        const response = this._apiQuery('topology');
        if (response.loading) return null;
        if (response.error) throw new Error('Error when downloading project topology: ' + response.error.message);
        if (!response.payload) throw new Error('Something went wrong with project topology');
        if (this._topologyManager) return this._topologyManager;
        this._topologyManager = new Topology(response.payload, this.metadata);
        return this._topologyManager;
    }

    // File descriptors getter
    get interactions () {
        const response = this._apiQuery('interactions', this.hasInteractions);
        if (!response) return null;
        if (response.loading) return null;
        if (response.error) throw new Error('Error when downloading project interactions: ' + response.error.message);
        if (!response.payload) throw new Error('Something went wrong with project interactions');
        return response.payload;
    }

    // File descriptors getter
    get references () {
        const response = this._apiQuery('references');
        if (response.loading) return null;
        if (response.error) throw new Error('Error when downloading project references: ' + response.error.message);
        if (!response.payload) throw new Error('Something went wrong with project references');
        return response.payload;
    }

    // File descriptors getter
    get fileDescriptors () {
        return this._apiQuery('fileDescriptors');
    }
    // Populations getter (populated ensembles only)
    // Populations are requested only when this variable is read for the first time
    // Then populations are stored so there is no need to repeat the query again
    get populations () {
        return this._apiQuery('populations', this.isPopulated);
    }
}
  