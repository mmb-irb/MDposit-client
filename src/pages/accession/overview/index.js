import React, { useContext, useRef, useState } from 'react';
// Import context data
import { ProjectCtx } from '../../../contexts';
// Import visual assets
import {
  CardContent,
  Typography,
  Chip,
  Tabs,
  Tab,
  Box,
  Grid,
  Button,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExclamationTriangle,
  faClipboardList,
} from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '@mui/material/styles';
import style from './style.module.css';
import { prettyEnumerate } from '../../../utils/pretty-enumerate';
// Import auxiliar components
import Card from '../../../components/animated-card';
import LazyImg from 'src/components/lazy-img';
// Import other components which are part of the overview
import LigandsOverview from './ligands';
import PdbsOverview from './pdbs';
import SystemKeywords from './keywords';
// Import constants
import { HOST_CONFIG } from '../../../utils/constants';

const Overview = React.memo(() => {
  // Get context data
  const {
    accession,
    internalId,
    identifier,
    published,
    metadata,
    proteinReferences,
    collectionReferences,
    mdCount,
    node,
    creationDate,
    updateDate
  } = useContext(ProjectCtx);

  // State for protein sequence tabs
  const [proteinSeqTab, setProteinSeqTab] = useState(0);
  // State for nucleic sequence tabs
  const [nucleicSeqTab, setNucleicSeqTab] = useState(0);

  // Get the provided theme
  const theme = useTheme();
  const secondaryColor = theme.palette.secondary;
  const typeSettings = {
    trajectory: {
      label: 'Trajectory',
      color: theme.palette.secondary.main,
    },
    ensemble: {
      label: 'Ensemble',
      color: theme.palette.secondary.dark,
    },
  };

  // Parse the citation text
  // i.e. add break lines, "elevated" text, etc.
  let citation;
  if (metadata && metadata.CITATION) {
    // Replace the metadat break lines by proper JSX break lines
    citation = metadata.CITATION.replace(/\(br\)/g, '\n');
    // Get all sup characters
    const pattern = /\^([\S\s])/g;
    const sups = [];
    let sup;
    while ((sup = pattern.exec(metadata.CITATION)) != null) {
      sups.push(sup[1]);
    }
    // Split the citation by 'sups' and remove them
    const fragments = citation.split(/\^[\S\s]/g);
    // Foreach sup, join the previous fragment with it
    const compiled = [];
    for (const sup in sups) {
      compiled.push(fragments[sup]);
      compiled.push(<sup key={sup}>{sups[sup]}</sup>);
    }
    compiled.push(fragments[fragments.length - 1]);
    // Finally, join everything into a single string
    citation = compiled;
  }

  // Set if the collections section is to be displayed
  // If the client is focused in one collection only then there is no need
  const showCollections = !HOST_CONFIG.singleCollection;

  // Retain the last collection references so the logo images are not unmounted (and thus reloaded)
  // while references are requested again on replica change
  const retainedCollectionReferences = useRef(null);
  if (collectionReferences) retainedCollectionReferences.current = collectionReferences;
  const retained = retainedCollectionReferences.current;
  const expectedCollections = (metadata && metadata.COLLECTIONS) || [];
  const displayedCollectionReferences = collectionReferences || (
    retained && retained.length === expectedCollections.length &&
    retained.every(reference => expectedCollections.includes(reference.id)) && retained
  );

  return (
    <>
      {metadata && (
        <Card className={style.card}>
          <CardContent className={style['card-content']}>
            <a className={style.title}>{metadata.NAME || 'Unnamed'}</a>
            {mdCount > 1 && metadata.mdName && <a className={style.grey}>({metadata.mdName})</a>}
            <div className={style['summary-list']}>
              {metadata.TYPE && (
                <Chip
                  label={typeSettings[metadata.TYPE].label}
                  variant="outlined"
                  style={{
                    backgroundColor: typeSettings[metadata.TYPE].color,
                    color: secondaryColor.contrastText,
                    fontSize: '1em',
                    marginRight: '0.8em',
                  }}
                  className={style.chip}
                />
              )}
              {metadata.METHOD}
              {metadata.DESCRIPTION && metadata.DESCRIPTION.length > 0 &&
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className={style['decorated-list-item__title']}>Description</div>
                <div className={style['decorated-list-item__content']} style={{  wordBreak: 'break-word', borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                  {metadata.DESCRIPTION}
                </div>
              </div>}
              {metadata.AUTHORS && metadata.AUTHORS.length > 0 &&
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className={style['decorated-list-item__title']}>Authors</div>
                <div className={style['decorated-list-item__content']} style={{ wordBreak: 'break-word', borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                  {prettyEnumerate(metadata.AUTHORS)}
                </div>
              </div>}
              {metadata.GROUPS && metadata.GROUPS.length > 0 &&
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className={style['decorated-list-item__title']}>Groups</div>
                <div className={style['decorated-list-item__content']} style={{ wordBreak: 'break-word', borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                  {prettyEnumerate(metadata.GROUPS)}
                </div>
              </div>}
              {/* Node will exist only in the global API, and the global client has nodes as options */}
              {HOST_CONFIG.global && node && 
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className={style['decorated-list-item__title']}>Node</div>
                <div className={style['decorated-list-item__content']} style={{ wordBreak: 'break-word', borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                  {HOST_CONFIG.nodeNiceNames[node] || node}
                </div>
              </div>}
              {metadata.CONTACT && metadata.CONTACT.length > 0 &&
               <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className={style['decorated-list-item__title']}>Contact</div>
                <div className={style['decorated-list-item__content']} style={{ wordBreak: 'break-word', borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                  {metadata.CONTACT}
                </div>
              </div>}
              {metadata.PROGRAM && metadata.PROGRAM.length > 0 &&
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className={style['decorated-list-item__title']}>Program</div>
                <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                  {metadata.PROGRAM}
                </div>
              </div>}
              {metadata.VERSION && metadata.VERSION.length > 0 &&
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className={style['decorated-list-item__title']}>Version</div>
                <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                  {metadata.VERSION}
                </div>
              </div>}
              {metadata.LINKS && metadata.LINKS.length > 0 &&
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className={style['decorated-list-item__title']}>Links</div>
                <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                {metadata.LINKS.map((link, l) => {
                  let url = link.url;
                  if (!url.startsWith('http')) url = 'https://' + url;
                  return (<div key={l}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {link.name}
                    </a>
                  </div>)
                })}
                </div>
              </div>}
              <SystemKeywords keywords={metadata.SYSKEYS} />
              {metadata.WARNINGS &&
                metadata.WARNINGS.map((warning, w) => (
                  <div key={w} style={{ fontWeight: 'bold' }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} size={'lg'} />
                    {' ' + warning.message}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
      {showCollections && displayedCollectionReferences && displayedCollectionReferences.length > 0 &&
        <Card className={style.card}>
          <CardContent className={style['card-content']}>
            {displayedCollectionReferences.map((collection, index) => (
              <div key={index}>
                {index !== 0 && <hr style={{ color: 'lightGrey', marginTop: '1em' }}/>}
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }} >
                  <div>
                    <Typography marginBottom={'10px'} variant="h6" sx={{ fontSize: '1.4rem' }}>
                      {collection.name}
                    </Typography>
                    <div>{collection.description}</div>
                    <Button component="a" variant="contained" size="small"
                      href={`/#/collection/${collection.id}`} target="_blank" rel="noreferrer noopener"
                      sx={{
                        marginTop: '1em',
                        backgroundColor: secondaryColor.dark,
                        border: `1px solid ${secondaryColor.dark}`,
                        color: secondaryColor.contrastText,
                        '&:hover': {
                            backgroundColor: secondaryColor.main,
                            border: `1px solid ${secondaryColor.main}`,
                        }
                      }}
                    >
                      <FontAwesomeIcon icon={faClipboardList} size='lg' style={{ marginRight: '0.5em' }}/>
                      See collection
                    </Button>
                  </div>
                  <LazyImg
                    src={collection.image} loading="lazy" alt={`Collection logo`}
                    style={{ maxWidth: '30%', height: 'auto', margin: '0 1em' }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      }
      {metadata && Array.isArray(metadata.NUCLSEQ) && metadata.NUCLSEQ.length > 0 && (
        <Card className={style.card}>
          <CardContent className={style['card-content']}>
            <div>
              <Typography marginBottom={'10px'} variant="h6" sx={{ fontSize: '1.4rem' }}>Nucleic Sequences:</Typography>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs 
                  value={nucleicSeqTab} 
                  onChange={(event, newValue) => setNucleicSeqTab(newValue)}
                  aria-label="nucleic sequence tabs"
                >
                  {metadata.NUCLSEQ.map((seq, index) => (
                    <Tab key={index} label={`Sequence ${index + 1} (5' → 3')`} />
                  ))}
                </Tabs>
              </Box>
              {metadata.NUCLSEQ.map((seq, index) => (
                <div
                  key={index}
                  role="tabpanel"
                  hidden={nucleicSeqTab !== index}
                  className={style['card-background']}
                >
                  {nucleicSeqTab === index && (
                    <Box sx={{ pt: 2 }}>
                      <textarea
                        readOnly
                        value={seq}
                        className={style['textarea']}
                        rows={Math.ceil(seq.length / 150) + 1}
                      />
                    </Box>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {metadata && Array.isArray(metadata.PROTSEQ) && metadata.PROTSEQ.length > 0  && (
        <Card className={style.card}>
          <CardContent className={style['card-content']}>
            <div>
              <Typography marginBottom={'10px'} variant="h6" sx={{ fontSize: '1.4rem' }}>Protein Sequences:</Typography>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs 
                  value={proteinSeqTab} 
                  onChange={(event, newValue) => setProteinSeqTab(newValue)}
                  aria-label="protein sequence tabs"
                >
                  {metadata.PROTSEQ.map((seq, index) => (
                    <Tab key={index} label={`Sequence ${index + 1}`} />
                  ))}
                </Tabs>
              </Box>
              {metadata.PROTSEQ.map((seq, index) => (
                <div
                  key={index}
                  role="tabpanel"
                  hidden={proteinSeqTab !== index}
                  className={style['card-background']}
                >
                  {proteinSeqTab === index && (
                    <Box sx={{ pt: 2 }}>
                      <textarea
                        readOnly
                        value={seq}
                        className={style['textarea']}
                        rows={Math.ceil(seq.length / 150) + 1}
                      />
                    </Box>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {proteinReferences && proteinReferences.length > 0 && (
        <Card className={style.card}>
          <CardContent className={style['card-content']}>
            <Typography variant="h6" sx={{ fontSize: '1.4rem', marginBottom: '10px' }}>UniProt References</Typography>
            <Grid container spacing={2}>
              {proteinReferences.map((reference, i) => (
                <Grid size={{ xs: 12, md: proteinReferences.length > 1 ? 6 : 12 }} key={i}>
                  <div className={`${style['card-background']} ${style['protein-reference-card']}`}>
                    <div className={style['summary-list']}>
                      <Typography variant="h6" sx={{ fontSize: '1.4rem' }}>{reference.name}</Typography>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className={style['decorated-list-item__title']}>Gene</div>
                        <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                          {reference.gene && `${reference.gene}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className={style['decorated-list-item__title']}>Organism</div>
                        <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                          {reference.organism && `${reference.organism}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className={style['decorated-list-item__title']}>UniProt ID</div>
                        <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                          {reference.uniprot && `UniProt ID: `}
                          <a
                            href={'https://www.uniprot.org/uniprotkb/' + reference.uniprot}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {reference.uniprot}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}
      <PdbsOverview/>
      <LigandsOverview/>
      <Card className={style.card}>
        <CardContent className={style['card-content']}>
          <Typography variant="h6">License</Typography>
          <div className={style['summary-list']}>
            <div>{(metadata && metadata.LICENSE) || 'Not available'}</div>
            <a
              href={metadata && metadata.LINKCENSE}
              target="_blank"
              rel="noopener noreferrer"
            >
              {metadata && metadata.LINKCENSE && 'More information'}
            </a>
          </div>
        </CardContent>
        {citation && (
          <CardContent className={style['card-content']}>
            <Typography variant="h6">Citation</Typography>
            <div className={style['summary-list']}>
              <div>
                The use of any trajectory data in any reports or publications of
                results obtained with the trajectory data should be acknowledged
                by including a citation to:
              </div>
              <div>{citation}</div>
            </div>
          </CardContent>
        )}
        {metadata.THANKS && (
          <CardContent className={style['card-content']}>
            <Typography variant="h6">Acknowledgements</Typography>
            <div className={style['summary-list']}>
              <div>{metadata.THANKS}</div>
            </div>
          </CardContent>
        )}
        <CardContent className={style['card-content']}>
          <Typography variant="h6">Project information</Typography>
          <div className={style['summary-list']}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
             <div className={style['decorated-list-item__title']} style={{flexBasis: '16vw'}}>Public project accession:</div>
             <div className={style['decorated-list-item__content']} style={{ paddingLeft: '0rem' }}>
              {accession || <code>not assigned</code>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
             <div className={style['decorated-list-item__title']} style={{flexBasis: '16vw'}}>Internal project identifier:</div>
             <div className={style['decorated-list-item__content']} style={{ paddingLeft: '0rem' }}>
              {internalId || identifier}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
             <div className={style['decorated-list-item__title']} style={{ flexBasis: '16vw'}}>Status:</div>
             <div className={style['decorated-list-item__content']} style={{ paddingLeft: '0rem' }}>
             {published ? 'published' : 'unpublished'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
             <div className={style['decorated-list-item__title']} style={{flexBasis: '16vw'}}>Addition date:</div>
             <div className={style['decorated-list-item__content']} style={{ paddingLeft: '0rem' }}>
             {creationDate ? creationDate : 'Not available'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div className={style['decorated-list-item__title']} style={{flexBasis: '16vw'}}>Last modification:</div>
            <div className={style['decorated-list-item__content']} style={{ paddingLeft: '0rem' }}>
              {updateDate ? updateDate : (creationDate ? creationDate : 'Not available')}
            </div>
          </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
});

Overview.displayName = 'Overview';
export default Overview;
