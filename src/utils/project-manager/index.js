// Get the use memo hook
import React, { useEffect, useMemo, useState } from 'react';
// Function to request data through the API
import useAPI from '../../hooks/use-api';
import useBatchAPI from '../../hooks/use-batch-api';
// Constants
import {
    BASE_PATH_PROJECTS,
    HOST_CONFIG,
    UNIPROTS_WITH_ENTROPIES,
    UNIPROTS_WITH_EPITOPES,
} from '../constants';
// Import the topology manager class
import { Topology } from '../topology-manager';
import { Reference } from '../reference-manager';
// Import the NGL structure parser
import { autoLoad } from 'ngl';

// Check if an interactions analysis payload is an index of interaction analyses (new format)
// Index entries have the analysis name, while old entries have the whole interaction data
const isInteractionsIndex = payload => payload.every(entry =>
    entry.analysis !== undefined && !entry.atom_indices_1 && !entry.residue_indices_1);

// Fill missing atom or residue indices in an interaction
// Note that the interaction is modified in place, so this is done only once per interaction
const completeInteraction = (interaction, topology) => {
    // Old interactions have residue indices only, so add atom indices
    if (!interaction.atom_indices_1) {
        interaction.atom_indices_1 = topology.residue2atomIndices(interaction.residue_indices_1);
        interaction.atom_indices_2 = topology.residue2atomIndices(interaction.residue_indices_2);
        interaction.interface_atom_indices_1 = topology.residue2atomIndices(interaction.interface_indices_1);
        interaction.interface_atom_indices_2 = topology.residue2atomIndices(interaction.interface_indices_2);
    }
    // New interactions have atom indices only, so add residue indices
    if (!interaction.residue_indices_1) {
        interaction.residue_indices_1 = topology.atom2residueIndices(interaction.atom_indices_1);
        interaction.residue_indices_2 = topology.atom2residueIndices(interaction.atom_indices_2);
        interaction.interface_indices_1 = topology.atom2residueIndices(interaction.interface_atom_indices_1);
        interaction.interface_indices_2 = topology.atom2residueIndices(interaction.interface_atom_indices_2);
    }
    return interaction;
};

