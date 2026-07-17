import React, { useContext, useState, useEffect, useMemo } from 'react';
// Import context data
import { ProjectCtx } from 'src/contexts';
// Import visual assets
import {
    CardContent,
    CardActions,
    Button,
    Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink } from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '@mui/material/styles';
import style from './style.module.css';
// Import auxiliar components
import Info from 'src/components/info';
import Card from 'src/components/animated-card';
import LazyImg from 'src/components/lazy-img';
import MoleculeViewer from 'src/components/rdkit/rdkit_viewer';
import ExpanderButton from 'src/components/expander-button';
// Import some components which are specific to the ligands overview component
import LigandTable from './ligand-table';
// Import the documentation
import { docs } from 'src/pages/help/documentation';
// Import other tools
import https from 'https-browserify';
import Version from 'src/utils/version';

// Set mordred and morgan documentation
const mordredDoc = docs.find(doc => doc.id === 'mordred-descriptors');
const mordredTooltip = mordredDoc && mordredDoc.page && (<>
    {mordredDoc.page}
    <br />
    <br />
    To learn more about this page and how data is obtained please{' '}
    <a
        href={`/#/help#${mordredDoc.id}`}
        target="_blank"
        rel="noreferrer noopener"
    >
        {'click here'}
    </a>.
</>);
const morganDoc = docs.find(doc => doc.id === 'morgan-fingerprint');
const morganTooltip = morganDoc && morganDoc.page && (<>
    {morganDoc.page}
    <br />
    <br />
    To learn more about this page and how data is obtained please{' '}
    <a
        href={`/#/help#${morganDoc.id}`}
        target="_blank"
        rel="noreferrer noopener"
    >
        {'click here'}
    </a>.
</>);

const uniqueStrings = values => Array.from(new Set(values.filter(Boolean)));
const normalizeObject = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (Object.keys(value).length === 0) return null;
    return value;
};

