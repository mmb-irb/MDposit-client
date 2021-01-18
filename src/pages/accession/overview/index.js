import React, { useContext } from 'react';
import {
  CardContent,
  CardActions,
  Button,
  Typography,
  Chip,
} from '@material-ui/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink } from '@fortawesome/free-solid-svg-icons';

import Card from '../../../components/animated-card';
import LazyImg from '../../../components/lazy-img';

import { ProjectCtx } from '../../../contexts';

import style from './style.module.css';

const COMMA_SEPARATOR = /\s*,\s*/;

export default React.memo(() => {
  const { accession, identifier, published, metadata } = useContext(ProjectCtx);

  // Process the pdbInfo metadata to show a report
  const pdbInfo = metadata.pdbInfo;
  const pdbId = pdbInfo && pdbInfo._id.toLowerCase();

  // Set the url to get the pdb image
  const imgSrc =
    pdbInfo &&
    pdbInfo._id &&
    `https://cdn.rcsb.org/images/structures/${pdbId.substr(
      1,
      2,
    )}/${pdbId}/${pdbId}_assembly-1.jpeg`;

  // Mine the organism, keyword and publish date
  let organisms;
  let keywords;
  let publishDate;
  if (pdbInfo && pdbInfo._id) {
    organisms = Array.from(
      new Set((pdbInfo.sources || '').split(COMMA_SEPARATOR)),
    );
    keywords = Array.from(
      new Set((pdbInfo.header || '').split(COMMA_SEPARATOR)),
    );
    publishDate = new Date(pdbInfo.ascDate);
  }

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
      <Card className={style.card}>
        <CardContent className={style['card-content']}>
          <Typography variant="h6">MD information</Typography>
          <div className={style['summary-list']}>
            <div>
              Authors: {(metadata && metadata.AUTHORS) || 'Not available'}
            </div>
            <div>
              Groups: {(metadata && metadata.GROUPS) || 'Not available'}
            </div>
            <div>
              Program: {(metadata && metadata.PROGRAM) || 'Not available'}
            </div>
            <div>
              Version: {(metadata && metadata.VERSION) || 'Not available'}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className={style.card}>
        <CardContent className={style['card-content']}>
          <Typography variant="h6">Molecule information</Typography>
          <div className={style['summary-list']}>
            <div>Name: {(metadata && metadata.NAME) || 'Not available'}</div>
            <div>
              Description:{' '}
              {(metadata && metadata.DESCRIPTION) || 'Not available'}
            </div>
          </div>
        </CardContent>
      </Card>
      {pdbInfo && pdbInfo._id && (
        <Card className={style.card}>
          <CardContent className={style['card-content']}>
            <Typography variant="h6">PDB information</Typography>
            <LazyImg
              src={imgSrc}
              width="350"
              height="350"
              loading="lazy"
              alt={`3D view of the ${pdbInfo._id} structure`}
            />
            {pdbInfo && (
              <div className={style['summary-list']}>
                <div>{pdbInfo.title}</div>
                <div>
                  PDB Accession: {pdbInfo._id}
                  {pdbInfo.replaces && ` (replaces ${pdbInfo.replaces})`}
                </div>
                <div>
                  {pdbInfo.status &&
                    pdbInfo.status !== 'CURRENT' &&
                    `Status: ${pdbInfo.status}`}
                </div>
                <div>Experimental method: {pdbInfo.expClass.toLowerCase()}</div>
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
            )}
          </CardContent>
          <CardActions>
            <Button
              component={'a'}
              variant="contained"
              href={`https://www.ebi.ac.uk/pdbe/entry/pdb/${pdbInfo._id}`}
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
              href={`https://www.rcsb.org/structure/${pdbInfo._id}`}
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
              href={`http://3dbionotes-ws.cnb.csic.es/?queryId=${pdbInfo._id}`}
              size="small"
              color="primary"
              target="_blank"
              rel="noreferrer noopener"
            >
              <FontAwesomeIcon icon={faLink} />
              &nbsp;3DBIONOTES
            </Button>
          </CardActions>
        </Card>
      )}
      {metadata && metadata.LIGANDS && (
        <Card className={style.card}>
          <CardContent className={style['card-content']}>
            <Typography variant="h6">Ligands information</Typography>
            {metadata.LIGANDS.map(ligand => (
              <div key={ligand.name} className={style['summary-list']}>
                <LazyImg
                  src={
                    ligand.chembl
                      ? `https://www.ebi.ac.uk/chembl/api/data/image/${ligand.chembl}.svg`
                      : ligand.accession
                      ? `https://www.drugbank.ca/structures/${ligand.accession}/image.svg`
                      : null
                  }
                  width="200"
                  height="200"
                  loading="lazy"
                  alt={`3D view of the ${ligand.name} structure`}
                />
                <div>- {ligand.name || 'Not available'}</div>
                {ligand.accession && (
                  <div>
                    <span>DrugBank: </span>
                    <a
                      href={'https://www.drugbank.ca/drugs/' + ligand.accession}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {ligand.accession}
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
      </Card>
      <Card className={style.card}>
        <CardContent className={style['card-content']}>
          <Typography variant="h6">Citation</Typography>
          <div>
            The use of any trajectory data in any reports or publications of
            results obtained with the trajectory data should be acknowledged by
            including a citation to:
          </div>
          <div className={style['summary-list']}>
            <div>{citation || 'Not available'}</div>
          </div>
        </CardContent>
      </Card>
      <Card className={style.card}>
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
