import React from 'react';
// Load a custom hook to quert the API
import useAPI from 'src/hooks/use-api';
// Constants
import { HOST_CONFIG, BASE_VERSIONED_PATH, REFERENCES } from '../../utils/constants';
// Import web components
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Chip
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGhost, faUmbrella } from '@fortawesome/free-solid-svg-icons';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Loading from 'src/components/loading';
import LazyImg from 'src/components/lazy-img';
// Import auxiliar functions
import { round2cents } from 'src/utils/auxiliar-functions';
// CSS style
import style from './style.module.css';

// Set the field we use to group different projects
const GROUPER_FIELD = HOST_CONFIG.optionsField;
// Check if the grouper belongs to a reference
const [ REFERENCE_TYPE, REFERENCE_CONFIG ] = Object.entries(REFERENCES)
  .find(([type, ref]) => ref.projectIdsField === GROUPER_FIELD) || [null, null];

// Set some definitions
const PRESENCE_DEF = 'Residues in the system which belong to the reference';
const COVERAGE_DEF = 'Residues in the reference which exist in the system';

// Set project metadata values to retrieve from the pointers endpoint
export const PROJECTION_METADATA = {
    name: 'metadata.NAME',
    description: 'metadata.DESCRIPTION',
    authors: 'metadata.AUTHORS',
    groups: 'metadata.GROUPS',
    grouper: GROUPER_FIELD,
};

const PointerRow = ({ group, projects }) => {
    let name;
    let hasLogo;
    let pngImage;
    let webpImage;
    let description;
    // If the option field is a reference field then try to get names, images, etc. from the references
    if (REFERENCE_TYPE) {
      // Get references data using the API
      const referencesURL = `${BASE_VERSIONED_PATH}/references/${REFERENCE_TYPE}/${group}`;
      const { loading, payload, error } = useAPI(referencesURL);
      if (error) console.error(error);
      // Get values from the reference data
      name = (payload && payload.name) || group;
      hasLogo = payload && Boolean(payload.image || payload.webp);
      pngImage = payload && payload.image;
      webpImage = payload && payload.webp;
      description = (loading && 'Loading description...') ||
        (payload && (payload.summary || payload.description));
    }
    // Otherwise try to get these information from options data
    else {
      name = HOST_CONFIG.optionsNiceNames[group] || group;
      hasLogo = Boolean(HOST_CONFIG.optionsData && HOST_CONFIG.optionsData.logo);
      pngImage = hasLogo && require(`src/images/${HOST_CONFIG.optionsData.logo[group]}.png`);
      webpImage = hasLogo && require(`src/images/${HOST_CONFIG.optionsData.logo[group]}.png`);
      description = HOST_CONFIG.optionsData && HOST_CONFIG.optionsData.description;
    }
    // Render the final component
    return (
        <Accordion slotProps={{ transition: { timeout: 500 } }} defaultExpanded={false}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              title={description}
            >
              <div className={style['horizontal-expanded']}>
                <div>
                  <Typography variant="h5">
                    {name}
                  </Typography>
                  <div>{`${projects.length} result${projects.length === 1 ? '' : 's'}`}</div>
                </div>
                {hasLogo && <picture style={{ marginRight: '1em' }}>
                  <source type="image/webp" src={webpImage} />
                  <LazyImg height="50px" src={pngImage} loading="lazy" />
                </picture>}
              </div>
            </AccordionSummary>
            <AccordionDetails>
              {projects.map(project => {
                const name = project[PROJECTION_METADATA.name] || 'Unnamed';
                const description = project[PROJECTION_METADATA.description];
                let authors = project[PROJECTION_METADATA.authors];
                if (authors && typeof authors === 'string') authors = [authors];
                let groups = project[PROJECTION_METADATA.groups];
                if (groups && typeof groups === 'string') groups = [groups];
                return (<div key={project.id}>
                  <hr style={{ color: 'lightGrey', margin: '0' }} />
                  <div style={{ margin: '0.5em' }} >
                    <div className={style['horizontal-expanded']}>
                      <Typography variant="h6">{project.id}</Typography>
                      <Typography variant="subtitle2">
                        <a href={project.web} target="_blank" rel="noopener noreferrer" >
                          {project.web}
                        </a>
                      </Typography>
                    </div>
                    <div>{`Name: ${name}`}</div>
                    <div>{description && `Description: ${description}`}</div>
                    <div>{authors && `Authors: ${authors.join(', ')}`}</div>
                    <div>{groups && `Groups: ${groups.join(', ')}`}</div>
                    <div className={style.horizontal}>
                      {project.presence && <div title={PRESENCE_DEF}>
                        <Chip
                          icon={<FontAwesomeIcon icon={faGhost} />}
                          label={`Presence: ${round2cents(project.presence * 100)} %`} />
                      </div>}
                      {project.coverage && <div title={COVERAGE_DEF}>
                        <Chip
                          icon={<FontAwesomeIcon icon={faUmbrella} />}
                          label={`Coverage: ${round2cents(project.coverage * 100)} %`} />
                      </div>}
                    </div>
                  </div>
                </div>);
              })}
            </AccordionDetails>
        </Accordion>
    );
}
export default PointerRow;