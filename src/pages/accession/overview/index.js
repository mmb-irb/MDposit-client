import React, { useContext, useState } from 'react';
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
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '@mui/material/styles';
import style from './style.module.css';
import { prettyEnumerate } from '../../../utils/pretty-enumerate';
// Import auxiliar components
import Card from '../../../components/animated-card';
// Import other components which are part of the overview
import LigandsOverview from './ligands';
import PdbsOverview from './pdbs';
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
      color: theme.palette.secondary.main, // light blue
    },
    ensemble: {
      label: 'Ensemble',
      color: theme.palette.secondary.dark, // light yellow
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
                  {HOST_CONFIG.optionsNiceNames[node] || node}
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
      {metadata && (() => {
        const compositionFields = [
          { key: 'SYSTATS', label: 'Total System Atoms', showPercentage: false },
          { key: 'SYSTRES', label: 'Total System Residues', showPercentage: false },
          { key: 'PROTATS', label: 'Protein Atoms', showPercentage: true },
          { key: 'PROTRES', label: 'Protein Residues', showPercentage: false },
          { key: 'DNAATS', label: 'DNA Atoms', showPercentage: true },
          { key: 'DNARES', label: 'DNA Residues', showPercentage: false },
          { key: 'RNAATS', label: 'RNA Atoms', showPercentage: true },
          { key: 'RNARES', label: 'RNA Residues', showPercentage: false },
          { key: 'LIPIATS', label: 'Lipid Atoms', showPercentage: true },
          { key: 'LIPIRES', label: 'Lipid Residues', showPercentage: false },
          { key: 'CARBATS', label: 'Carbohydrate Atoms', showPercentage: true },
          { key: 'CARBRES', label: 'Carbohydrate Residues', showPercentage: false },
          { key: 'SOLVATS', label: 'Solvent Atoms', showPercentage: true },
          { key: 'SOLVRES', label: 'Solvent Residues', showPercentage: false },
          { key: 'COUNCAT', label: 'Counter Cations', showPercentage: false },
          { key: 'COUNANI', label: 'Counter Anions', showPercentage: false },
          { key: 'COUNION', label: 'Total Counter Ions', showPercentage: true }
        ];
        const hasData = compositionFields.some(field => metadata[field.key] !== undefined && metadata[field.key] > 0);
        return hasData;
      })() && (
        <Card className={style.card}>
          <CardContent className={style['card-content']}>
            <Typography variant="h6" sx={{ fontSize: '1.4rem', marginBottom: '10px' }}>System Composition</Typography>
            <div className={style['composition-container']}>
              <div className={`${style['summary-list']} ${style['composition-stats']}`}>
                {(() => {
                  const compositionFields = [
                    { key: 'SYSTATS', label: 'Total System Atoms', showPercentage: false },
                    { key: 'SYSTRES', label: 'Total System Residues', showPercentage: false },
                    { key: 'PROTATS', label: 'Protein Atoms', showPercentage: true, color: '#4CAF50' },
                    { key: 'PROTRES', label: 'Protein Residues', showPercentage: false },
                    { key: 'DNAATS', label: 'DNA Atoms', showPercentage: true, color: '#2196F3' },
                    { key: 'DNARES', label: 'DNA Residues', showPercentage: false },
                    { key: 'RNAATS', label: 'RNA Atoms', showPercentage: true, color: '#E91E63' },
                    { key: 'RNARES', label: 'RNA Residues', showPercentage: false },
                    { key: 'LIPIATS', label: 'Lipid Atoms', showPercentage: true, color: '#FF9800' },
                    { key: 'LIPIRES', label: 'Lipid Residues', showPercentage: false },
                    { key: 'CARBATS', label: 'Carbohydrate Atoms', showPercentage: true, color: '#9C27B0' },
                    { key: 'CARBRES', label: 'Carbohydrate Residues', showPercentage: false },
                    { key: 'SOLVATS', label: 'Solvent Atoms', showPercentage: true, color: '#00BCD4' },
                    { key: 'SOLVRES', label: 'Solvent Residues', showPercentage: false },
                    { key: 'COUNCAT', label: 'Counter Cations', showPercentage: false },
                    { key: 'COUNANI', label: 'Counter Anions', showPercentage: false },
                    { key: 'COUNION', label: 'Total Counter Ions', showPercentage: true, color: '#9E9E9E' }
                  ];
                  
                  const totalAtoms = metadata.SYSTATS || 0;
                  
                  return compositionFields
                    .filter(field => metadata[field.key] !== undefined && metadata[field.key] > 0)
                    .map((field, index) => {
                      const value = metadata[field.key];
                      const percentage = field.showPercentage && totalAtoms > 0 
                        ? ((value / totalAtoms) * 100).toFixed(2)
                        : null;
                      
                      return (
                        <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                          <div className={style['decorated-list-item__title']}>{field.label}</div>
                          <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                            {value.toLocaleString()}
                            {percentage && ` (${percentage}%)`}
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>
              <div className={style['composition-chart']}>
                {(() => {
                  const compositionFields = [
                    { key: 'PROTATS', label: 'Protein'},
                    { key: 'DNAATS', label: 'DNA'},
                    { key: 'RNAATS', label: 'RNA' },
                    { key: 'LIPIATS', label: 'Lipid' },
                    { key: 'CARBATS', label: 'Carbohydrate' },
                    { key: 'SOLVATS', label: 'Solvent' },
                    { key: 'COUNION', label: 'Counter Ions' }
                  ];
                  
                  const totalAtoms = metadata.SYSTATS || 0;
                  const chartData = compositionFields
                    .filter(field => metadata[field.key] !== undefined && metadata[field.key] > 0)
                    .map(field => ({
                      ...field,
                      value: metadata[field.key],
                      percentage: totalAtoms > 0 ? ((metadata[field.key] / totalAtoms) * 100).toFixed(2) : 0
                    }));
                  
                  if (chartData.length === 0) return null;
                  
                  return (
                    <div>
                      <Typography variant="subtitle1" className={style['chart-title']}>
                        Composition by Atoms
                      </Typography>
                      {chartData.map((item, index) => (
                        <div key={index} className={style['chart-bar-container']}>
                          <div className={style['chart-bar-header']}>
                            <span>{item.label}</span>
                            <span className={style['chart-bar-percentage']}>{item.percentage}%</span>
                          </div>
                          <div className={style['chart-bar-background']}>
                            <div 
                              className={style['chart-bar-fill']}
                              style={{ 
                                width: `${item.percentage}%`, 
                                backgroundColor: secondaryColor.dark
                              }}
                            >
                              {`${item.value.toLocaleString()}`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
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
