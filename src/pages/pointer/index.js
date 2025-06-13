import React from 'react';
import { useLocation } from 'react-router-dom';
// Load a custom hook to quert the API
import useAPI from 'src/hooks/use-api';
// Automatic parsers for URL search or additional arguments
import { parse } from 'qs';
// Constants
import { BASE_VERSIONED_PATH } from '../../utils/constants';
// Import web components
import Card from '../../components/animated-card';
import { CardContent, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGhost, faUmbrella } from '@fortawesome/free-solid-svg-icons';
// CSS style
import style from './style.module.css';
import Loading from 'src/components/loading';
import { round2cents } from 'src/utils/auxiliar-functions';

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
  // Get pointers data using the API
  const pointerURL = `${BASE_VERSIONED_PATH}/pointers/${reference}/${referenceId}`;
  const { loading, payload, error } = useAPI(pointerURL);
  // Wait for the response
  if (loading) return <Loading />;
  if (error) return error.message;
  if (!payload) return 'Something went wrong';
  // Render the page
  return (<Card>
    <CardContent>
      <Typography variant="h5">{`Entries including ${referenceId} ${ID_NAMES[reference]}`}</Typography>
      {payload.map(project => {
        return (<Card className={style.card} key={project.id}>
          <CardContent>
            <div className={style['horizontal-expanded']}>
              <Typography variant="h6">{project.id}</Typography>
              <Typography variant="subtitle2">
                <a href={project.url} target="_blank" rel="noopener noreferrer" >
                  {project.url}
                </a>
              </Typography>
            </div>
            <div className={style.horizontal}>
              {project.presence && <div>
                <FontAwesomeIcon icon={faGhost} />
                {`  Presence: ${round2cents(project.presence * 100)} %`}
              </div>}
              {project.coverage && <div>
                <FontAwesomeIcon icon={faUmbrella} />
                {`  Coverage: ${round2cents(project.coverage * 100)} %`}
              </div>}
            </div>
          </CardContent>
        </Card>);
      })}
    </CardContent>
  </Card>);
};

export default Pointer;