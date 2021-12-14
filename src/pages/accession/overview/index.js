import React, { useContext } from 'react';
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

import style from './style.module.css';

const COMMA_SEPARATOR = /\s*,\s*/;

export default React.memo(() => {
  const { accession, identifier, published, metadata } = useContext(ProjectCtx);

  // Process the pdbInfo metadata to show a report
  const pdbInfo = metadata.pdbInfo;

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
              {metadata.DESCRIPTION && <div>{metadata.DESCRIPTION}</div>}
              {metadata.AUTHORS && <div>Authors: {metadata.AUTHORS}</div>}
              {metadata.GROUPS && <div>Groups: {metadata.GROUPS}</div>}
              {metadata.CONTACT && <div>Contact: {metadata.CONTACT}</div>}
              {metadata.PROGRAM && <div>Program: {metadata.PROGRAM}</div>}
              {metadata.VERSION && <div>Version: {metadata.VERSION}</div>}
              {metadata.METHOD && <div>MD method: {metadata.METHOD}</div>}
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
      {pdbInfo && pdbInfo.length > 0 && (
        <Card className={style.card}>
          <CardContent className={style['card-content']}>
            {pdbInfo.map((pdb, i) => {
              const pdbId = pdb && pdb._id.toLowerCase();
              // Set the url to get the pdb image
              const imgSrc =
                pdbId &&
                `https://cdn.rcsb.org/images/structures/${pdbId.substr(
                  1,
                  2,
                )}/${pdbId}/${pdbId}_assembly-1.jpeg`;
              // Mine the organism, keyword and publish date
              let organisms;
              let keywords;
              let publishDate;
              if (pdbId) {
                organisms = Array.from(
                  new Set((pdb.sources || '').split(COMMA_SEPARATOR)),
                );
                keywords = Array.from(
                  new Set((pdb.header || '').split(COMMA_SEPARATOR)),
                );
                publishDate = new Date(pdb.ascDate);
              }
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
                        alt={`3D view of the ${pdb._id} structure`}
                      />
                      <div className={style['summary-list']}>
                        <div style={{ fontWeight: 'bold' }}>{pdb.title}</div>
                        <div>
                          PDB Accession: {pdb._id}
                          {pdb.replaces && ` (replaces ${pdb.replaces})`}
                        </div>
                        <Typography variant="h6">{pdb.compound}</Typography>
                        <div>
                          {pdb.status &&
                            pdb.status !== 'CURRENT' &&
                            `Status: ${pdb.status}`}
                        </div>
                        <div>
                          Experimental method: {pdb.expClass.toLowerCase()}
                        </div>
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
                        href={`https://www.ebi.ac.uk/pdbe/entry/pdb/${pdb._id}`}
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
                        href={`https://www.rcsb.org/structure/${pdb._id}`}
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
                        href={`http://3dbionotes-ws.cnb.csic.es/?queryId=${pdb._id}`}
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
