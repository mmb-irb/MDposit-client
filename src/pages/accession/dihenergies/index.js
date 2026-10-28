import React, { lazy, Suspense, useState, useContext, useMemo, useCallback, useEffect } from 'react';
// Import tools to retrieve data using the API
import { BASE_PATH_PROJECTS } from '../../../utils/constants';
import useAPI from '../../../hooks/use-api';
// Import project data
import { ProjectCtx } from '../../../contexts';
// Import MUI components
import { CardContent, TextField } from '@mui/material';
// Import tools to mae a custom color scheme
import { ColormakerRegistry } from 'ngl';
import { color as d3color, scaleLinear } from 'd3';
// Import some custom components
import Card from '../../../components/animated-card';
import ViewerSpawner from '../../../components/viewer-spawner';
import Loading from '../../../components/loading';
import Selector from 'src/components/selector';
import DoubleSideSwitch from 'src/components/double-side-switch';
// Import auxiliar function
import { caluclateAverage, round2cents, add, unique, min, max } from 'src/utils/auxiliar-functions';
// Import CSS style
import style from './style.module.css';

const Graph = lazy(() =>
    import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

// Set the color of each residue in the NGL representation
// WARNING: Grey looks better than white because the background may be white and residues are hard to see
const nglColorPlan = ['grey', 'yellow', 'red'];

// Set functions to group a list of object according to one of its properties
const groupByDihedral = dihedrals => {
    const grouped = {};
    dihedrals.forEach(dihedral => {
        const current = grouped[dihedral.name];
        if (current) current.push(dihedral);
        else grouped[dihedral.name] = [ dihedral ];
    });
    return grouped;
}
const groupByResidue = dihedrals => {
    const grouped = {};
    dihedrals.forEach(dihedral => {
        const current = grouped[dihedral.residue.index];
        if (current) current.push(dihedral);
        else grouped[dihedral.residue.index] = [ dihedral ];
    });
    return grouped;
}

// Two arrays with indetical atom names should have the same hash (if I am not wrong)
const getHash = atomNames => atomNames.sort().join();

// The name how this analysis is tagged in the webpage
// If no name is provided, the webpage will tag it with the default name
const TARGET_DIHEDRALS = new Map([
    [getHash(["O3'", "P", "O5'", "C5'"]), 'alpha'],
    [getHash(["P", "O5'", "C5'", "C4'"]), 'beta'],
    [getHash(["O5'", "C5'", "C4'", "C3'"]), 'gamma'],
    [getHash(["C5'", "C4'", "C3'", "O3'"]), 'delta'],
    [getHash(["C4'", "C3'", "O3'", "P"]), 'epsilon'],
    [getHash(["C3'", "O3'", "P", "O5'"]), 'zeta'],
    [getHash(["C1'", "C2'", "C3'", "C4'"]), 'nu2'],
    [getHash(["O4'", "C1'", "N9", "C8"]), 'chi'], // For purines
    [getHash(["O4'", "C1'", "N1", "C6"]), 'chi'], // For pyrimidines
]);
const AVAILABLE_TARGET_DIHEDRALS = Array.from(new Set(TARGET_DIHEDRALS.values()));

// For each dihedral, set the name of the atom we take as reference to tell which is its residue
// Note that we always use the second atom
const DIHEDRAL_RESIDUE_ATOM_REFERENCE = {
    alpha: "P",
    beta: "O5'",
    gamma: "C5'",
    delta: "C4'",
    epsilon: "C3'",
    zeta: "O3'",
    nu2: "C2'",
    chi: "C1'"
}

const DihedralEnergies = () => {
    // Get the current project data
    const { accessionAndMdNumber, topology } = useContext(ProjectCtx);
    // Send a request to the API with the url of some specific energies analysis
    const url = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/dihenergies`;
    const { loading, payload, error } = useAPI(url);
    // Classify dihedrals according to their name
    // Then normalize non-bonded energies per dihedral group
    const { dihedralsData, targetChains } = useMemo(() => {
        // Wait for data to be downloaded
        if (!payload || !topology) return {};
        // Set an empty list for every dihedral type
        const dihedralsData = [];
        AVAILABLE_TARGET_DIHEDRALS.forEach(dihedralName => dihedralsData[dihedralName] = []);
        // Iterate dihedrals in data and classify them
        payload.forEach(dihedralData => {
            // Make a shallow copy of dihedral data to avoid mutating the original payload
            const dihedral = { ...dihedralData };
            // Find the name of the dihedral according to its atom names
            const atoms = dihedral.indices.map(index => topology.getAtomByIndex(index));
            const atomNames = getHash(atoms.map(atom => atom.name));
            const dihedralName = TARGET_DIHEDRALS.get(atomNames);
            // If this is not one of our target dihedrals then ignore it
            if (!dihedralName) return;
            dihedral.name = dihedralName;
            // Find the residue this dihedral belongs to
            const referenceAtomName = DIHEDRAL_RESIDUE_ATOM_REFERENCE[dihedralName];
            const referenceAtom = atoms.find(atom => atom.name === referenceAtomName);
            dihedral.residue = referenceAtom.residue;
            // Set the dihedral label according to its residue
            dihedral.label = `${dihedral.residue.standardLabel} ${dihedralName}`;
            // Normalize a few values
            dihedral.normee = dihedral.ee ? dihedral.ee : 0;
            dihedral.normvdw = dihedral.vdw ? dihedral.vdw : 0;
            dihedral.total = dihedral.torsion + dihedral.normee + dihedral.normvdw
            dihedralsData.push(dihedral);
        });
        // Get chain indices for chains with target dihedrals
        const targetChains = unique(dihedralsData.map(dihedral => dihedral.residue.chain.name));
        return { dihedralsData, targetChains };
    }, [payload, topology]);

    // Set the index of the chain whose data is to be displayed
    const [selectedChain, setSelectedChain] = useState(null);
    // Handle when a new chain is set
    const handleChangeChain = useCallback(newValue => {
        const chainIndex = topology.chainNames.indexOf(newValue);
        setSelectedChain(chainIndex);
        setSelectedX(null);
    }, [topology]);
    // Set the selected chain as the first target chain as soon as we know the available target chains
    useEffect(() => {
        if (!targetChains) return;
        handleChangeChain(targetChains[0]);
    }, [targetChains])

    // Set the dihedral name/type whose data is to be displayed
    const [selectedDihedral, setSelectedDihedral] = useState('alpha');
    // Handle when the selected dihedral changes
    const handleChangeDihedral = useCallback(newValue => {
        setSelectedDihedral(newValue);
        setSelectedX(null);
    }, []);
    // This is a toggle state for when data is displayed per atom or per residue
    const [perResidue, setPerResidue] = useState(false);
    // Handle when the per residue / per dihedral switch changes
    const handleTogglePerResidue = useCallback(() => {
        setPerResidue(previous => !previous);
        setSelectedX(null);
    }, []);
    // Set selected data according to the selected dihedral or if it is to be sroted by residue
    const {
        selectedData,
        summaryData,
        torsionData,
        eeData,
        vdwData,
        totalData,
        xAxisValues,
        xTooltip,
        colorScheme
    } = useMemo(() => {
        // Wait for data to be downloaded and processed
        if (!dihedralsData || selectedChain === null) return {};
        // Filter away data which do not belong to the selected chain
        const filteredData = dihedralsData.filter(dihedral =>
            dihedral.residue.chainIndex === selectedChain);
        // Group data according to user parameters
        const groupedData = perResidue
            ? groupByResidue(filteredData)
            : groupByDihedral(filteredData);
        // Set selected data according to user parameters
        const selectedData = perResidue
            ? Object.values(groupedData).map(dihedralGroup => {
                // Get the residue label from a sample dihedral from the group
                const residue = dihedralGroup[0].residue;
                // Dihedrals must be joined by residue
                return {
                    residue: residue,
                    label: residue.standardLabel,
                    torsion: add(dihedralGroup.map(dihedral => dihedral.torsion)),
                    normee: add(dihedralGroup.map(dihedral => dihedral.normee)),
                    normvdw: add(dihedralGroup.map(dihedral => dihedral.normvdw)),
                    total: add(dihedralGroup.map(dihedral => dihedral.total)),
                } })
            : groupedData[selectedDihedral];
        // Set summary data
        // This is data to be shown in the summary table
        // Make an average of all values for every energy
        // Note that in nu2 all electrostatic and Van Der Waals values are expected to be null
        const torsionAverage = caluclateAverage(selectedData.map(dihedral => dihedral.torsion));
        const eeAverage = caluclateAverage(selectedData.map(dihedral => dihedral.normee));
        const vdwAverage = caluclateAverage(selectedData.map(dihedral => dihedral.normvdw));
        const totalAverage = caluclateAverage(selectedData.map(dihedral => dihedral.total));
        const summaryData = {
            torsion: round2cents(torsionAverage) + ' kcal/mol',
            ee: round2cents(eeAverage) + ' kcal/mol',
            vdw: round2cents(vdwAverage) + ' kcal/mol',
            total: round2cents(totalAverage) + ' kcal/mol',
        }
        // Now prepare graph data
        // Set the dataset for each graph
        const torsionData = {
            torsion: { data: selectedData.map(dihedral => dihedral.torsion), color: 'black' },
        };
        const eeData = {
            ee: { data: selectedData.map(dihedral => dihedral.normee), color: 'black' },
        };
        const vdwData = {
            vdw: { data: selectedData.map(dihedral => dihedral.normvdw), color: 'black' },
        };
        const totalValues = selectedData.map(dihedral => dihedral.total);
        const totalData = {
            total: { data: totalValues, color: 'black' },
        };
        // Set x axes values
        const xAxisValues = selectedData.map(dihedral => dihedral.label);
        // Set the tooltip generator for the graph hover
        const grouper = perResidue ? 'residue' : 'dihedral'
        const xTooltip = (_, xIndex) =>
            `${grouper} ${(xAxisValues[xIndex]) || xIndex}`;
        // Save data per residue index so it is retrieved faster
        // Note that selected data should never have more than one entry with the same residue index
        // No matter if data is grouped by residue or by dihedral
        const dataPerResidueIndex = {};
        selectedData.forEach(data => dataPerResidueIndex[data.residue.index] = data.total);
        // Set the color scale according to the maximum and minimum values
        const minValue = min(totalValues);
        const maxValue = max(totalValues);
        const nglColorScale = scaleLinear()
            .range(nglColorPlan)
            .domain([minValue, (minValue + maxValue) / 2, maxValue]);
        // Set each residue color in the ngl representation according to the color scale
        // WARNING: Grey looks better than white because the background may be white
        const colorScheme = ColormakerRegistry.addScheme(function(params) {
            this.atomColor = atom => {
            // Find the residue index and then the mean rmsd for this residue
            const residueIndex = atom.residueIndex;
            const value = dataPerResidueIndex[residueIndex];
            // If there is no data for this residue then paint it white
            if (value === undefined) return 16777215;
            // Calculate the interpolated rgb for this value
            // The interpolated color comes in rbg format
            const hexColor = d3color(nglColorScale(value)).formatHex();
            // The color interpolation returns a string like '#000000'
            // We remove the first character ('#') and parse it to integer from hexadecimal
            const color = parseInt(hexColor.substring(1), 16);
            return color;
            };
        });
        return {
            selectedData,
            summaryData,
            torsionData,
            eeData,
            vdwData,
            totalData,
            xAxisValues,
            xTooltip,
            colorScheme
        };
    }, [selectedChain, dihedralsData, selectedDihedral, perResidue]);

    // Get the default representations
    const defaultRepresentations = topology && topology.defaultRepresentations;;
    // Define the representations to be displayed in the viewer
    const [ representations, setRepresentations ] = useState(null);

    // Set the representations for the viewer
    // Set a custom color scheme painting residues by their accumulated dihedral energy
    useEffect(() => {
        // Wait for topology and default representations to be ready
        if (!topology || !defaultRepresentations) return;
        // Set the custom representation
        const selectedChainName = topology.chainNames[selectedChain];
        const nglChainSelection = ':' + selectedChainName;
        const customRepresentations = [
            {
                name: 'Dihedral energies',
                selection: nglChainSelection,
                color: 'custom',
                customScheme: colorScheme,
                reference: 'dihen_color'
            },
            {
                name: 'Reference',
                selection: 'not ' + nglChainSelection,
                type: 'licorice',
                color: 'element',
                opacity: 0.2,
                reference: 'dihen_ref'
            }
        ]
        // Setup every representation or update the already existing ones
        setRepresentations(previousRepresentations => {
            // Set the list of the rest of representations besides our custom one
            const restingRepresentations = previousRepresentations === null
                ? defaultRepresentations
                : previousRepresentations.filter(rep => {
                    rep.reference && rep.reference.substr(0,5) !== 'dihen'
                });
            // Return new representations
            return [
                ...customRepresentations,
                ...restingRepresentations
            ]
        });
        
    }, [topology, defaultRepresentations, selectedChain, colorScheme])

    // Track when one point in the graph is selected
    const [selectedX, setSelectedX] = useState(null);

    // Memoize the marks
    const marks = useMemo(() => {
        if (selectedX === null) return [];
        const selectedMark = {
            x: selectedX,
        };
        return [selectedMark];
    }, [selectedX]);

    // Set a callback to reset the X selection whenever the viewer is closed or nail
    const resetX = useCallback(viewer =>
        setSelectedX(previous => {
            if (viewer && viewer.selectedX === previous)
            return null;
            else return previous;
        }), []);

    if (!topology) return <Loading />;

    if (error) return error.toString();
    if (loading) return <Loading />;
    if (!payload) return 'Something bad happened';

    // Render
    return (<Suspense fallback={<Loading />}>
        <Card className={style.card}>
            <div className={style.horizontal}>
                <Selector
                    label={'Chain'}
                    options={targetChains}
                    selection={topology.chainNames[selectedChain]}
                    setter={handleChangeChain}
                />
                <Selector
                    label={'Dihedral'}
                    options={AVAILABLE_TARGET_DIHEDRALS}
                    selection={selectedDihedral}
                    setter={handleChangeDihedral}
                    disabled={perResidue}
                />
                <DoubleSideSwitch
                    firstLabel={'Per dihedral'}
                    secondLabel={'Per residue'}
                    isFirst={!perResidue}
                    onChange={handleTogglePerResidue}
                />
            </div>
            <CardContent className={style.horizontal}>
                {!summaryData ? null : (<CardContent>
                <legend className={style['margined-bottom']}>Energy averages</legend>
                <TextField
                    className={style['text-field']}
                    label="Torsion"
                    title="Average torsion energy"
                    value={summaryData.torsion}
                />
                <TextField
                    className={style['text-field']}
                    label="Electrostatic"
                    title="Average electorstatic energy"
                    value={summaryData.ee}
                />
                <TextField
                    className={style['text-field']}
                    label="Van Der Waals"
                    title="Average Van Der Waals energy"
                    value={summaryData.vdw}
                />
                <TextField
                    className={style['text-field']}
                    label="Total"
                    title="Average total energy"
                    value={summaryData.total}
                />
                </CardContent>)}
            </CardContent>
            <CardContent>
                <Graph
                    yData={torsionData}
                    xAxisValues={xAxisValues}
                    xTooltip={xTooltip}
                    title={'Torsions'}
                    yAxisLabel={'Energy (kcal/mol)'}
                    onSelect={setSelectedX}
                    fullPrecision
                    marks={marks}
                />
                <Graph
                    yData={eeData}
                    xAxisValues={xAxisValues}
                    xTooltip={xTooltip}
                    title={'Electrostatic'}
                    yAxisLabel={'Energy (kcal/mol)'}
                    onSelect={setSelectedX}
                    fullPrecision
                    marks={marks}
                />
                <Graph
                    yData={vdwData}
                    xAxisValues={xAxisValues}
                    xTooltip={xTooltip}
                    title={'Van Der Waals'}
                    yAxisLabel={'Energy (kcal/mol)'}
                    onSelect={setSelectedX}
                    fullPrecision
                    marks={marks}
                />
                <Graph
                    yData={totalData}
                    xAxisValues={xAxisValues}
                    xTooltip={xTooltip}
                    title={'Total'}
                    yAxisLabel={'Energy (kcal/mol)'}
                    onSelect={setSelectedX}
                    fullPrecision
                    marks={marks}
                />
            </CardContent>
        </Card>
        <ViewerSpawner
            // Set the new viewer or null if there is not a proper "selectedResidueIndices" value
            newViewer={selectedX !== null
            ? {
                selectedResidueIndices: [ selectedData[selectedX].residue.index ],
                representationsState: [ representations, setRepresentations ],
                // Just for further reference
                selectedX
                }
            : null
            }
            // If the nailed/closed viewer is the current viewer then reset the 'selectedX'
            onNail={resetX}
            onClose={resetX}
        />
    </Suspense>);
};

export default DihedralEnergies;
