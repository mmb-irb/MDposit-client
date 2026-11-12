import React, { useContext, useState, useEffect } from 'react';
// Import context data
import { ProjectCtx } from 'src/contexts';
// Import visual assets
import {
  CardContent,
  CardActions,
  Button,
  Typography,
  Chip,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink } from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '@mui/material/styles';
import style from './style.module.css';
// Import auxiliar components
import Card from 'src/components/animated-card';
import LazyImg from 'src/components/lazy-img';
// Import other tools
import https from 'https-browserify';

const COMMA_SEPARATOR = /\s*,\s*/;

const PdbsOverview = () => {

    // Get context data
    const { metadata, pdbReferences } = useContext(ProjectCtx);

    // Get the provided theme
    const theme = useTheme();
    const secondaryColor = theme.palette.secondary;

    // Get PDB ids listed in the project metadata
    const pdbIds = metadata.PDBIDS;
    // Ask the PDBBind for every PDB code to see if they have an entry for it
    const [pdbBindInfo, setPdbBindInfo] = useState({});
    useEffect(() => {
        if (!pdbIds) return;
        // Store requests so we can abort them all in the useEffect cleanup function in case they were not completed on time
        const requests = [];
        pdbIds.forEach(pdbId => {
        // Set the target URL
        // LORE:
        // We want to check if the PDB code exists or not in PDBBind
        // Note that the PDBBind API is not fast so just asking for the PDB code takes a while when the PDB code exists
        // Note that the PDBBind API is not user friendly and not documented so I don't know if there is a better endpoint
        // I wrote a message to the PDBBing technical support and they answered they did not have an API so...
        // I found the content endpoint which is a bit faster responding
        // If the pdb is not found the response is an instant object (still 200)
        // However if the pdb is found the response is a whole mmCif but the first chunk is fast
        const url = `https://www.pdbbind-plus.org.cn:11033/api/browser/content?pdbcode=${pdbId}`;
        const request = https.get(url, response => {
            response.on('data', chunk => {
            // Get the first chunk (since there will be no more) and convert it to string
            const firstChunk = '' + chunk;
            // If the first characters is '{' then it means this is a JSON, thus the pdb code does not exist
            // Otherwise the pdb code exists
            const exists = firstChunk[0] !== '{';
            setPdbBindInfo(previous => {
                return { ...previous, [pdbId]: exists };
            });
            // Now finish the response since we do not need the rest
            response.destroy();
            });
        });
        // Add the request to the list
        requests.push(request);
        });
        // DANI: No he comprovado que esto funcione debidamente
        return () => {
            for (const request of requests) request.abort();
        };
    }, [pdbIds]);
    // If there are no PDB references then show nothing
    if (!pdbReferences || pdbReferences.length === 0) return;
    // Render the component
    return (<Card className={style.card}>
        <CardContent className={style['horizontal-marginned']}>
            {pdbReferences.map((reference, i) => {
                const pdbId = reference.id;
                if (!reference) return 'PDB ' + pdbId + ' not found';
                // Mine pdb info
                const title = reference.title;
                const experimentalMethod = reference.method;
                const publishDate = new Date(reference.date);
                const keywords = Array.from(
                    new Set((reference.class || '').split(COMMA_SEPARATOR)),
                );
                // Get the organisms from the reference with reference.organism as old fallback
                const organisms = reference.organisms ||  Array.from(
                    new Set((reference.organism || '').split(COMMA_SEPARATOR)),
                ).filter(organism => organism); // Remove empty organism strings
                // Set the url to get the pdb image
                const lowerPdb = pdbId.toLowerCase();
                const imgSrc = pdbId &&
                    `https://cdn.rcsb.org/images/structures/${lowerPdb.substr(1, 2)}/${lowerPdb}/${lowerPdb}_assembly-1.jpeg`;
                // Get the PDBBind URL from the RCSB data
                const PDBBindExists  = pdbBindInfo[pdbId];
                return (
                    <div key={i}>
                    {i !== 0 && <hr style={{ color: 'lightGrey' }} />}
                    <CardContent className={style['vertcial-marginned']} style={{ minHeight: 380, marginTop: '-1rem' }}>
                        <div>
                        <LazyImg
                            src={imgSrc}
                            width="350"
                            height="350"
                            loading="lazy"
                            alt={`3D view of the ${pdbId} structure`}
                        />
                        <div className={style['summary-list']}>
                            <Typography variant="h6" sx={{ fontSize: '1.2rem' }}>{title}</Typography>
                            <div className={style['decorated-list']}>
                            <div className={style['decorated-list-item']}>
                            <div className={style['decorated-list-item__title']}>PDB Accession</div>
                                <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                                {pdbId}
                                </div>
                            </div>

                            <div className={style['decorated-list-item']}>
                            <div className={style['decorated-list-item__title']}>Experimental method</div>
                            <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                            {experimentalMethod}
                            </div>
                            </div>
                            <div className={style['decorated-list-item']}>
                                <div className={style['decorated-list-item__title']}>
                                Organism
                            {organisms.length > 1 && 's'}{' '}
                                </div>
                                <div className={style['decorated-list-item__content']} style={{ paddingLeft: '0rem' }}>
                                {organisms.length > 0 ? organisms.map((organism, o) => (
                                    <Chip
                                    key={o}
                                    label={organism}
                                    variant="outlined"
                                    sx={{
                                        color: secondaryColor.dark,
                                        borderColor: secondaryColor.dark
                                    }}                                
                                    className={style.chip}
                                    />
                                )) : <span className={style['grey']}>not available</span>}
                                </div>
                            </div>
                            <div className={style['decorated-list-item']}>
                            <div className={style['decorated-list-item__title']}>Keyword</div>
                            <div className={style['decorated-list-item__content']} style={{ paddingLeft: '0rem' }}> 
                            {keywords.length > 1 && 's'}{' '}
                            {keywords.map((keyword, k) => (
                                <Chip
                                key={k}
                                label={keyword}
                                variant="outlined"
                                sx={{
                                    color: secondaryColor.dark,
                                    borderColor: secondaryColor.dark
                                }}                            
                                className={style.chip}
                                />
                            ))}
                            </div>
                            </div>
                            <div className={style['decorated-list-item']}>
                            <div className={style['decorated-list-item__title']}>Publication date:</div>
                            <div className={style['decorated-list-item__content']} style={{ paddingLeft: '0rem' }}>
                            <time dateTime={publishDate.toISOString()}>
                                {publishDate.toDateString()}
                            </time>
                            </div>
                            </div>
                            </div>
                        </div>
                        </div>
                        <CardActions>
                        <Button
                            component="a"
                            variant="contained"
                            href={`https://www.ebi.ac.uk/pdbe/entry/pdb/${pdbId}`}
                            size="small"
                            sx={{
                            backgroundColor: secondaryColor.dark,
                            border: `1px solid ${secondaryColor.dark}`,
                            color: secondaryColor.contrastText,
                            '&:hover': {
                                backgroundColor: secondaryColor.main,
                                border: `1px solid ${secondaryColor.main}`,
                            }
                            }}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            <FontAwesomeIcon icon={faLink} />
                            &nbsp;PDBe website
                        </Button>
                        <Button
                            component={'a'}
                            variant="contained"
                            href={`https://www.rcsb.org/structure/${pdbId}`}
                            size="small"
                            sx={{
                            backgroundColor: secondaryColor.dark,
                            border: `1px solid ${secondaryColor.dark}`,
                            color: secondaryColor.contrastText,
                            '&:hover': {
                                backgroundColor: secondaryColor.main,
                                border: `1px solid ${secondaryColor.main}`,
                            }
                            }}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            <FontAwesomeIcon icon={faLink} />
                            &nbsp;RCSB website
                        </Button>
                        <Button
                            component={'a'}
                            variant="contained"
                            href={`https://3dbionotes.cnb.csic.es/?queryId=${pdbId}`}
                            size="small"
                            sx={{
                            backgroundColor: secondaryColor.dark,
                            border: `1px solid ${secondaryColor.dark}`,
                            color: secondaryColor.contrastText,
                            '&:hover': {
                                backgroundColor: secondaryColor.main,
                                border: `1px solid ${secondaryColor.main}`,
                            }
                            }}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            <FontAwesomeIcon icon={faLink} />
                            &nbsp;3DBIONOTES
                        </Button>
                        {PDBBindExists && <Button
                            component={'a'}
                            variant="contained"
                            href={`https://www.pdbbind-plus.org.cn/browse/${pdbId}`}
                            size="small"
                            sx={{
                            backgroundColor: secondaryColor.dark,
                            border: `1px solid ${secondaryColor.dark}`,
                            color: secondaryColor.contrastText,
                            '&:hover': {
                                backgroundColor: secondaryColor.main,
                                border: `1px solid ${secondaryColor.main}`,
                            }
                            }}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            <FontAwesomeIcon icon={faLink} />
                            &nbsp;PDBBind
                        </Button>}
                        </CardActions>
                    </CardContent>
                    </div>
                );
            })}
        </CardContent>
    </Card>);
};

export default PdbsOverview;