import React, { useContext, useState, useEffect } from 'react';
import {
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

import Card from '../../../components/animated-card';
import LazyImg from '../../../components/lazy-img';

import { prettyEnumerate, rawEnumerate } from '../../../utils/pretty-enumerate';

import { ProjectCtx } from '../../../contexts';
import https from 'https-browserify';
import { parse as urlParse } from 'url';

import style from './style.module.css';

import { HOST_CONFIG } from '../../../utils/constants';

const COMMA_SEPARATOR = /\s*,\s*/;

const typeSettings = {
  trajectory: {
    label: 'Trajectory',
    color: '#8ffffd', // light blue
  },
  ensemble: {
    label: 'Ensemble',
    color: '#ffe08f', // light yellow
  },
};

export default React.memo(() => {
  const { accession, identifier, published, metadata, proteinReferences, mdCount, node } = useContext(
    ProjectCtx,
  );
  // Download pdb information for every pdb id in metadata from our custom API
  const pdbIds = metadata.PDBIDS;
  const [pdbInfo, setPdbInfo] = useState({});
  useEffect(() => {
    if (!pdbIds) return;
    // Store requests so we can abort them all in the useEffect cleanup function in case they were not completed on time
    const requests = [];
    pdbIds.forEach(pdbId => {
      const url = `https://mdb-login.bsc.es/api/pdb/${pdbId}/entry`;
      let body = '';
      const request = https.get(url, response => {
        response.on('data', chunk => {
          body += chunk;
        });
        response.on('end', () => {
          const data = JSON.parse(body);
          setPdbInfo(previous => {
            return { ...previous, [pdbId]: data };
          });
        });
      });
      requests.push(request);
    });
    // DANI: No he comprovado que esto funcione debidamente
    return () => {
      for (const request of requests) request.abort();
    };
  }, [pdbIds]);

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
            data.chemblID = chemblSplits[chemblSplits.length - 2];
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
                    fontSize: '1em',
                    marginRight: '0.8em',
                  }}
                  className={style.chip}
                />
              )}
              {metadata.METHOD}
              {metadata.DESCRIPTION && <div>{metadata.DESCRIPTION}</div>}
              {metadata.AUTHORS && <div>Authors: {prettyEnumerate(metadata.AUTHORS)}</div>}
              {metadata.GROUPS && <div>Groups: {rawEnumerate(metadata.GROUPS)}</div>}
              {/* Node will exist only in the global API, and the global client has nodes as options */}
              {HOST_CONFIG.global && node && <div>Node: {HOST_CONFIG.optionsNiceNames[node] || node}</div>}
              {metadata.CONTACT && <div>Contact: {metadata.CONTACT}</div>}
              {metadata.PROGRAM && <div>Program: {metadata.PROGRAM}</div>}
              {metadata.VERSION && <div>Version: {metadata.VERSION}</div>}
              {metadata.LINKS &&
                metadata.LINKS.map((link, l) => (
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
                      <Typography variant="h6">{reference.name}</Typography>
                      <div>{reference.gene && `Gene: ${reference.gene}`}</div>
                      <div>
                        {reference.organism &&
                          `Organism: ${reference.organism}`}
                      </div>
                      <div>
                        {reference.uniprot && `UniProt ID: `}
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
                </CardContent>
              </div>
            ))}
            {Object.entries(pdbInfo).map(([pdbId, pdbMetadata], i) => {
              //const pdbId = pdb && pdb._id && pdb._id.toLowerCase();
              if (!pdbMetadata) return 'PDB ' + pdbId + ' not found';
              // Mine pdb info
              const title = pdbMetadata.compound;
              const experimentalMethod = pdbMetadata.expClass.toLowerCase();
              const publishDate = new Date(pdbMetadata.ascDate);
              const keywords = Array.from(
                new Set((pdbMetadata.header || '').split(COMMA_SEPARATOR)),
              );
              const organisms = Array.from(
                new Set((pdbMetadata.sources || '').split(COMMA_SEPARATOR)),
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
                  <CardContent style={{ minHeight: 380 }}>
                    <div>
                      <LazyImg
                        src={imgSrc}
                        width="350"
                        height="350"
                        loading="lazy"
                        alt={`3D view of the ${pdbId} structure`}
                      />
                      <div className={style['summary-list']}>
                        <div>
                          PDB Accession: {pdbId}
                          {pdbMetadata.replaces &&
                            ` (replaces ${pdbMetadata.replaces})`}
                        </div>
                        <Typography variant="h6">{title}</Typography>
                        <div>
                          {pdbMetadata.status &&
                            pdbMetadata.status !== 'CURRENT' &&
                            `Status: ${pdbMetadata.status}`}
                        </div>
                        <div>Experimental method: {experimentalMethod}</div>
                        <div>
                          Organism
                          {organisms.length > 1 && 's'}:{' '}
                          {organisms.length > 0 ? organisms.map((organism, o) => (
                            <Chip
                              key={o}
                              label={organism}
                              variant="outlined"
                              color="primary"
                              className={style.chip}
                            />
                          )) : <span className={style['grey']}>not available</span>}
                        </div>
                        <div>
                          Keyword
                          {keywords.length > 1 && 's'}:{' '}
                          {keywords.map((keyword, k) => (
                            <Chip
                              key={k}
                              label={keyword}
                              variant="outlined"
                              color="primary"
                              className={style.chip}
                            />
                          ))}
                        </div>
                        <div>
                          Publication date:{' '}
                          <time dateTime={publishDate.toISOString()}>
                            {publishDate.toDateString()}
                          </time>
                        </div>
                      </div>
                    </div>
                    <CardActions>
                      <Button
                        component={'a'}
                        variant="contained"
                        href={`https://www.ebi.ac.uk/pdbe/entry/pdb/${pdbId}`}
                        size="small"
                        color="primary"
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
                        color="primary"
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        <FontAwesomeIcon icon={faLink} />
                        &nbsp;RCSB website
                      </Button>
                      <Button
                        component={'a'}
                        variant="contained"
                        href={`https://3dbionotes-ws.cnb.csic.es/?queryId=${pdbId}`}
                        size="small"
                        color="primary"
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
                        color="primary"
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
            {Object.entries(pubchemInfo).map(([pubchemId, pubchemData], i) => (
              <div key={i} className={style['summary-list']}>
                {i !== 0 && (
                  <hr style={{ color: 'lightGrey' }} />
                ) /* An horizontal line to separate protein references */}
                <LazyImg
                  src={`https://pubchem.ncbi.nlm.nih.gov/image/imgsrv.fcgi?cid=${pubchemId}&t=l`}
                  width="200" height="200" loading="lazy"
                  alt={`3D view of the ${pubchemData.name} structure`}
                  // cross origin and referrer policy should prevent pubchem cookies
                  crossOrigin="anonymous" referrerPolicy="no-referrer"
                  // default background color is like a "broken" white but this CSS trick fixes it
                  // this was recommended by people from pubchem
                  className={style['white-background']}
                />
                <Typography variant="h6">{pubchemData.name}</Typography>
                <div>
                  {`Pubchem ID: `}
                  <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${pubchemId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {pubchemId}
                  </a>
                </div>
                {pubchemData.chemblID && (<div>
                  {`ChEMBL ID: `}
                  <a href={pubchemData.chemblURL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {pubchemData.chemblID}
                  </a>
                </div>)}
                {pubchemData.drugbankID && (<div>
                  {`DrugBank ID: `}
                  <a href={pubchemData.drugbankURL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {pubchemData.drugbankID}
                  </a>
                </div>)}
              </div>
            ))}
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
            <div>
              Public project accession: {accession || <code>not assigned</code>}
            </div>
            <div>Internal project identifier: {identifier}</div>
            <div>Status: {published ? 'published' : 'unpublished'}</div>
          </div>
        </CardContent>
      </Card>
    </>
  );
});
