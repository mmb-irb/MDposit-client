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

import Loading from '../../../components/loading';

// Set a regular expression to match the main topology
const MAIN_TOPOLOGY_REGEXP = new RegExp(`^topology.(tpr|prmtop|psf|top)$`);

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

// This is the last element, for 'other' files
const api = [
  'Programmatic API',
  [
    {
      filename: 'Especially for bigger files, consider using the programmatic API as documented',
      url: BASE_PATH + 'docs/#/files',
      icon: <FontAwesomeIcon icon={faServer} />,
    },
  ],
];

// Set a standard button to download a suggested file
const SuggestedFile = ({ title, filenotes, accessionAndMdNumber }) => 
  <Card className={style.title}>
    <CardContent className={style.horizontal}>
      <div className={style.horizontal}>
        {title && <Typography variant="h6">{title}</Typography>}
        <Icon className={style['main-icon']}>
          <FontAwesomeIcon icon={faFile} />
        </Icon>
        <div>
          <Typography variant="subtitle2">
            {filenotes.filename}
          </Typography>
          {filenotes.length && (
            <Typography color="textSecondary" variant="caption">
              {prettyBytes(filenotes.length)}
            </Typography>
          )}
        </div>
      </div>
      <Button
        size="large"
        color="primary"
        component="a"
        href={`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/files/${filenotes.filename}`}
        download={filenotes.filename}
        target="_blank"
      >
        Download
      </Button>
    </CardContent>
  </Card>

// Set a list of redundant files which are not to be suggested to the user
const REDUNDANT_FILES = [
  // Already suggested by default files
  new RegExp(MAIN_STRUCTURE_FILENAME), // The structure
  new RegExp(MAIN_TRAJECTORY_FILENAME), // The trajectory
  MAIN_TOPOLOGY_REGEXP, // The topology
  // Typical files
  new RegExp(`.bin$`), // All files with our custom binary format
  new RegExp(`.itp$`), // All itp files
  new RegExp(`^pocket_[0-9]{2}.pdb$`), // Pockets
  new RegExp(`^screenshot.jpg$`), // The screenshot
  new RegExp(`^clusters_[0-9]{2}_screenshot_[0-9]{2}.jpg$`), // Cluster screenshots
  new RegExp(`^markov_screenshot_[0-9]{2}.jpg$`), // Markov screenshots
  // Old files
  new RegExp(`^average.pdb$`),
  new RegExp(`^charges.txt$`),
  new RegExp(`^firstFrame.pdb$`),
  new RegExp(`^noelem.pdb$`),
];
// Set a function to check if a filename is among the redundant filenames
const isRedundant = filename => {
  for (const pattern of REDUNDANT_FILES) {
    if (pattern.test(filename)) return true;
  }
  return false;
}

export default React.memo(() => {
  // Load project data
  const { accessionAndMdNumber, fileDescriptors } = useContext(ProjectCtx);

  // Send a request to the API with the url of the rgyr analysis
  const { loading, payload, error } = fileDescriptors;

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened with file descriptors';

  // Find the main structure file among file descriptors
  const main_structure = payload.find(
    file => file.filename === MAIN_STRUCTURE_FILENAME,
  );
  // Find the main trajectory file among file descriptors
  const main_trajectory = payload.find(
    file => file.filename === MAIN_TRAJECTORY_FILENAME,
  );
  // Find the main topology file among file descriptors
  const main_topology = payload.find(
    file => MAIN_TOPOLOGY_REGEXP.test(file.filename)
  );
  // Check if we have unusual files and, if so, suggest them
  const interestingFiles = payload.filter(file => !isRedundant(file.filename));

  return (
    <>
      {/* Main structure */}
      {main_structure &&
        <SuggestedFile
          title={'Main Structure'}
          filenotes={main_structure}
          accessionAndMdNumber={accessionAndMdNumber}
        />}
      {/* Main trajectory */}
      {main_trajectory &&
        <SuggestedFile
          title={'Main Trajectory'}
          filenotes={main_trajectory}
          accessionAndMdNumber={accessionAndMdNumber}
        />}
      {/* Main topology */}
      {main_topology &&
        <SuggestedFile
          title={'Main Topology'}
          filenotes={main_topology}
          accessionAndMdNumber={accessionAndMdNumber}
        />}
      <Typography variant="h6" className={style.title}>Other interesting files</Typography>
      {interestingFiles.map((filenotes, i) =>
        <SuggestedFile
          key={i}
          filenotes={filenotes}
          accessionAndMdNumber={accessionAndMdNumber}
        />)}

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
                url || `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/files/${filename}`;
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