const LigandsOverview = () => {

    // Get context data
    const { metadata, ligandAndLipidReferences, topology } = useContext(ProjectCtx);

    // Get the provided theme
    const theme = useTheme();
    const secondaryColor = theme.palette.secondary;
    const primaryDarkColor = theme.palette.primary.dark;

    // Group residue names by reference id so we can show topology residue names per ligand.
    const residueNamesByReferenceId = useMemo(() => {
        if (!topology) return {};
        const groupedByReferenceId = {};
        for (const residue of topology.iterresidues()) {
            if (!residue.name || !residue.referenceId) continue;
            const key = String(residue.referenceId);
            if (!groupedByReferenceId[key]) groupedByReferenceId[key] = new Set();
            groupedByReferenceId[key].add(residue.name);
        }
        // Join the residue names in case of glucolipids
        return Object.fromEntries(
            Object.entries(groupedByReferenceId).map(([key, values]) => [key, Array.from(values).sort().join(', ')])
        );
    }, [topology]);

    // Define the state and the function to show the table or not for Mordred (ligands)
    const [showTable, setShowTable] = useState(new Set());
    const handleSeeMore = pubchemId => {
        setShowTable((prev) => {
            const newShowTable = new Set(prev);
            if (newShowTable.has(pubchemId)) newShowTable.delete(pubchemId);
            else newShowTable.add(pubchemId);
            return newShowTable;
        });
    };

    // Define the state and the function to show the Morgan Fingerprint array (ligands)
    const [selectedFP, setSelectedFP] = useState(new Set());
    const showMorganFPArray = pubchemId => {
        setSelectedFP((prev) => {
            const newSelectedFP = new Set(prev);
            if (newSelectedFP.has(pubchemId)) newSelectedFP.delete(pubchemId);
            else newSelectedFP.add(pubchemId);
            return newSelectedFP;
        });
    };

    // Download ligand information for every ligand pubchem id in metadata
    const [pubchemInfo, setPubchemInfo] = useState({});
    useEffect(() => {
        if (!ligandAndLipidReferences) return;
        // Store requests so we can abort them all in the useEffect cleanup function in case they were not completed on time
        const requests = [];
        ligandAndLipidReferences.forEach(ligandReference => {
            const pubchemId = ligandReference.pubchem;
            if (typeof pubchemId !== 'string') return;
            const version = new Version(ligandReference.version);
            // Mine all data we want to display
            const data = {};
            if (version.greaterThan('0.0.0')) {
                // Use the data already mined by the workflow
                data.name = ligandReference.name;
                data.chemblID = ligandReference.chembl;
                data.chemblURL = 'https://www.ebi.ac.uk/chembl/explore/compound/' + ligandReference.chembl;
                data.drugbankID = ligandReference.drugbank;
                data.drugbankURL = 'https://go.drugbank.com/drugs/' + ligandReference.drugbank;
                setPubchemInfo(previous => {
                    return { ...previous, [pubchemId]: data };
                });
            } else {
                const pubchemAPIurl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${pubchemId}/JSON/`;
                let body = '';
                const request = https.get(pubchemAPIurl, response => {
                    response.on('data', chunk => { body += chunk });
                    response.on('end', () => {
                        // Get the original API response data
                        const sourceData = JSON.parse(body);
                        // First get the ligand name
                        const record = sourceData.Record;
                        if (!record) return;
                        data.name = record.RecordTitle;
                        // If there is a forced name then use add it to the name
                        const forcedLigandName = metadata.LIGANDNAMES && metadata.LIGANDNAMES[pubchemId];
                        if (forcedLigandName && forcedLigandName !== data.name) data.name += ` (${forcedLigandName})`;
                        // Get chembl id and url
                        const reference = record.Reference;
                        const chemblReference = reference && reference.find(ref => ref.SourceName === 'ChEMBL');
                        if (chemblReference) {
                            const chemblSplits = chemblReference.URL.split('/');
                            const compound = chemblSplits[chemblSplits.length - 1];
                            if (compound !== 'targets') {
                                data.chemblID = chemblSplits[chemblSplits.length - 1];
                                data.chemblURL = chemblReference.URL;
                            }
                        }
                        // Get drugbank id and url
                        const drugbankReference = reference.find(ref => ref.SourceName === 'DrugBank');
                        if (drugbankReference) {
                            data.drugbankURL = drugbankReference.URL;
                            const drugbankSplits = drugbankReference.URL.split('/');
                            data.drugbankID = drugbankSplits[drugbankSplits.length - 1];
                        }
                        // Add current ligand data to the overall ligands data object
                        setPubchemInfo(previous => {
                            return { ...previous, [pubchemId]: data };
                        });
                    });
                });
                requests.push(request);
            }
        });
        // DANI: No he comprovado que esto funcione debidamente
        return () => {
            for (const request of requests) request.abort();
        };
    }, [ligandAndLipidReferences, metadata]);

    // If there are no ligand references then show nothing
    if (!ligandAndLipidReferences || ligandAndLipidReferences.length === 0) return;
    // Render the component
    // Sort references by name for display
    const sortedReferences = [...ligandAndLipidReferences].sort((a, b) => {
        const nameA = (a?.name || '').toLowerCase();
        const nameB = (b?.name || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });
    return (<Card className={style.card}>
        <CardContent className={style['card-content']}>
            {sortedReferences.map((reference, i) => {
                if (!reference) return;
                const pubchemId = typeof reference.pubchem === 'string' ? reference.pubchem : null || reference.inchiRef?.lipidmaps?.pubchem_cid;
                const descriptorKey = String(pubchemId || reference.inchiRef?.inchikey || reference.inchikey || i);

                const inchiRef = reference.inchiRef;
                const swisslipids = normalizeObject(inchiRef?.swisslipids);
                const lipidmaps = normalizeObject(inchiRef?.lipidmaps);
                const swisslipidsId = swisslipids?.entity_id || null;
                const lipidmapsId = lipidmaps?.lm_id || null;
                const lipidClass = lipidmaps ? lipidmaps.main_class : null;
                const formula = reference.formula || inchiRef?.lipidmaps?.formula;
                const inchikey = reference.inchikey || inchiRef?.inchikey;
                const inchi = reference.inchi || inchiRef?.inchi;

                const pubchemData = pubchemId && pubchemInfo[pubchemId]
                    ? pubchemInfo[pubchemId]
                    : { name: reference.name };

                const swissSynonyms = (swisslipids && swisslipids.synonyms)
                    ? swisslipids.synonyms.map(synonym => synonym.name)
                    : [];
                const lipidmapsSynonyms = (lipidmaps && lipidmaps.synonyms)
                    ? lipidmaps.synonyms.split(';').map(synonym => synonym.trim())
                    : [];
                const synonyms = uniqueStrings([...swissSynonyms, ...lipidmapsSynonyms]);

                const swisslipidsUrl = swisslipidsId
                    ? `https://www.swisslipids.org/#/entity/${encodeURIComponent(swisslipidsId)}`
                    : null;
                const lipidmapsUrl = lipidmapsId
                    ? `https://www.lipidmaps.org/databases/lmsd/${lipidmapsId}`
                    : null;
                const residueNames = uniqueStrings([
                    ...(pubchemId ? [residueNamesByReferenceId[String(pubchemId)] || null] : []),
                    ((reference.inchikey && residueNamesByReferenceId[String(reference.inchikey)]) || null),
                    ((reference.inchiRef && reference.inchiRef.inchikey && residueNamesByReferenceId[String(reference.inchiRef.inchikey)]) || null),
                ]).sort();
                const residueName = residueNames.length > 0 ? residueNames[0] : null;
                return (<div key={descriptorKey} className={style['summary-list']}>
                    {i !== 0 && (<hr style={{ color: 'lightGrey' }} />) /* An horizontal line */}
                    {pubchemId && (
                        <LazyImg
                            src={`https://pubchem.ncbi.nlm.nih.gov/image/imgsrv.fcgi?cid=${pubchemId}&t=l`}
                            width="250" height="250" loading="lazy"
                            alt={`3D view of the ${pubchemData.name} structure`}
                            // cross origin and referrer policy should prevent pubchem cookies
                            crossOrigin="anonymous" referrerPolicy="no-referrer"
                            // default background color is like a "broken" white but this CSS trick fixes it
                            // this was recommended by people from pubchem
                            className={style['white-background']}
                        />
                    )}
                    <div className={style['ligand-header-row']}>
                        {residueName && (
                            <span
                                className={style['residue-name-badge']}
                                title="Residue name"
                                aria-label="Residue name"
                                style={{
                                    border: `1px solid ${secondaryColor.dark}`,
                                    color: secondaryColor.dark
                                }}
                            >
                                {residueName}
                            </span>
                        )}
                        <Typography variant="h6" sx={{ fontSize: '1.4rem', marginLeft: residueName ? '0.8rem' : 0 }}>{pubchemData.name.charAt(0).toUpperCase() + pubchemData.name.slice(1)}</Typography>
                    </div>
                    {pubchemId && (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div className={style["decorated-list-item__title"]}>Pubchem ID</div>
                            <div className={style["decorated-list-item__content"]} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                                <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${pubchemId}`} target="_blank" rel="noopener noreferrer">
                                    {pubchemId}
                                </a>
                            </div>
                        </div>
                    )}
                    {pubchemData.chemblID && (<div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className={style["decorated-list-item__title"]}>ChEMBL ID</div>
                        <div className={style["decorated-list-item__content"]} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                            <a href={pubchemData.chemblURL} target="_blank" rel="noopener noreferrer">
                                {pubchemData.chemblID}
                            </a>
                        </div>
                    </div>)}
                    {lipidmapsId && (<div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className={style['decorated-list-item__title']}>LIPID MAPS ID</div>
                        <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                            <a href={lipidmapsUrl} target="_blank" rel="noopener noreferrer">
                                {lipidmapsId}
                            </a>
                        </div>
                        </div>
                    )}
                    {swisslipidsId && (<div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className={style['decorated-list-item__title']}>SwissLipids ID</div>
                        <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                            <a href={swisslipidsUrl} target="_blank" rel="noopener noreferrer">
                                {swisslipidsId}
                            </a>
                        </div>
                        </div>
                    )}
                    {formula &&
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div className={style["decorated-list-item__title"]}>Molecular Formula</div>
                            <div className={style["decorated-list-item__content"]} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                                {formula.toString().split('').map((char, index) => {
                                    if (char.match(/[A-Z]/)) {
                                        return <span key={index} style={{ fontSize: '1.1em' }}>{char}</span>;
                                    } else if (char.match(/[0-9]/)) {
                                        return <sub key={index} style={{ fontSize: '0.9em' }}>{char}</sub>;
                                    } else {
                                        return char;
                                    }
                                })}
                            </div>
                        </div>
                    }
                    {reference.smiles &&
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div className={style["decorated-list-item__title"]}>SMILES</div>
                            <div className={style["decorated-list-item__content"]} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                                <ExpanderButton text={reference.smiles} />
                            </div>
                        </div>
                    }
                    {inchikey &&
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div className={style["decorated-list-item__title"]}>InChIKey</div>
                            <div className={style["decorated-list-item__content"]} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                                {inchikey}
                            </div>
                        </div>
                    }
                    {inchi &&
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div className={style["decorated-list-item__title"]}>InChI</div>
                            <div className={style["decorated-list-item__content"]} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                                <ExpanderButton text={inchi} />
                            </div>
                        </div>
                    }
                    <div>
                    </div>
                    <div>
                        {pubchemData.drugbankID && (<div style={{ display: 'flex', alignItems: 'center' }}>
                            <div className={style["decorated-list-item__title"]}>DrugBank ID</div>
                            <div className={style["decorated-list-item__content"]} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                                <a href={pubchemData.drugbankURL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {pubchemData.drugbankID}
                                </a>
                            </div>
                        </div>)}
                    </div>

                    {lipidClass && (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div className={style['decorated-list-item__title']}>Lipid classification</div>
                            <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                                {lipidClass}
                            </div>
                        </div>
                    )}



                    {synonyms.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div className={style['decorated-list-item__title']}>Synonyms</div>
                            <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                                <ExpanderButton text={synonyms.join('; ')} />
                            </div>
                        </div>
                    )}

                    <div>
                        {reference.mordred || reference.morgan_fp_bit_array ? (
                            <>
                                <Button onClick={() => handleSeeMore(descriptorKey)}
                                    variant='outlined'
                                    style={{ marginTop: '10px', marginLeft: '1rem' }}
                                    sx={{
                                        backgroundColor: secondaryColor.main,
                                        border: `1px solid ${secondaryColor.dark}`,
                                        color: theme.palette.secondary.contrastText,
                                        '&:hover': {
                                            backgroundColor: secondaryColor.light,
                                            border: `1px solid ${secondaryColor.dark}`,
                                        }
                                    }}
                                >
                                    Ligand Descriptors
                                </Button>
                                {showTable.has(descriptorKey) && (
                                    <Card className={style.card}>
                                        <div style={{ display: "flex" }}>
                                            {reference.mordred ? (
                                                <div style={{ flex: 1, width: "40%", textAlign: "center" }}>
                                                    <Typography variant="h6" className={style.title}>
                                                        Mordred Descriptors
                                                        {mordredDoc && mordredDoc.page && (
                                                            <Info tooltip={mordredTooltip} className={style.info} sx={{ color: primaryDarkColor }} />
                                                        )}
                                                    </Typography>
                                                    <LigandTable ligandReference={reference} type="mordred" />
                                                </div>
                                            ) : <></>}
                                            {reference.morgan_fp_bit_array ? (
                                                <div style={{ flex: 1, width: "60%", textAlign: "center" }}>
                                                    <Typography variant="h6" className={style.title}>
                                                        Morgan Fingerprint
                                                        {morganDoc && morganDoc.page && (
                                                            <Info tooltip={morganTooltip} className={style.info} sx={{ color: primaryDarkColor }} />
                                                        )}
                                                    </Typography>
                                                    <MoleculeViewer smiles={reference.smiles}
                                                        fingerprintData={reference.morgan_highlight_atoms}
                                                        mol_block={reference.mol_block} />
                                                    {reference.morgan_fp_bit_array && (
                                                        <div>
                                                            <Button onClick={() => showMorganFPArray(descriptorKey)}
                                                                variant='outlined'
                                                                style={{ marginTop: '10px', marginBottom: '10px' }}
                                                                sx={{
                                                                    backgroundColor: secondaryColor.main,
                                                                    border: `1px solid ${secondaryColor.dark}`,
                                                                    color: theme.palette.secondary.contrastText,
                                                                    '&:hover': {
                                                                        backgroundColor: secondaryColor.light,
                                                                        border: `1px solid ${secondaryColor.dark}`,
                                                                    }
                                                                }}
                                                            >
                                                                Show Morgan Fingerprint Array
                                                            </Button>
                                                            {selectedFP.has(descriptorKey) && (
                                                                <div>
                                                                    <textarea
                                                                        readOnly
                                                                        value={reference.morgan_fp_bit_array}
                                                                        className={style['textarea']}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div style={{ flex: 1, width: "60%", textAlign: "center" }}>
                                                    <h4>Morgan Fingerprint not available</h4>
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                )}
                            </>
                        ) : (
                            <></>
                        )}
                    </div>
                    {reference.pdbid && (<div>
                        <CardActions sx={{ flexWrap: 'wrap' }}>
                            <Button
                                component={'a'}
                                variant="contained"
                                href={`https://www.ebi.ac.uk/pdbe-srv/pdbechem/chemicalCompound/show/${reference.pdbid}`}
                                size="small"
                                target="_blank"
                                rel="noreferrer noopener"
                                sx={{
                                    backgroundColor: secondaryColor.dark,
                                    border: `1px solid ${secondaryColor.dark}`,
                                    color: theme.palette.secondary.contrastText,
                                    '&:hover': {
                                        backgroundColor: secondaryColor.main,
                                        border: `1px solid ${secondaryColor.main}`,
                                    }
                                }}
                            >
                                <FontAwesomeIcon icon={faLink} />
                                &nbsp;PDBe website
                            </Button>
                            <Button
                                component={'a'}
                                variant="contained"
                                href={`https://www.rcsb.org/ligand/${reference.pdbid}`}
                                size="small"
                                target="_blank"
                                rel="noreferrer noopener"
                                sx={{
                                    backgroundColor: secondaryColor.dark,
                                    border: `1px solid ${secondaryColor.dark}`,
                                    color: theme.palette.secondary.contrastText,
                                    '&:hover': {
                                        backgroundColor: secondaryColor.main,
                                        border: `1px solid ${secondaryColor.main}`,
                                    }
                                }}
                            >
                                <FontAwesomeIcon icon={faLink} />
                                &nbsp;RCSB website
                            </Button>
                        </CardActions>
                    </div>)}
                </div>);
            })}
        </CardContent>
    </Card>);
};

export default LigandsOverview;