// Set the project class
export class Project {
    constructor(projectPayload) {
        // Replicate all payload values in the project object
        // This includes values such as metadata, files index, accession, etc.
        Object.entries(projectPayload).forEach(([key, value]) => {
            this[key] = value;
        });
        // If the project is wrong we do not even have metadata then stop here
        if (!this.metadata) return;
        // Calculate any additional metadata or edit/fix some metadata fields
        if (!this.metadata.mdFrames) this.metadata.mdFrames = this.metadata.SNAPSHOTS;
        this.metadata.timeLength = (this.metadata.FRAMESTEP && this.metadata.mdFrames &&
            this.metadata.FRAMESTEP * this.metadata.mdFrames) || null;
        // In old metadata we may find numeric values in the program version
        if (typeof this.metadata.VERSION === 'number')
            this.metadata.VERSION = this.metadata.VERSION.toString();
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
            'rmsd-pairwise', 'dist-perres', 'hbonds', 'energies', 'pockets', 'sasa', 'clusters',
             'density', 'thickness', 'apl', 'channels', 'lipid-order', 'lipid-inter', 'dihenergies' ];
        for (const analysis of genericAnalyses) {
            this.directions[analysis] = this.analyses.includes(analysis);
        }
        // Add the electrostatic direction whenever there are interactions
        this.directions['electrostatic'] = this.analyses.includes('interactions');
        // Now set some specialized analyses
        // These analyses are hidden when the project is out of context
        // Their availability may be also more complicated than the generic ones
        // Set covid-19 specific analyses
        const anyReferenceWithEntropies = this.metadata && this.metadata.REFERENCES &&
            this.metadata.REFERENCES.find(ref => UNIPROTS_WITH_ENTROPIES.includes(ref));
        this.directions['mutations'] = Boolean(anyReferenceWithEntropies);
        const anyReferenceWithEpitopes = this.metadata && this.metadata.REFERENCES &&
            this.metadata.REFERENCES.find(ref => UNIPROTS_WITH_EPITOPES.includes(ref));
        this.directions['epitopes'] = Boolean(anyReferenceWithEpitopes);
        // Set MSM specific analyses
        if (this.metadata && this.metadata.METHOD === 'Markov state model (MSM)') {
            this.directions['populations'] = this.files && this.files.find(file => file === 'populations.json');
            this.directions['markov'] = this.analyses.includes('markov');
        }
        // Set the allostery analysis, which is hidden unless available
        if (this.analyses.includes('allostery')) this.directions['allostery'] = true;
        // Set the chemical shifts analysis, which is hidden unless available
        if (this.analyses.includes('chemshifts')) this.directions['chemical-shifts'] = true;
        // Set an internal object to save loading status of every call
        this._apiQueriesLoading = {};
        // Save the topology manager apart so we do not have to re-instantiate the class every time
        this._topologyManager = null;
        // Set the project base URL to request the API
        this._apiBaseUrl = `${BASE_PATH_PROJECTS}/${this.accessionAndMdNumber}`;
        // Set the creation date as a date object
        this.creationDate = new Date(this.creationDate).toLocaleDateString('en-GB');
        this.updateDate = this.updateDate ? new Date(this.updateDate).toLocaleDateString('en-GB') : undefined;
        // Set an internal variable to trak if the node is responding or not
        this.isNodeResponding = null;
    }
    // Declare the different field endpoints to request the API
    _apiEndpoints = {
        topology: `/topology`,
        structure: `/structure`,
        interactions: `/analyses/interactions`,
        memmap: `/analyses/mem-map`,
        references: `/references`,
        fileDescriptors: `/filenotes`,
        populations: `/files/populations.json`,
    }
    // Set a function to query the API
    // Note that the useAPI hook is smart enough to store and reuse identical calls
    // There is no need to handle this here
    _apiQuery = (fieldname, available = true, timeout = null) => {
        // Set the request URL
        let url = this._apiBaseUrl + this._apiEndpoints[fieldname];
        // Request the value if it is available only
        if (!available) url = null;
        // Do the API query
        const apiQuery = useAPI(url, undefined, timeout);
        if (!available) return;
        // Update the loading status
        this._apiQueriesLoading[url] = apiQuery.loading;
        // Update the "is node responding" status
        if (apiQuery.payload) this.isNodeResponding = true;
        if (apiQuery.error && apiQuery.error.noRespone) this.isNodeResponding = false;
        return apiQuery
    };

    // If this is the global client then check that the project exists in the source federated node
    // To do so, ask for any data which is not stored in the global server (e.g. topology data)
    // Thus we will force the global API to redirect the request to the federated node
    // Use a timeout for this query to check if the node is responding, since this query should be fast
    checkProblems = () => {
        // If this is not the global client then there is no need to check
        if (!HOST_CONFIG.global) return;
        // Request topology data with a timeout of 5 seconds
        const response = this._apiQuery('topology', undefined, 5000);
        // If we are still loading then there is no problem
        if (response.loading) return;
        // If we have an error instead of throwing return the error itself
        if (response.error) return response.error;
        // If we finally got the response then it means we are good
        if (response.payload) return;
    }

    // Interactions index getter
    // Note that here coexist the old and the new interactions data format
    // Old interactions contain all interactions data in the main analysis
    // New interactions have an index in the main analysis and every interaction data in a separated analysis
    // In both cases, every entry in the index has at least the interaction name
    // Use getInteraction to get the whole data of a specific interaction
    get interactionsIndex () {
        // Ask the API for the interactions analysis
        const response = this._apiQuery('interactions', this.hasInteractions);
        // Response is undefined when there are no interactions
        if (response === undefined) return undefined;
        if (response.loading) return undefined;
        if (response.error) throw new Error('Error when downloading project interactions: ' + response.error.message);
        if (!response.payload) throw new Error('Something went wrong with project interactions');
        return response.payload;
    }

    // Get the whole data of a specific interaction, given its index
    // In the new format, only the data of the requested interaction is downloaded
    // Note that this function uses hooks, so it must be called as a hook
    // Pass a null index to get no interaction at all
    getInteraction = (index = 0) => {
        const interactionsIndex = this.interactionsIndex;
        const isIndex = Boolean(interactionsIndex) && isInteractionsIndex(interactionsIndex);
        // Get the requested entry
        // Note that it may be missing when the index is out of range
        // This happens, for instance, right after changing MD, if the new MD has less interactions
        const entry = interactionsIndex && index !== null ? interactionsIndex[index] : undefined;
        // In the new format, ask the API for the interaction analysis
        const analysisUrl = isIndex && entry ? `${this._apiBaseUrl}/analyses/${entry.analysis}` : null;
        const response = useAPI(analysisUrl);
        // In the old format the entry already has all the interaction data
        const interactionData = isIndex ? response.payload : entry;
        // We will need the topology to complete the interaction
        const topology = this.topology;
        const interaction = useMemo(() => {
            if (!interactionData || !topology) return;
            return completeInteraction(interactionData, topology);
        }, [interactionData, topology]);
        if (response.error) throw new Error(`Error when downloading interaction "${entry.name}": ` + response.error.message);
        return interaction;
    }

    // Get the whole data of all interactions
    // Note that in the new format this means downloading every interaction analysis
    // Use getInteraction instead when only one interaction is needed
    // Interactions which fail to download are skipped
    // Note that this function uses hooks, so it must be called as a hook
    getAllInteractions = () => {
        const interactionsIndex = this.interactionsIndex;
        const isIndex = Boolean(interactionsIndex) && isInteractionsIndex(interactionsIndex);
        // In the new format, ask the API for every interaction analysis
        const analysesUrls = useMemo(() => {
            if (!isIndex) return [];
            return interactionsIndex.map(entry => `${this._apiBaseUrl}/analyses/${entry.analysis}`);
        }, [interactionsIndex, isIndex]);
        const responses = useBatchAPI(analysesUrls, 'json');
        // We will need the topology to complete interactions
        const topology = this.topology;
        return useMemo(() => {
            if (!interactionsIndex || !topology) return;
            if (!isIndex) return interactionsIndex.map(entry => completeInteraction(entry, topology));
            // Make sure responses belong to the current urls and wait for all of them to finish
            // Note that responses from previous urls may be returned before the new requests are sent
            const isReady = responses.length === analysesUrls.length &&
                responses.every((response, i) => response.url === analysesUrls[i] && !response.loading);
            if (!isReady) return;
            return responses
                .filter(response => response.payload)
                .map(response => completeInteraction(response.payload, topology));
        }, [interactionsIndex, isIndex, analysesUrls, responses, topology]);
    }

    // References getter
    get references () {
        const response = this._apiQuery('references');
        if (response.loading) return undefined;
        if (response.error) {
            // We handle this problem for references so the overview page can still request them and not crash
            if (response.error.noResponse) return undefined;
            throw new Error('Error when downloading project references: ' + response.error.message);
        }
        if (!response.payload) throw new Error('Something went wrong with project references');
        return response.payload;
    }
    // Specific references getters
    get proteinReferences () {
        const references = this.references;
        return useMemo(() => references && references.filter(ref => ref.ref_type === 'proteins'), [references]);
    }
    get ligandReferences () {
        const references = this.references;
        return useMemo(() => {
            if (!references) return undefined;
            const inchikeyReferencesWithLigand = references.filter(ref =>
                ref.ref_type === 'ligands' ||
                (ref.ref_type === 'inchikeys' && (
                    (ref.ligand && Object.keys(ref.ligand).length > 0) || // Current name
                    (ref.pubchem && Object.keys(ref.pubchem).length > 0) // Old name
                ))
            );
            // Get the ligand data only
            return inchikeyReferencesWithLigand.map(ref => {
                const ligandReference = ref.ligand || ref.pubchem;
                // Make sure every ligand data has a name
                if (!ligandReference.name) ligandReference.name = ref.name || 
                    (ref.lipidmaps && ref.lipidmaps.name) || 'Unnamed ligand';
                // Add the inchi reference inside the ligand reference
                ligandReference.inchiRef = ref;
                return ligandReference;
            });
        }, [references]);
    }
    // Temporal reference to get both ligand and inchikey for overview display
    get ligandAndLipidReferences () {
        const references = this.references;
        return useMemo(() => {
            if (!references) return undefined;
            const inchikeyReferencesWithLigand = references.filter(ref =>
                ref.ref_type === 'ligands' || ref.ref_type === 'inchikeys'
            );
            // Get the ligand data only
            return inchikeyReferencesWithLigand.map(ref => {
                const ligandReference = ref.ligand || ref.pubchem || ref;
                // Make sure every ligand data has a name
                if (!ligandReference.name) 
                    ligandReference.name = ref.name || ref.swisslipids?.entity_name || ref.lipidmaps?.name || 'Unnamed ligand';
                // Add the inchi reference inside the ligand reference
                ligandReference.inchiRef = ref;
                return ligandReference;
            });
        }, [references]);
    }
    get pdbReferences () {
        const references = this.references;
        return useMemo(() => references && references.filter(ref => ref.ref_type === 'pdbs'), [references]);
    }
    get chainReferences () {
        const references = this.references;
        return useMemo(() => references && references.filter(ref => ref.ref_type === 'chains'), [references]);
    }
    get inchikeyReferences () {
        const references = this.references;
        return useMemo(() => references && references.filter(ref => ref.ref_type === 'inchikeys'), [references]);
    }
    get lipidReferences () {
        const references = this.references;
        const ligandReferences = this.ligandReferences;
        return useMemo(() => {
            if (!references) return undefined;
            // Keep only inchikey references that were not already mapped as ligands.
            const ligandInchikeys = new Set(
                (ligandReferences || [])
                    .map(ref => ref.inchiRef && ref.inchiRef.inchikey)
                    .filter(Boolean)
            );
            return references.filter(ref =>
                ref.ref_type === 'inchikeys' && !ligandInchikeys.has(ref.inchikey)
            );
        }, [references, ligandReferences]);
    }
    get collectionReferences () {
        const references = this.references;
        return useMemo(() => references && references
            .filter(ref => ref.ref_type === 'collections')
            .map(ref => new Reference(ref.ref_type, ref)),
        [references]);
    }

    get membraneMapping () {
        const response = this._apiQuery('memmap');
        if (response.loading) return undefined;
        // No membrane mapping found
        if (response.error) return null;
        if (!response.payload) throw new Error('Something went wrong with project membrane mapping');
        return response.payload;
    }

    // Topology getter
    get topology () {
        // Get references to further load them to the topology manager
        // Note that this must be done here to respect hooks
        const references = this.references;
        // Set an object with references used by the topology manager already classified
        const topologyManagerReferences = {
            proteins: this.proteinReferences,
            ligands: this.ligandReferences,
            chains: this.chainReferences,
            inchikeys: this.inchikeyReferences
        };
        // Request topology data
        const response = this._apiQuery('topology');
        const membraneMapping = this.membraneMapping;
        // Make sure data is available
        if (response.loading) return undefined;
        // Wait for the mem-map to resolve before building the (built-once, cached) Topology; building it
        // now would bake in missing membrane data, making getters like membraneViewerSelection flip
        // mid-load. 'undefined' = still loading; resolved is either the payload or null (no membrane).
        if (membraneMapping === undefined) return undefined;
        if (response.error) {
            // We handle this problem for the topology so the overview page can still request it and not crash
            if (response.error.noResponse) return undefined;
            throw new Error('Error when downloading project topology: ' + response.error.message);
        }
        if (!response.payload) throw new Error('Something went wrong with project topology');
        // Return the stored value in case we already have it
        if (this._topologyManager) return this._topologyManager;
        // Make sure references are available
        if (references === undefined) return undefined;
        this._topologyManager = new Topology(response.payload, this.metadata, topologyManagerReferences, membraneMapping);
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

    // Get the reference frame
    // Coordinates from this frame are to be used when representing the structure
    // It is a frame which has been selected for distance between atoms to be coherent with atom bonds
    // i.e. there are not bonded atoms to far or non-bonded atoms to close
    // If bonds were to be guessed by atom distance they would be guess right
    get referenceFrame () {
        // If there is no reference frame then we use the first frame by default
        // Note that old outdated projects may not have reference frame
        if (this.refframe === undefined) return 0;
        return this.refframe;
    }

    // Get the main structure data
    // Note that the viewer would be already able to do it itself
    // However we do it from here since this data is to be reused along different pages
    // Thus we avoid having to download the same data every time
    get structureData () {
        // Ask the API for the structural data
        const response = this._apiQuery('structure');
        // Parse and memoize the result
        const structureData = useMemo(() => {
            if (!response.payload) return undefined;
            return new Blob( [ response.payload ], { type: 'text/plain'} );
        }, [response.payload]);
        // Wait for the response and handle some possible errors
        if (response.loading) return undefined;
        if (response.error) throw new Error('Error when downloading project structure: ' + response.error.message);
        if (!response.payload) throw new Error('Something went wrong with project structure');
        return structureData
    }

    // Get the main structure data parsed by NGL
    get nglStructure () {
        // Set a state to store the already parsed data
        const [ nglStructure, setNglStructure ] = useState(undefined);
        // Get the current structure data
        const structureData = this.structureData;
        // Load the structure data in NGL asynchronously    
        useEffect(() => {
            if (!structureData) return;
            autoLoad(structureData, { defaultRepresentation: false, ext: "pdb" })
                // Once the parse has been completed update the parsed structure state
                .then(prasedStructure => { setNglStructure({ file: prasedStructure }) })
                // If there is any problem then log it to the console
                .catch(error => {
                    console.error(error);
                    setNglStructure({ error });
                });
        }, [structureData])
        return nglStructure;
    }

    // Check if there is any loading query
    get loading () {
        for (const query of Object.values(this._apiQueriesLoading)) {
            if (query.loading) return true;
        }
        return false;
    }
}
  