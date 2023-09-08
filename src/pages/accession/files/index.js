// This script handles the 'Downloads' page, which was called 'Files' before

import React, { useContext } from 'react';
import prettyBytes from 'pretty-bytes';

import {
  Icon,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  AccordionActions,
  Button,
  Typography,
  Chip,
  CardContent,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFile } from '@fortawesome/free-regular-svg-icons';
import { faChevronDown, faServer } from '@fortawesome/free-solid-svg-icons';

import Card from '../../../components/animated-card';

import formatNumber from '../../../utils/number-formatter';
import getEstimate from '../../../utils/get-download-time-estimate';
import {
  BASE_PATH,
  BASE_PATH_PROJECTS,
  MAIN_STRUCTURE_FILENAME,
  MAIN_TRAJECTORY_FILENAME,
} from '../../../utils/constants';

import { ProjectCtx } from '../../../contexts';

import style from './style.module.css';

// Classify files per groups according to their file format
/*
const groupPerTypeReducer = (group, file) => {
  let groupName;
  const name = file.filename.toLowerCase();
  if (
    name.endsWith('.pdb') ||
    name.endsWith('.gro') ||
    name.endsWith('.top') ||
    name.endsWith('.itp') ||
    name.endsWith('.psf') ||
    name.endsWith('.prmtop')
  ) {
    groupName = 'Structure/topology';
  } else if (
    name.endsWith('.xtc') ||
    name.endsWith('.traj') ||
    name.endsWith('.dcd')
  ) {
    groupName = 'Trajectory';
    // Discard all .bin files although they are trajectories
  } else if (name.endsWith('.bin')) {
    groupName = null;
  } else {
    groupName = 'Other';
  }
  if (groupName) group[groupName].add(file);
  return group;
};

const newGroup = () => ({
  'Structure/topology': new Set(),
  Trajectory: new Set(),
  Analysis: new Set(),
  Media: new Set(),
  Other: new Set(),
});
*/

const api = [
  'Programmatic API',
  [
    {
      filename:
        'Especially for bigger files, consider using the programmatic API as documented',
      url: BASE_PATH + 'docs/#/files',
      icon: <FontAwesomeIcon icon={faServer} />,
    },
  ],
];

export default React.memo(() => {
  const { identifier, files } = useContext(ProjectCtx);

  // const groupedFiles = Object.entries(
  //   files.reduce(groupPerTypeReducer, newGroup()),
  // ).filter(([, set]) => set.size);

  const main_structure = files.find(
    file => file.filename === MAIN_STRUCTURE_FILENAME,
  );
  const main_trajectory = files.find(
    file => file.filename === MAIN_TRAJECTORY_FILENAME,
  );

  return (
    <>
      {/* Main structure */}
      {main_structure && (
        <Card className={style.title}>
          <CardContent className={style.horizontal}>
            <div className={style.horizontal}>
              <Typography variant="h6">Main Structure</Typography>
              <Icon className={style['main-icon']}>
                <FontAwesomeIcon icon={faFile} />
              </Icon>
              <div>
                <Typography variant="subtitle2">
                  {main_structure.filename}
                </Typography>
                {main_structure.length && (
                  <Typography color="textSecondary" variant="caption">
                    {prettyBytes(main_structure.length)}
                  </Typography>
                )}
              </div>
            </div>

            <Button
              size="large"
              color="primary"
              component="a"
              href={`${BASE_PATH_PROJECTS}/${identifier}/files/${main_structure.filename}`}
              download={main_structure.filename}
              target="_blank"
            >
              Download
            </Button>
          </CardContent>
        </Card>
      )}
      {/* Main trajectory */}
      {main_trajectory && (
        <Card className={style.title}>
          <CardContent className={style.horizontal}>
            <div className={style.horizontal}>
              <Typography variant="h6">Main Trajectory</Typography>
              <Icon className={style['main-icon']}>
                <FontAwesomeIcon icon={faFile} />
              </Icon>
              <div>
                <Typography variant="subtitle2">
                  {main_trajectory.filename}
                </Typography>
                {main_trajectory.length && (
                  <Typography color="textSecondary" variant="caption">
                    {prettyBytes(main_trajectory.length)}
                  </Typography>
                )}
              </div>
            </div>

            <Button
              size="large"
              color="primary"
              component="a"
              href={`${BASE_PATH_PROJECTS}/${identifier}/files/${main_trajectory.filename}`}
              download={main_trajectory.filename}
              target="_blank"
            >
              Download
            </Button>
          </CardContent>
        </Card>
      )}
      {/* This was [...groupedFiles, api] before */}
      {[api].map(([key, set], i) => (
        <Card overrideComponent key={typeof key === 'string' ? key : i}>
          <Typography variant="h6" className={style.title}>
            &nbsp;⤷&nbsp;
            {key}
          </Typography>
          {Array.from(
            set,
            ({
              filename,
              url,
              icon,
              md5,
              length,
              metadata: { frames, atoms } = {},
            }) => {
              const estimatedTime = length && getEstimate(length);
              const href =
                url || `${BASE_PATH_PROJECTS}/${identifier}/files/${filename}`;
              return (
                <Accordion key={filename}>
                  <AccordionSummary
                    expandIcon={<FontAwesomeIcon icon={faChevronDown} />}
                    className={style.summary}
                  >
                    <Icon className={style.icon}>
                      {icon || <FontAwesomeIcon icon={faFile} />}
                    </Icon>
                    <div>
                      <Typography variant="subtitle2">{filename}</Typography>
                      {length && (
                        <Typography color="textSecondary" variant="caption">
                          {prettyBytes(length)}
                        </Typography>
                      )}
                    </div>
                  </AccordionSummary>
                  <AccordionDetails className={style.details}>
                    {frames && atoms && (
                      <div>
                        containing a total of {formatNumber(atoms)} atoms in{' '}
                        {formatNumber(frames)} frames
                      </div>
                    )}
                    {md5 && (
                      <div>
                        md5 checksum: <code>{md5}</code>
                      </div>
                    )}

                    <div>
                      link: <code>{href}</code>
                    </div>
                  </AccordionDetails>
                  <Divider variant="middle" />
                  <AccordionActions>
                    {estimatedTime && (
                      <Chip
                        label={`estimated download time: ${estimatedTime}`}
                        title="According to your current network speed, might vary if connection quality change or if the server is under load"
                        color={
                          estimatedTime.includes('minutes')
                            ? 'secondary'
                            : 'primary'
                        }
                      />
                    )}
                    <Button
                      size="large"
                      color="primary"
                      component="a"
                      href={href}
                      download={!url && filename}
                      target="_blank"
                    >
                      {url ? 'Go' : 'Download'}
                    </Button>
                  </AccordionActions>
                </Accordion>
              );
            },
          )}
        </Card>
      ))}
    </>
  );
});
