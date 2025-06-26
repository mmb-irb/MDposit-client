import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
// Load a custom hook to quert the API
import useAPI from 'src/hooks/use-api';
// Automatic parsers for URL search or additional arguments
import { parse } from 'qs';
// Constants
import { BASE_VERSIONED_PATH, HOST_CONFIG } from '../../utils/constants';
// Import web components
import Card from '../../components/animated-card';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CardContent,
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

// Set some definitions
const PRESENCE_DEF = 'Resdiues in the system which belong to the reference';
const COVERAGE_DEF = 'Residues in the reference which exist in the system';

// Set ID names for the different references
const ID_NAMES = {
  proteins: 'UniProt ID',
  ligands: 'PubChem ID',
  pdbs: 'PDB code'
};

// Expose a link to get in touch with the IRB group
const Pointer = () => {
  // Get the URL arguments
  const location = useLocation();
  const argsString = location.search.slice(1); // Remove the initial '?'
  const args = parse(argsString);
  // Make sure the arguments were passed
  const reference = args.ref;
  const referenceId = args.id;
  if (!reference) return 'Missing reference';
  if (!referenceId) return 'Missing reference id';
  // Set project metadata values to retrieve from the pointers endpoint
  const projection = {
    name: 'metadata.NAME',
    description: 'metadata.DESCRIPTION',
    authors: 'metadata.AUTHORS',
    groups: 'metadata.GROUPS',
    grouper: HOST_CONFIG.optionsField
  };
  const projectionParameters = '?' + Object.values(projection)
    .map(field => 'projection=' + field).join('&');
  // Get pointers data using the API
  const pointerURL = `${BASE_VERSIONED_PATH}/pointers/${reference}/${referenceId}${projectionParameters}`;
  const { loading, payload, error } = useAPI(pointerURL);
  // Group results according to the grouper parameter
  const groupedData = useMemo(() => {
    if (!payload) return;
    const groupedData = {};
    // Get the unique available values in the grouper parameters
    payload.forEach(project => {
      const group = project[HOST_CONFIG.optionsField];
      if (!groupedData[group]) groupedData[group] = [];
      groupedData[group].push(project);
    })
    return groupedData;
  }, [payload]);
  // Wait for the response
  if (loading) return <Loading />;
  if (error) return error.message;
  if (!payload) return 'Something went wrong';
  // Render the page
  return (<Card>
    <CardContent>
      <Typography variant="h5" style={{ marginBottom: '0.6em' }}>
        {`Entries including ${referenceId} ${ID_NAMES[reference]} (${payload.length} results)`}
      </Typography>
      {Object.entries(groupedData).map(([group, projects]) => {
        const hasLogo = Boolean(HOST_CONFIG.optionsData && HOST_CONFIG.optionsData.logo);
        const pngImage = hasLogo && require(`src/images/${HOST_CONFIG.optionsData.logo[group]}.png`);
        const webpImage = hasLogo && require(`src/images/${HOST_CONFIG.optionsData.logo[group]}.png`);
        const hasDescription = Boolean(HOST_CONFIG.optionsData && HOST_CONFIG.optionsData.description);
        return (
          <Accordion key={group} slotProps={{ transition: { timeout: 500 } }} defaultExpanded={true}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              title={hasDescription && HOST_CONFIG.optionsData.description[group]}
            >
              <div className={style['horizontal-expanded']}>
                <div>
                  <Typography variant="h5">
                    {HOST_CONFIG.optionsNiceNames[group] || group}
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
                    <div>{`Name: ${project[projection.name]}`}</div>
                    <div>{`Description: ${project[projection.description]}`}</div>
                    <div>{`Authors: ${project[projection.authors].join(', ')}`}</div>
                    <div>{`Groups: ${project[projection.groups].join(', ')}`}</div>
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
        )
      })}
    </CardContent>
  </Card>);
};

export default Pointer;