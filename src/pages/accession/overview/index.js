import React, { useContext, useState, useEffect, useRef, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Paper,
  CardContent,
  CardActions,
  Button,
  Typography,
  Chip,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLink,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '@mui/material/styles';
import  Info  from '../../../components/info';
import { docs } from '../../help/documentation';
import Card from '../../../components/animated-card';
import LazyImg from '../../../components/lazy-img';

import { prettyEnumerate } from '../../../utils/pretty-enumerate';

import { ProjectCtx } from '../../../contexts';
import https from 'https-browserify';

import style from './style.module.css';

import { HOST_CONFIG } from '../../../utils/constants';
import MoleculeViewer from 'src/utils/rdkit/rdkit_viewer';

const COMMA_SEPARATOR = /\s*,\s*/;


const LigandTable = ({ ligandReference }) => {
  if (!ligandReference) return null;
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const mordredData = ligandReference.mordred || {};
  const rows = Object.entries(mordredData || {}).map(([key, value]) => ({
    key,
    value: typeof value === 'number' ? value.toFixed(2) : String(value),
  }));
  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows =
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - rows.length) : 0;

  const filteredRows = rows.filter(
    ({key,value}) =>
      key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      value.toString().includes(searchTerm)
  );

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Paper 
      sx={{ 
        width: "auto", 
        maxWidth: "400px", 
        padding: "10px", 
        overflow: "hidden", 
        boxShadow: "none",
        margin: "auto",
        marginTop: "0px",
        marginBottom: "10px",
        display:"table",
        borderCollapse: "collapse"
      }}
    >
      <TextField
        label="Search..."
        variant="outlined"
        fullWidth
        margin="dense"
        size="small"
        value={searchTerm}
        onChange={handleSearch}
      />
      <TableContainer>
        <Table size="small"> {/* Reduce el tamaño de las filas */}
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold", padding: "5px", textAlign: "center" }}>Descriptor</TableCell>
              <TableCell sx={{ fontWeight: "bold", padding: "5px", textAlign: "center" }}>Valor</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.length > 0 ? filteredRows
              .slice(page * rowsPerPage, (page + 1) * rowsPerPage)
              .map(({key,value}) => (
                <TableRow key={key} sx={{ "&:last-child td, &:last-child th": { border: 0 } }} >
                  <TableCell component="th" sx={{ padding: "5px", textAlign: "center" }}>{key}</TableCell>
                  <TableCell component="th" sx={{ padding: "5px", textAlign: "center" }}>{value}</TableCell>
                </TableRow>
              ))
            : null}
            {emptyRows > 0 && (
              <TableRow style={{ height: 33 * emptyRows }}>
                <TableCell colSpan={2} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
        component="div"
        colSpan={3}
        count={filteredRows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        sx={{ fontSize: "12px" }}
        display="flex"
        //justifyContent="center"
        //alignItems="flex-start"
        margin="auto"
      />
    </Paper>
  );
};

const Overview = React.memo(() => {
  const {
    accession,
    internalId,
    identifier,
    published,
    metadata,
    ligandReferences,
    proteinReferences,
    pdbReferences,
    mdCount,
    node,
    creationDate,
    updateDate
  } = useContext(ProjectCtx);
  
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

  // Create a little button to show the inchi array
  const InchiViewer = ({ ligandReference }) => {
    const [expanded, setExpanded] = useState(false);
    const maxLength = 30;
    const toggleExpand = () => setExpanded(!expanded);
    const inchi = ligandReference.inchi;
    const displayText = expanded ? inchi : `${inchi.substring(0, maxLength)}... `;
  
    return (
      <div>
        <div>
          {displayText.split('').map((char, index) => (
            <span key={index} className="highlight">{char}</span>
          ))}
          {inchi.length > maxLength && (
            <button onClick={toggleExpand} 
            className="ml-2 text-blue-500 hover:underline"
            //cursor="pointer"
            style={{
              padding: '4px 6px',
              borderRadius: '1.5px',
              cursor: 'pointer',
              display: 'inline-block',
              fontSize: '14px',
              margin: '2px 4px',
            }}
            >
              {expanded ? 'See less' : 'See more'}
            </button>
          )}
        </div>
      </div>
    );
  };
  // Get the provided theme
  const theme = useTheme();
  const secondaryColor = theme.palette.secondary;
  const primaryDarkColor = theme.palette.primary.dark;
  const typeSettings = {
    trajectory: {
      label: 'Trajectory',
      color: theme.palette.secondary.main, // light blue
    },
    ensemble: {
      label: 'Ensemble',
      color: theme.palette.secondary.dark, // light yellow
    },
  };
  const SmilesViewer = ({ ligandReference }) => {
    const [expanded, setExpanded] = useState(false);
    const maxLength = 120;
    const toggleExpand = () => setExpanded(!expanded);
    const smiles = ligandReference.smiles;
    const displayText = expanded ? smiles : `${smiles.substring(0, maxLength)}`;

    return (
      <div className="text-align-center margin-auto max-width-100">
        <div className="display-inline word-break">
          {displayText.split('').map((char, index) => (
            <span key={index} className="highlight">{char}</span>
          ))}
          {smiles.length > maxLength && (
            <button onClick={toggleExpand} 
            className="ml-2 text-blue-500 hover:underline"
            //cursor="pointer"
            style={{
              padding: '4px 6px',
              borderRadius: '1.5px',
              cursor: 'pointer',
              display: 'inline-block',
              fontSize: '14px',
              margin: '2px 4px',
            }}
            >
              {expanded ? 'See less' : 'See more'}
            </button>
          )}
        </div>
      </div>
    );
  };
  // Set mordred and morgan documentation
  const mordredDoc = docs.find(doc => doc.id === 'mordred-descriptors');
  const mordredTooltip = mordredDoc && mordredDoc.page && (
    <>
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
      </a>
      .
    </>
  );
  const morganDoc = docs.find(doc => doc.id === 'morgan-fingerprint');
  const morganTooltip = morganDoc && morganDoc.page && (
    <>
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
      </a>
      .
    </>
  );

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

  // Download ligand information for every ligand pubchem id in metadata
  const pubchemIds = metadata.LIGANDS;
  const [pubchemInfo, setPubchemInfo] = useState({});
  useEffect(() => {
    if (!pubchemIds) return;
    // Store requests so we can abort them all in the useEffect cleanup function in case they were not completed on time
    const requests = [];
    pubchemIds.forEach(pubchemId => {
      if (typeof pubchemId !== 'string') return;
      const pubchemAPIurl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${pubchemId}/JSON/`;
      let body = '';
      const request = https.get(pubchemAPIurl, response => {
        response.on('data', chunk => {
          body += chunk;
        });
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
  }, [pubchemIds]);

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
              {HOST_CONFIG.global && node && <div>Node: {HOST_CONFIG.optionsNiceNames[node] || node}</div>}
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
                {metadata.LINKS.map((link, l) => (
                  <div key={l}>
                    {link.name}:{' '}
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {link.url}
                    </a>
                  </div>
                ))}
                </div>
              </div>}
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
      {metadata && Array.isArray(metadata.NUCLSEQ) && metadata.NUCLSEQ.length > 0 && (
        <Card className={style.card}>
          <CardContent className={style['card-content']}>
          <div>
              <Typography marginBottom={'10px'} variant="h6">Nucleic Sequences:</Typography>
              {metadata.NUCLSEQ.map((seq, index) => (
                <div 
                  key={index} 
                  className={style['card-background']}
                >
                <Typography variant="h6" style={{ marginBottom: '5px', marginTop: '10px', fontSize: 'inherit' }}>Sequence {index + 1}:</Typography>
                  <textarea
                    readOnly
                    value={seq}
                    className={style['textarea']}
                  />
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
              {metadata.PROTSEQ.map((seq, index) => (
                <div 
                  key={index} 
                  className={style['card-background']}
                >
                <Typography variant="h6" style={{ marginBottom: '5px', marginTop: '10px', fontSize: 'inherit' }} sx={{ fontSize: '1.4rem' }}>Sequence {index + 1}:</Typography>
                  <textarea
                    readOnly
                    value={seq}
                    className={style['textarea']}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {proteinReferences && proteinReferences.length > 0 && (
        <Card className={style.card}>
          <CardContent className={style['horizontal-marginned']}>
            {proteinReferences.map((reference, i) => (
              <div key={i}>
                {i !== 0 && (
                  <hr style={{ color: 'lightGrey' }} />
                ) /* An horizontal line to separate references */}
                <CardContent className={style['vertcial-marginned']}>
                  <div>
                    <div className={style['summary-list']}>
                      <Typography variant="h6" sx={{ fontSize: '1.4rem' }}>{reference.name}</Typography>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className={style['decorated-list-item__title']}>Gene</div>
                        <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                        {reference.gene && `${reference.gene}`}</div>
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
                          {reference.uniprot&& `UniProt ID: `}
                        <a
                          href={
                            'https://www.uniprot.org/uniprotkb/' +
                            reference.uniprot
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {reference.uniprot}
                        </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {pdbReferences && pdbReferences.length > 0 && (
        <Card className={style.card}>
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
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div className={style['decorated-list-item__title']}>PDB Accession</div>
                            <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                              {pdbId}
                            </div>
                          </div>

                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div className={style['decorated-list-item__title']}>Experimental method</div>
                          <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                          {experimentalMethod}
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
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
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div className={style['decorated-list-item__title']} style={{flexBasis: '12vw'}}>Publication date:</div>
                          <div className={style['decorated-list-item__content']} style={{ paddingLeft: '0rem' }}>
                          <time dateTime={publishDate.toISOString()}>
                            {publishDate.toDateString()}
                          </time>
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
                          color: '#000',
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
                          color: '#000',
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
                          color: '#000',
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
                          color: '#000',
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
        </Card>
      )}
      {Object.keys(pubchemInfo).length > 0 &&
        <Card className={style.card}>
          <CardContent className={style['card-content']}>
            {Object.entries(pubchemInfo).map(([pubchemId, pubchemData], i) => {
              const ligandReference = ligandReferences && ligandReferences.find(ref => ref.pubchem === pubchemId);
              return(
                <div key={i} className={style['summary-list']}>
                  {i !== 0 && (
                    <hr style={{ color: 'lightGrey' }} />
                  ) /* An horizontal line to separate protein references */}
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
                    <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${pubchemId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {pubchemId}
                    </a>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div className={style["decorated-list-item__title"]}>Molecular Formula</div>
                    <div className={style["decorated-list-item__content"]} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                      {ligandReference && ligandReference.formula.toString().split('').map((char, index) => {
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
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {ligandReference && ligandReference.smiles && <>
                      <div className={style["decorated-list-item__title"]}>SMILES</div>
                      <div className={style["decorated-list-item__content"]} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                        <SmilesViewer ligandReference={ligandReference}/>
                      </div>
                      </>
                      }
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {ligandReference && ligandReference.inchi && <>
                      <div className={style["decorated-list-item__title"]}>InChI</div>
                      <div className={style["decorated-list-item__content"]} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                        <InchiViewer ligandReference={ligandReference}/>
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
                </div>
              );
            })}
          </CardContent>
        </Card>
      }
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
