import React, { useContext, useState, useEffect } from 'react';
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

const LigandsOverview = () => {

    // Get context data
    const { metadata, ligandReferences } = useContext(ProjectCtx);

    // Get the provided theme
    const theme = useTheme();
    const secondaryColor = theme.palette.secondary;
    const primaryDarkColor = theme.palette.primary.dark;

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
        if (!ligandReferences) return;
        // Store requests so we can abort them all in the useEffect cleanup function in case they were not completed on time
        const requests = [];
        ligandReferences.forEach(ligandReference => {
        const pubchemId = ligandReference.pubchem;
        if (typeof pubchemId !== 'string') return;
        const pubchemAPIurl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${pubchemId}/JSON/`;
        let body = '';
        const request = https.get(pubchemAPIurl, response => {
            response.on('data', chunk => { body += chunk });
            response.on('end', () => {
                // Get the original API response data
                const sourceData = JSON.parse(body);
                // Mine all data we want to display
                const data = {};
                // First get the ligand name
                const record =  sourceData.Record;
                data.name = record.RecordTitle;
                // If there is a forced name then use add it to the name
                const forcedLigandName = metadata.LIGANDNAMES && metadata.LIGANDNAMES[pubchemId];
                if (forcedLigandName && forcedLigandName !== data.name) data.name += ` (${forcedLigandName})`;
                // Get chembl id and url
                const reference = record.Reference;
                const chemblReference = reference.find(ref => ref.SourceName === 'ChEMBL');
                if (chemblReference) {
                    data.chemblURL = chemblReference.URL;
                    const chemblSplits = chemblReference.URL.split('/');
                    data.chemblID = chemblSplits[chemblSplits.length - 1];
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
        });
        // DANI: No he comprovado que esto funcione debidamente
        return () => {
            for (const request of requests) request.abort();
        };
    }, [ligandReferences]);
    // If there are no PDB references then show nothing
    if (Object.keys(pubchemInfo).length === 0) return;
    // Render the component
    return (<Card className={style.card}>
        <CardContent className={style['card-content']}>
            {Object.entries(pubchemInfo).map(([pubchemId, pubchemData], i) => {
            const ligandReference = ligandReferences &&
                ligandReferences.find(ref => ref.pubchem === pubchemId);
            return ( <div key={i} className={style['summary-list']}>
                {i !== 0 && ( <hr style={{ color: 'lightGrey' }} /> ) /* An horizontal line */}
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
                <Typography variant="h6" sx={{ fontSize: '1.4rem' }}>{pubchemData.name}</Typography>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className={style["decorated-list-item__title"]}>Pubchem ID</div>
                    <div className={style["decorated-list-item__content"]} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                    <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${pubchemId}`} target="_blank" rel="noopener noreferrer">
                        {pubchemId}
                    </a>
                    </div>
                </div>
                {ligandReference && ligandReference.formula &&
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div className={style["decorated-list-item__title"]}>Molecular Formula</div>
                    <div className={style["decorated-list-item__content"]} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                        {ligandReference.formula.toString().split('').map((char, index) => {
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
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {ligandReference && ligandReference.smiles && <>
                    <div className={style["decorated-list-item__title"]}>SMILES</div>
                    <div className={style["decorated-list-item__content"]} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                        <ExpanderButton text={ligandReference["smiles"]}/>
                    </div>
                    </>
                    }
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {ligandReference && ligandReference.inchi && <>
                    <div className={style["decorated-list-item__title"]}>InChI</div>
                    <div className={style["decorated-list-item__content"]} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                        <ExpanderButton text={ligandReference["inchi"]}/>
                    </div>
                    </>
                    }
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {ligandReference && ligandReference.inchikey && <>
                    <div className={style["decorated-list-item__title"]}>InChIKey</div>
                    <div className={style["decorated-list-item__content"]} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                        {ligandReference.inchikey}
                    </div>
                    </>
                    }
                </div>
                <div>
                {pubchemData.chemblID && (<div style={{ display: 'flex', alignItems: 'center' }}>
                    <div className={style["decorated-list-item__title"]}>ChEMBL ID</div>
                    <div className={style["decorated-list-item__content"]} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                    <a href={pubchemData.chemblURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    >
                    {pubchemData.chemblID}
                    </a>
                    </div>
                </div>)}
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
                <div>
                    {ligandReference?.mordred || ligandReference?.morgan_fp_bit_array ? (
                    <>
                        <Button onClick={() => handleSeeMore(pubchemId)} 
                        variant='outlined' 
                        style={{ marginTop: '10px', marginBottom: '10px', marginLeft: '1rem' }}
                        sx={{
                        backgroundColor: secondaryColor.main,
                        border: `1px solid ${secondaryColor.dark}`,
                        color: '#000',
                        '&:hover': {
                            backgroundColor: secondaryColor.light,
                            border: `1px solid ${secondaryColor.dark}`,
                        }
                        }}
                        >
                        Ligand Descriptors
                        </Button>
                        {showTable.has(pubchemId) && (
                        <Card className={style.card}>
                            <div style={{ display: "flex" }}>                            
                            {ligandReference.mordred ? (
                                <div style={{ flex: 1, width: "40%", textAlign: "center" }}>
                                <Typography variant="h6" className={style.title}>
                                    Mordred Descriptors
                                    {mordredDoc && mordredDoc.page && (
                                    <Info tooltip={mordredTooltip} className={style.info} sx={{color: primaryDarkColor}}/>
                                    )}
                                </Typography>
                                <LigandTable ligandReference={ligandReference} type="mordred"/>
                                </div>
                            ) : <></>}
                            {ligandReference.morgan_fp_bit_array ? (
                                <div style={{ flex: 1, width: "60%", textAlign: "center" }}>
                                <Typography variant="h6" className={style.title}>
                                    Morgan Fingerprint
                                    {morganDoc && morganDoc.page && (
                                    <Info tooltip={morganTooltip} className={style.info} sx={{color: primaryDarkColor}}/>
                                    )}
                                </Typography>
                                <MoleculeViewer smiles={ligandReference.smiles} 
                                fingerprintData={ligandReference.morgan_highlight_atoms}
                                mol_block={ligandReference.mol_block}/>
                                {ligandReference.morgan_fp_bit_array && (
                                    <div>
                                    <Button onClick={() => showMorganFPArray(pubchemId)} 
                                    variant='outlined' 
                                    style={{ marginTop: '10px', marginBottom: '10px' }}
                                    sx={{
                                        backgroundColor: secondaryColor.main,
                                        border: `1px solid ${secondaryColor.dark}`,
                                        color: '#000',
                                        '&:hover': {
                                        backgroundColor: secondaryColor.light,
                                        border: `1px solid ${secondaryColor.dark}`,
                                        }
                                    }}
                                    >
                                        Show Morgan Fingerprint Array
                                    </Button>
                                    {selectedFP.has(pubchemId) && (
                                        <div>
                                        <textarea
                                            readOnly
                                            value={ligandReference.morgan_fp_bit_array}
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
                        <p>No descriptors available</p>
                    )}
                </div>
                {ligandReference && ligandReference.pdbid && (<div>
                    <CardActions>
                        <Button
                            component={'a'}
                            variant="contained"
                            href={`https://www.ebi.ac.uk/pdbe-srv/pdbechem/chemicalCompound/show/${ligandReference.pdbid}`}
                            size="small"
                            target="_blank"
                            rel="noreferrer noopener"
                            sx={{
                            backgroundColor: secondaryColor.dark,
                            border: `1px solid ${secondaryColor.dark}`,
                            color: '#000',
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
                            href={`https://www.rcsb.org/ligand/${ligandReference.pdbid}`}
                            size="small"
                            target="_blank"
                            rel="noreferrer noopener"
                            sx={{
                            backgroundColor: secondaryColor.dark,
                            border: `1px solid ${secondaryColor.dark}`,
                            color: '#000',
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