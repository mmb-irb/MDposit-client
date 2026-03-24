import React, { useContext, useMemo } from 'react';
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
import Card from 'src/components/animated-card';
import LazyImg from 'src/components/lazy-img';
import ExpanderButton from 'src/components/expander-button';

const normalizeObject = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).length === 0) return null;
  return value;
};

const uniqueStrings = values => {
  return Array.from(new Set(values.filter(Boolean)));
};

const LipidsOverview = () => {
  // Get context data
  const { lipidReferences, topology } = useContext(ProjectCtx);

  // Get the provided theme
  const theme = useTheme();
  const secondaryColor = theme.palette.secondary;

  const residueNameByInchikey = useMemo(() => {
    if (!topology) return {};
    const groupedNames = {};
    for (const residue of topology.iterresidues()) {
      if (residue.referenceType !== 'inchikey') continue;
      if (!residue.referenceId || !residue.name) continue;
      if (!groupedNames[residue.referenceId]) groupedNames[residue.referenceId] = new Set();
      groupedNames[residue.referenceId].add(residue.name);
    }
    const result = {};
    for (const [inchikey, names] of Object.entries(groupedNames)) {
      result[inchikey] = Array.from(names).sort()[0];
    }
    return result;
  }, [topology]);

  if (!lipidReferences || lipidReferences.length === 0) return null;

  return (
    <Card className={style.card}>
      <CardContent className={style['card-content']}>
        {lipidReferences.map((reference, i) => {
          const swisslipids = normalizeObject(reference.swisslipids);
          const lipidmaps = normalizeObject(reference.lipidmaps);

          const lipidName =
            (swisslipids && swisslipids.entity_name) ||
            (lipidmaps && lipidmaps.name) ||
            reference.inchikey ||
            'Unnamed lipid';
          const lipidFormula = lipidmaps && lipidmaps.formula;
          const lipidClass = swisslipids && swisslipids.classification_level;
          const swisslipidsId = swisslipids && swisslipids.entity_id;
          const lipidmapsId = lipidmaps && lipidmaps.lm_id;
          const pubchemId = lipidmaps && lipidmaps.pubchem_cid;
          const residueName = residueNameByInchikey[reference.inchikey] || null;

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
          const pubchemUrl = pubchemId
          ? `https://pubchem.ncbi.nlm.nih.gov/compound/${pubchemId}`
          : null;
          
          return (
              <div key={reference.inchikey || i} className={style['summary-list']}>
              {i !== 0 && <hr style={{ color: 'lightGrey' }} />}
              {pubchemId && (
                  <LazyImg
                  src={`https://pubchem.ncbi.nlm.nih.gov/image/imgsrv.fcgi?cid=${pubchemId}&t=l`}
                  width="250"
                  height="250"
                  loading="lazy"
                  alt={`2D view of the ${lipidName} structure`}
                  className={style['white-background']}
                  />
              )}
              <Typography variant="h6" sx={{ fontSize: '1.4rem' }}>{lipidName}</Typography>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className={style['decorated-list-item__title']}>InChIKey</div>
                <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                  {reference.inchikey || 'Not available'}
                </div>
              </div>

              {reference.inchi && (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div className={style['decorated-list-item__title']}>InChI</div>
                  <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                    <ExpanderButton text={reference.inchi} />
                  </div>
                </div>
              )}

              {lipidFormula && (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div className={style['decorated-list-item__title']}>Molecular Formula</div>
                  <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                    {lipidFormula.toString().split('').map((char, index) => {
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
              )}

              {lipidClass && (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div className={style['decorated-list-item__title']}>Classification</div>
                  <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                    {lipidClass}
                  </div>
                </div>
              )}

              {lipidmapsId && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div className={style['decorated-list-item__title']}>LIPID MAPS ID</div>
                  <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                    {lipidmapsId}
                  </div>
                </div>
              )}

              {swisslipidsId && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div className={style['decorated-list-item__title']}>SwissLipids ID</div>
                  <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                    {swisslipidsId}
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

                {residueName && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div className={style['decorated-list-item__title']}>Residue name</div>
                    <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${secondaryColor.dark}` }}>
                    {residueName}
                    </div>
                    </div>
              )}

              {(swisslipidsUrl || lipidmapsUrl || pubchemUrl) && (
                <CardActions>
                  {swisslipidsUrl && (
                    <Button
                      component={'a'}
                      variant="contained"
                      href={swisslipidsUrl}
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
                      &nbsp;SwissLipids
                    </Button>
                  )}
                  {lipidmapsUrl && (
                    <Button
                      component={'a'}
                      variant="contained"
                      href={lipidmapsUrl}
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
                      &nbsp;LIPID MAPS
                    </Button>
                  )}
                  {pubchemUrl && (
                    <Button
                      component={'a'}
                      variant="contained"
                      href={pubchemUrl}
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
                      &nbsp;PubChem
                    </Button>
                  )}
                </CardActions>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default LipidsOverview;
