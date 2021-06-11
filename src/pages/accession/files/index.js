// This script handles the 'Downloads' page, which was called 'Files' before

import React, { useContext } from 'react';
import prettyBytes from 'pretty-bytes';

import {
  Icon,
  Divider,
  ExpansionPanel,
  ExpansionPanelSummary,
  ExpansionPanelDetails,
  ExpansionPanelActions,
  Button,
  Typography,
  Chip,
} from '@material-ui/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFile } from '@fortawesome/free-regular-svg-icons';
import { faChevronDown, faServer } from '@fortawesome/free-solid-svg-icons';

import Card from '../../../components/animated-card';

import formatNumber from '../../../utils/number-formatter';
import getEstimate from '../../../utils/get-download-time-estimate';
import { BASE_PATH, BASE_PATH_PROJECTS } from '../../../utils/constants';

import { ProjectCtx } from '../../../contexts';

import style from './style.module.css';

// Classify files per groups according to their file format
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

  const groupedFiles = Object.entries(
    files.reduce(groupPerTypeReducer, newGroup()),
  ).filter(([, set]) => set.size);

  return (
    <>
      <Typography variant="h5">Files</Typography>
      {[...groupedFiles, api].map(([key, set], i) => (
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
                url || `${BASE_PATH_PROJECTS}${identifier}/files/${filename}`;
              return (
                <ExpansionPanel key={filename}>
                  <ExpansionPanelSummary
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
                  </ExpansionPanelSummary>
                  <ExpansionPanelDetails className={style.details}>
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
                  </ExpansionPanelDetails>
                  <Divider variant="middle" />
                  <ExpansionPanelActions>
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
                  </ExpansionPanelActions>
                </ExpansionPanel>
              );
            },
          )}
        </Card>
      ))}
    </>
  );
});
