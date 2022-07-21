import React, { useContext, useState, useEffect } from 'react';
import {
  CardContent,
  CardActions,
  Button,
  Typography,
  Chip,
} from '@material-ui/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLink,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';

import Card from '../../../components/animated-card';
import LazyImg from '../../../components/lazy-img';

import { ProjectCtx } from '../../../contexts';
import https from 'https';

import style from './style.module.css';

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
  const { accession, identifier, published, metadata } = useContext(ProjectCtx);
  // Download pdb information for every pdb id in metadata
  const pdbIds = metadata.PDBIDS;
  const [pdbInfo, setPdbInfo] = useState({});
  useEffect(() => {
    if (!pdbIds) return;
    pdbIds.forEach(pdbId => {
      const url = `https://mmb.irbbarcelona.org/api/pdb/${pdbId}/entry`;
      let body = '';
      https.get(url, response => {
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
    });
  }, [pdbIds]);

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
            <Typography variant="h6">{metadata.NAME || 'Unnamed'}</Typography>
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
              {metadata.AUTHORS && <div>Authors: {metadata.AUTHORS}</div>}
              {metadata.GROUPS && <div>Groups: {metadata.GROUPS}</div>}
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
              {metadata.warnings &&
                metadata.warnings.map((warning, w) => (
                  <div key={w} style={{ fontWeight: 'bold' }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} size={'lg'} />
                    {' ' + warning.message}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
      {pdbInfo && Object.keys(pdbInfo).length > 0 && (
        <Card className={style.card}>
          <CardContent className={style['card-content']}>
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
              );
              // Set the url to get the pdb image
              const lowerPdb = pdbId.toLowerCase();
              const imgSrc =
                pdbId &&
                `https://cdn.rcsb.org/images/structures/${lowerPdb.substr(
                  1,
                  2,
                )}/${lowerPdb}/${lowerPdb}_assembly-1.jpeg`;

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
                          {organisms.map(organism => (
                            <Chip
                              key={organism}
                              label={organism}
                              variant="outlined"
                              color="primary"
                              className={style.chip}
                            />
                          ))}
                        </div>
                        <div>
                          Keyword
                          {keywords.length > 1 && 's'}:{' '}
                          {keywords.map(keyword => (
                            <Chip
                              key={keyword}
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
                        href={`http://3dbionotes-ws.cnb.csic.es/?queryId=${pdbId}`}
                        size="small"
                        color="primary"
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        <FontAwesomeIcon icon={faLink} />
                        &nbsp;3DBIONOTES
                      </Button>
                    </CardActions>
                  </CardContent>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
      {metadata && metadata.LIGANDS && metadata.LIGANDS.length > 0 && (
        <Card className={style.card}>
          <CardContent className={style['card-content']}>
            <Typography variant="h6">Ligands</Typography>
            {metadata.LIGANDS.map(ligand => (
              <div key={ligand.name} className={style['summary-list']}>
                {(ligand.chembl || ligand.drugbank) && (
                  <LazyImg
                    src={
                      ligand.chembl
                        ? `https://www.ebi.ac.uk/chembl/api/data/image/${ligand.chembl}.svg`
                        : ligand.drugbank
                        ? `https://www.drugbank.ca/structures/${ligand.drugbank}/image.svg`
                        : null
                    }
                    width="200"
                    height="200"
                    loading="lazy"
                    alt={`3D view of the ${ligand.name} structure`}
                  />
                )}
                <div>- {ligand.name || 'Not available'}</div>
                {ligand.drugbank && (
                  <div>
                    <span>DrugBank: </span>
                    <a
                      href={'https://www.drugbank.ca/drugs/' + ligand.drugbank}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {ligand.drugbank}
                    </a>
                  </div>
                )}
                {ligand.chembl && (
                  <div>
                    <span>ChEMBL: </span>
                    <a
                      href={
                        'https://www.ebi.ac.uk/chembl/compound_report_card/' +
                        ligand.chembl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {ligand.chembl}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
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
