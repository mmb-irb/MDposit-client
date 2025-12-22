import { generateRanges } from 'src/utils/auxiliar-functions';

// Set the default opacity value por PBC representations
const PBC_OPACITY = 0.3;

// Get NGL predefined default representations
const getDefaultRepresentations = topology => {
    // If there is no topology yet then return here and wait for data to be downloaded
    if (!topology) return [];
    // Set a list to store all final representations
    const reps = [];
    // Iterate the different chains
    // Every representation, no matter the type, will be organized as one per chain
    topology.iterchains().forEach(chain => {
        // Set the chain label
        const metadataChainName = chain.metadataChainName
        const chainLabel = metadataChainName
            ? `${metadataChainName} (Chain ${chain.name})`
            : `Chain ${chain.name}`;
        // Get residues in the current chain
        const chainResidues = chain.residues;
        // 1. Polymers such as proteins and nucleic acids
        // Represent polymers in cartoon and colored by chain
        // Note that coarse grain (CG) residues will not be propery represented in cartoon
        // For this reason we must create a separated representation for them in spacefill (vdw)
        const respresentPolymer = polymer => {
            // Start by classify residues (note that this logic is actually run only once and then stored)
            const residues = chainResidues.filter(residue => residue.classification === polymer);
            if (residues.length === 0) return;
            // First of all handle coarse grain residues
            const cgResidues = residues.filter(residue => residue.isCg);
            if (cgResidues.length > 0) {
            const cgResiduesIndices = cgResidues.map(residue => residue.index);
            const { rangedSelection: nglSelection } = topology.residueIndices2Ngl(cgResiduesIndices);
            // Set the new representation
            reps.push({
                name: `${chainLabel} - ${polymer} polymer (coarse grain)`,
                selection: nglSelection,
                type: 'spacefill',
                color: 'chainid',
                residueIndices: cgResiduesIndices,
            });
            }
            // Now keep going with the all atom residues
            const aaResidues = residues.filter(residue => !residue.isCg);
            // Get ranges of residue indices in a row
            const aaResiduesIndices = aaResidues.map(residue => residue.index);
            const ranges =  [ ...generateRanges(aaResiduesIndices) ];
            // Those regions with 3 residues or less are not representable by cartoon (NGL limitation)
            // Therefore, we will set an additional licorice representation for them
            const shortRanges = ranges.filter(range => range.length <= 3);
            if (shortRanges.length > 0) {
            // Transform the residue indices to a NGL selection
            const shortResidueIndices = shortRanges.reduce((ac, curr) => ac.concat(curr), []);
            const { rangedSelection: nglSelection } = topology.residueIndices2Ngl(shortResidueIndices);
            // Set the new representation
            reps.push({
                name: `${chainLabel} - ${polymer} polymer (short)`,
                selection: nglSelection,
                type: 'licorice',
                color: 'chainid',
                residueIndices: shortResidueIndices,
            });
            }
            // The long ranges are to be displayed in cartoon
            const longRanges = ranges.filter(range => range.length > 3);
            if (longRanges.length > 0) {
            // Transform the residue indices to a NGL selection
            const longResidueIndices = longRanges.reduce((ac, curr) => ac.concat(curr), []);
            const { rangedSelection: nglSelection } = topology.residueIndices2Ngl(longResidueIndices);
            // Set the new representation
            reps.push({
                name: `${chainLabel} - ${polymer} polymer`,
                selection: nglSelection,
                type: 'cartoon',
                color: 'chainid',
                residueIndices: longResidueIndices,
            });
            // If this is a nucleic polymer then set also a representation for its bases
            const nucleicPolymers = new Set([ 'dna', 'rna', 'nucleic' ]);
            if (nucleicPolymers.has(polymer)) {
                reps.push({
                    name: `${chainLabel} - ${polymer} bases`,
                    selection: nglSelection,
                    type: 'base',
                    color: 'resname',
                    residueIndices: longResidueIndices,
                });
            }
            }
        }
        // Represent protein polymers
        respresentPolymer('protein');
        // Represent DNA polymers
        respresentPolymer('dna');
        // Represent RNA polymers
        respresentPolymer('rna');
        // Represent other nucleic polymers
        respresentPolymer('nucleic');
        // 2. Ligands, small molecules which are referenced
        // Represent ligands in ball+stick (cpk) colored by element
        // Start by classify residues (note that this logic is actually run only once and then stored)
        const ligandResidues = chainResidues.filter(residue => residue.classification === 'ligand');
        if (ligandResidues.length > 0) {
            // In case we have more than a different ligand in this chain, set a representation for each one
            const ligandIds = new Set(ligandResidues.map(residue => residue.referenceId));
                for (const ligandId of ligandIds) {
                // Get the NGL selection of traget residues
                const currentLigandResidueIndices = ligandResidues
                    .filter(residue => residue.referenceId === ligandId)
                    .map(residue => residue.index);
                const { rangedSelection: nglSelection } = topology.residueIndices2Ngl(currentLigandResidueIndices);
                // Add the representation
                reps.push({
                    name: `${chainLabel} - ligand ${ligandId}`,
                    selection: nglSelection,
                    type: 'ball+stick',
                    color: 'element',
                    residueIndices: currentLigandResidueIndices,
                });
            }
        }
        // 3. Lipids, usually membranes
        // Represent membranes in grey licorice, with a reduced oppacity
        // Thus we ease observing what is there inside of the membrane
        // Start by finding lipid residues
        const lipidClasses = new Set([ 'fatty', 'steroid' ]);
        const lipidResidues = chainResidues.filter(residue => lipidClasses.has(residue.classification));
        if (lipidResidues.length > 0) {
            // Now parse them to a NGL selection
            const lipidResidueIndices = lipidResidues.map(residue => residue.index);
            const { rangedSelection: nglSelection } = topology.residueIndices2Ngl(lipidResidueIndices);
            // Add the representation
            reps.push({
                name: `${chainLabel} - lipids`,
                selection: nglSelection,
                type: 'licorice',
                color: 'grey',
                residueIndices: lipidResidueIndices,
            });
        }
        // 4. Ions, single atoms
        // Represent ions using spacefill (vdw) and colored by element
        // Start by finding ion residues
        const ionResidues = chainResidues.filter(residue => residue.classification === 'ion');
        if (ionResidues.length > 0) {
            // Now parse them to a NGL selection
            const ionResidueIndices = ionResidues.map(residue => residue.index);
            const { rangedSelection: nglSelection } = topology.residueIndices2Ngl(ionResidueIndices);
            // Add the representation
            reps.push({
                name: `${chainLabel} - ions`,
                selection: nglSelection,
                type: 'ball+stick',
                color: 'element',
                residueIndices: ionResidueIndices,
            });
        }
        // 5. Other, anything else
        // Residues not falling in any previous section will be represented in low opacity purple licorice
        // This includes solvent and unknown residues (e.g. carbohydrates)
        const otherClasses = new Set([ 'solvent', 'unknown' ]);
        const otherResidues = chainResidues.filter(residue => otherClasses.has(residue.classification));
        if (otherResidues.length > 0) {
            // Now parse them to a NGL selection
            const otherResiduesIndices = otherResidues.map(residue => residue.index);
            const { rangedSelection: nglSelection } = topology.residueIndices2Ngl(otherResiduesIndices);
            // Add the representation
            reps.push({
                name: `${chainLabel} - other`,
                selection: nglSelection,
                type: 'spacefill',
                color: 'purple',
                opacity: 0.3,
                residueIndices: otherResiduesIndices,
            });
        }
    });
    // Finally, for every representation, check if we have PBC residues
    // PBC regions are represented with reduced opacity
    // If a representation is a mix of PBC and non-PBC regions then it is splitted in 2 representations
    const pbcResidues = topology.pbcResidues;
    const finalReps = [];
    for (const representation of reps) {
        // Get non-PBC residue indices
        const nonPbcResidueIndices = representation.residueIndices.filter(
            index => !pbcResidues.has(index));
        // If none of residues is in PBC
        if (nonPbcResidueIndices.length === representation.residueIndices.length) {
            finalReps.push(representation);
            continue;
        }
        // Get PBC residue indices
        const pbcResidueIndices = representation.residueIndices.filter(
            index => pbcResidues.has(index));
        // If all residues are in PBC
        if (pbcResidueIndices.length === representation.residueIndices.length) {
            representation.opacity = PBC_OPACITY;
            representation.isPbc = true;
            finalReps.push(representation);
            continue;
        }
        // Otherwise it means we have a hybrid representation so we have to split it
        // DANI: No se ha testeado (no se me ocurría ninguna simulación con cadenas híbridas)
        // Set the NGL selections
        const { rangedSelection: nonPbcNglSelection } = topology.residueIndices2Ngl(nonPbcResidueIndices);
        const { rangedSelection: pbcNglSelection } = topology.residueIndices2Ngl(pbcResidueIndices);
        // Set the new representations
        const nonPbcRepresentation = {
            ...representation,
            name: representation.name += ' (non PBC)',
            selection: nonPbcNglSelection
        };
        const pbcRepresentation = {
            ...representation,
            name: representation.name += ' (PBC)',
            selection: pbcNglSelection,
            opacity: PBC_OPACITY,
            isPbc: true,
        };
        finalReps.push(nonPbcRepresentation);
        finalReps.push(pbcRepresentation);
    }
    // Clear the residue indices value from already processed representations
    // DANI: It wouldn't hurt but I may forget about it and be concerned when I see it in the future
    for (const representation of finalReps)
        delete representation.residueIndices;
    // Return processed representaions
    return finalReps;
};

export default getDefaultRepresentations;
