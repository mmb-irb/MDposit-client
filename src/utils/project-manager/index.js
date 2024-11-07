// Get the use memo hook
import React, { useMemo } from 'react';
// Function to request data through the API
import useAPI from '../../hooks/use-api';
// Constants
import {
    BASE_PATH_PROJECTS,
    HOST_CONFIG,
    REFERENCES_WITH_ENTROPIES,
    REFERENCES_WITH_EPITOPES
} from '../constants';
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
        // If the project is si wrong we do not even have metadata then stop here
        if (!this.metadata) return;
        // Calculate any additional metadata
        if (!this.metadata.mdFrames) this.metadata.mdFrames = this.metadata.SNAPSHOTS;
        this.metadata.timeLength = (this.metadata.FRAMESTEP && this.metadata.mdFrames &&
            this.metadata.FRAMESTEP * this.metadata.mdFrames) || null;
        // Set the count of MDs by excluding those MDs flagged as 'removed'
        this.mdCount = this.mds ? this.mds.filter(md => md.slice(-9) !== '(removed)').length : 0;
        // Calculate a few internal things
        // Get the accession and the MD number in a single string which is useful to make API requests
        // If project is in the old format then do not add the point and the MD number
        const accessionOrId = this.accession || this.identifier;
        this.accessionAndMdNumber = this.mds ? `${accessionOrId}.${this.mdNumber}` : accessionOrId;
        // Check if there are interactions
        this.hasInteractions = this.analyses.includes('interactions');
        // Check if the populations file is found in the files index
        this.isPopulated = Boolean(
            this.files && this.files.find(filename => filename === 'populations.json'),
        );
        // Set the available directions in the client according to project data and host configuration
        // IMPORTANT: Note that for every direction there must be a directory with equal name under src/pages/accession/
        // Start with the directions which are to be always available
        this.directions = {
            overview: true,
            trajectory: true,
            files: true
        }
        // Set available analyses
        // Start with the generic analyses
        // These analyses are always visible but not clickable when data is missing
        const genericAnalyses = [ 'rmsds', 'rgyr', 'fluctuation', 'pca', 'rmsd-perres',
            'rmsd-pairwise', 'dist-perres', 'hbonds', 'energies', 'pockets', 'sasa', 'clusters', 'density' ];
        for (const analysis of genericAnalyses) {
            this.directions[analysis] = this.analyses.includes(analysis);
        }
        // Add the electrostatic direction whenever there are interactions
        this.directions['electrostatic'] = this.analyses.includes('interactions');
        // Add reference specific directions
        this.directions['ligand-descriptors'] = Boolean(this.metadata && this.metadata.LIGANDS && this.metadata.LIGANDS.length > 0);
        // Now set some specialized analyses
        // These analyses are hidden when the project is out of context
        // Their availability may be also more complicated than the generic ones
        // Set covid-19 specific analyses
        if (HOST_CONFIG.options.includes('covid')) {
            const anyReferenceWithEntropies = this.metadata && this.metadata.REFERENCES &&
                this.metadata.REFERENCES.find(ref => REFERENCES_WITH_ENTROPIES.includes(ref));
            this.directions['mutations'] = Boolean(anyReferenceWithEntropies);
            const anyReferenceWithEpitopes = this.metadata && this.metadata.REFERENCES &&
                this.metadata.REFERENCES.find(ref => REFERENCES_WITH_EPITOPES.includes(ref));
            this.directions['epitopes'] = Boolean(anyReferenceWithEpitopes);
        }
        // Set MSM specific analyses
        if (this.metadata && this.metadata.METHOD === 'Markov state model (MSM)') {
            this.directions['populations'] = this.files && this.files.find(file => file === 'populations.json');
            this.directions['markov'] = this.analyses.includes('markov');
        }
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
        this._apiBaseUrl = `${BASE_PATH_PROJECTS}/${this.accessionAndMdNumber}`;
    }
    // Declare the different field endpoints to request the API
    _apiEndpoints = {
        topology: `/topology`,
        interactions: `/analyses/interactions`,
        references: `/references`,
        fileDescriptors: `/filenotes`,
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

    // Interactions getter
    get interactions () {
        const response = this._apiQuery('interactions', this.hasInteractions);
        if (!response) return null;
        if (response.loading) return null;
        if (response.error) throw new Error('Error when downloading project interactions: ' + response.error.message);
        if (!response.payload) throw new Error('Something went wrong with project interactions');
        return response.payload;
    }

    // References getter
    get references () {
        const response = this._apiQuery('references');
        if (response.loading) return null;
        if (response.error) throw new Error('Error when downloading project references: ' + response.error.message);
        if (!response.payload) throw new Error('Something went wrong with project references');
        return response.payload;
    }
    // Specific references getters
    get proteinReferences () {
        const references = this.references;
        return useMemo(() => references && references.filter(ref => ref.uniprot), [references]);
    }
    get ligandReferences () {
        const references = this.references;
        return useMemo(() => references && references.filter(ref => ref.pubchem), [references]);
    }

    // Topology getter
    get topology () {
        // Get references to further load them to the topology manager
        // Note that this must be done here to respect hooks
        const references = this.references;
        // Request topology data
        const response = this._apiQuery('topology');
        if (response.loading) return null;
        if (response.error) throw new Error('Error when downloading project topology: ' + response.error.message);
        if (!response.payload) throw new Error('Something went wrong with project topology');
        if (this._topologyManager) return this._topologyManager;
        this._topologyManager = new Topology(response.payload, this.metadata, references);
        return this._topologyManager;
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
  