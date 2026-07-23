import { generateRanges } from 'src/utils/auxiliar-functions';

// Set the default opacity value por PBC representations
const PBC_OPACITY = 0.3;

// Get NGL predefined default representations
// You may pass a residue indices selection of the only region to be represented
const getDefaultRepresentations = (topology, selectedResidueIndices = null) => {
    // If there is no topology yet then return here and wait for data to be downloaded
    if (!topology) return [];
    // Make sure the residue indices are in a set, and not in an array
    if (selectedResidueIndices) selectedResidueIndices = new Set(selectedResidueIndices);
    // Set a list to store all final representations
    const reps = [];
    // Coarse grain (CG) default coloring
    // ----------------------------------
    // CG residues are not representable in cartoon/licorice, so they are shown in spacefill and colored
    // to keep chains/bead types distinguishable. Note that CG atoms share a single generic element, so
    // the bead-type variety lives in the atom names, which is what the improved 'element' scheme uses.
    //  - Proteins: by chain, unless there is a single protein chain (coloring by chain would be useless),
    //    in which case by element.
    //  - Everything else: by element, unless the group has a single bead type (a single element/atom name),
    //    in which case by chain.
    // Count the CG protein chains globally so the protein rule is consistent across all chains.
    const cgProteinChains = new Set();
    topology.iterchains().forEach(chain => {
        let residues = chain.residues;
        if (selectedResidueIndices)
            residues = residues.filter(residue => selectedResidueIndices.has(residue.index));
        if (residues.some(residue => residue.isCg && residue.classification === 'protein'))
            cgProteinChains.add(chain.name);
    });
    const cgProteinColor = cgProteinChains.size > 1 ? 'chainid' : 'element';
    // Pick the color for a group of non-protein CG residues: by element unless the group holds a single
    // bead type (i.e. a single distinct atom name), in which case coloring by element shows no variety.
    const cgRestColor = residues => {
        const beadTypes = new Set();
        for (const residue of residues)
            for (const atom of residue.iteratoms())
                beadTypes.add(atom.name);
        return beadTypes.size > 1 ? 'element' : 'chainid';
    };
    // Iterate the different chains
    // Every representation, no matter the type, will be organized as one per chain
    topology.iterchains().forEach(chain => {
        // Set the chain label
        const metadataChainName = chain.metadataChainName
        const chainLabel = metadataChainName
            ? `${metadataChainName} (Chain ${chain.name})`
            : `Chain ${chain.name}`;
        // Get residues in the current chain
        let chainResidues = chain.residues;
        // Filter away residues which are not in the residue selection, if passed
        if (selectedResidueIndices)
            chainResidues = chainResidues.filter(residue => selectedResidueIndices.has(residue.index));
        // Represent a group of non-polymer residues (lipids, ions, solvent, other), separating all-atom
        // residues (which keep their default type/color) from coarse grain residues. CG residues are
        // colored by the CG "rest" rule (by element unless the group is a single bead type, then by chain).
        // Membranes are additionally shown as low-opacity spacefill so it is easy to see what is inside.
        const representRest = (residues, label, aaType, aaColor, isMembrane = false) => {
            const aaResidues = residues.filter(residue => !residue.isCg);
            if (aaResidues.length > 0) {
                const aaResidueIndices = aaResidues.map(residue => residue.index);
                const { rangedSelection: nglSelection } = topology.residueIndices2Ngl(aaResidueIndices);
                reps.push({
                    name: `${chainLabel} - ${label}`,
                    selection: nglSelection,
                    type: aaType,
                    color: aaColor,
                    residueIndices: aaResidueIndices,
                });
            }
            const cgResidues = residues.filter(residue => residue.isCg);
            if (cgResidues.length > 0) {
                const cgResidueIndices = cgResidues.map(residue => residue.index);
                const { rangedSelection: nglSelection } = topology.residueIndices2Ngl(cgResidueIndices);
                const representation = {
                    name: `${chainLabel} - ${label} (coarse grain)`,
                    selection: nglSelection,
                    type: isMembrane ? 'spacefill' : aaType,
                    color: cgRestColor(cgResidues),
                    residueIndices: cgResidueIndices,
                };
                if (isMembrane) representation.opacity = 0.3;
                reps.push(representation);
            }
        };
        // 1. Polymers such as proteins and nucleic acids
        // Represent polymers in cartoon and colored by chain
        // Note that coarse grain (CG) residues will not be properly represented in cartoon
        // For this reason we must create a separated representation for them in spacefill (vdw)
        const respresentPolymer = polymer => {
            // Start by classify residues (note that this logic is actually run only once and then stored)
            const residues = chainResidues.filter(residue => residue.classification === polymer);
            if (residues.length === 0) return;
            // First of all handle coarse grain residues
            const cgResidues = residues.filter(residue => residue.isCg);
            if (cgResidues.length > 0) {
            const cgResiduesIndices = cgResidues.map(residue => residue.index);
            // Parse residue indices to the NGL selection
            const { rangedSelection: nglSelection } = topology.residueIndices2Ngl(cgResiduesIndices);
            // Proteins are colored by chain (or by element if there is a single protein chain);
            // other polymers (nucleic acids) follow the same rule as the rest of non-protein groups
            const cgColor = polymer === 'protein' ? cgProteinColor : cgRestColor(cgResidues);
            // Set the new representation
            reps.push({
                name: `${chainLabel} - ${polymer} polymer (coarse grain)`,
                selection: nglSelection,
                type: 'spacefill',
                color: cgColor,
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
                // Get the target residues of this ligand
                const currentLigandResidues = ligandResidues
                    .filter(residue => residue.referenceId === ligandId);
                const currentLigandResidueIndices = currentLigandResidues.map(residue => residue.index);
                const { rangedSelection: nglSelection } = topology.residueIndices2Ngl(currentLigandResidueIndices);
                // Coarse grain ligands follow the same rule as the rest of non-protein groups
                const isCgLigand = currentLigandResidues.some(residue => residue.isCg);
                const color = isCgLigand ? cgRestColor(currentLigandResidues) : 'element';
                // Add the representation
                reps.push({
                    name: `${chainLabel} - ligand ${ligandId}`,
                    selection: nglSelection,
                    type: 'ball+stick',
                    color,
                    residueIndices: currentLigandResidueIndices,
                });
            }
        }
        // 3. Lipids, usually membranes
        // Represent all-atom membranes in grey licorice with reduced opacity (so we can see what is inside);
        // coarse grain membranes are shown as low-opacity spacefill instead (handled by representRest)
        const lipidClasses = new Set([ 'fatty', 'steroid' ]);  // Fallback with lipids classified by name
        const lipidResidues = chainResidues.filter(residue => residue.classification === 'lipid' || lipidClasses.has(residue.classification));
        representRest(lipidResidues, 'lipids', 'licorice', 'grey', true);
        // 4. Ions, single atoms
        // Represent ions using ball+stick and colored by element
        const ionResidues = chainResidues.filter(residue => residue.classification === 'ion');
        representRest(ionResidues, 'ions', 'ball+stick', 'element');
        // 5. Solvent, water
        const solventResidues = chainResidues.filter(residue => residue.classification === 'solvent');
        representRest(solventResidues, 'solvent', 'ball+stick', 'element');
        // 6. Other, anything else
        // Residues not falling in any previous section (e.g. carbohydrates) in purple spacefill
        const otherClasses = new Set([ 'carbohydrate', 'other', 'unknown' ]);
        const otherResidues = chainResidues.filter(residue => otherClasses.has(residue.classification));
        representRest(otherResidues, 'other', 'spacefill', 'purple');
    });
    // Finally, for every representation, check if we have PBC residues
    // PBC regions are represented with reduced opacity
    // If a representation is a mix of PBC and non-PBC regions then it is splitted in 2 representations
    const pbcResidues = topology.pbcResidues || new Set();
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
