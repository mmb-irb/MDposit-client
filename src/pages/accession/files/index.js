// This script handles the 'Downloads' page, which was called 'Files' before

import React, { useContext, useState } from 'react';
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
  ToggleButton,
  ToggleButtonGroup,
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

// The main trajectory, as stored in the database, which the API exports to other formats
const STORED_TRAJECTORY_FILENAME = 'trajectory.bin';

// Formats the API exports the main structure and trajectory to
// The first one is the format suggested by default
const STRUCTURE_FORMATS = [
  { format: 'cif', label: 'mmCIF' },
  { format: 'pdb', label: 'PDB' },
];
const TRAJECTORY_FORMATS = [
  { format: 'xtc', label: 'XTC' },
  { format: 'trr', label: 'TRR' },
  { format: 'nc', label: 'NetCDF' },
  { format: 'dcd', label: 'DCD' },
];

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

// Set a button to download a file exported by the API (e.g. the structure), with a selector of its format
// The API names the downloaded file according to the format, so there is no filename here
const ExportedFile = ({ title, endpoint, formats, description, accessionAndMdNumber }) => {
  const [format, setFormat] = useState(formats[0].format);
  return (
    <Card className={style.title}>
      <CardContent className={style.horizontal}>
        <div className={style.horizontal}>
          <Typography variant="h6">{title}</Typography>
          <Icon className={style['main-icon']}>
            <FontAwesomeIcon icon={faFile} />
          </Icon>
          {description && (
            <Typography color="textSecondary" variant="caption" className={style.description}>
              {description}
            </Typography>
          )}
        </div>
        <div className={style.actions}>
          <ToggleButtonGroup
            value={format}
            exclusive
            onChange={(event, newFormat) => { if (newFormat !== null) setFormat(newFormat) }}
            size="small"
            aria-label={`${title} format`}
          >
            {formats.map(({ format, label }) =>
              <ToggleButton key={format} value={format}>{label}</ToggleButton>)}
          </ToggleButtonGroup>
          <Button
            size="large"
            color="primary"
            component="a"
            href={`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/${endpoint}?format=${format}`}
            target="_blank"
          >
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Set a list of redundant files which are not to be suggested to the user
const REDUNDANT_FILES = [
  // Already suggested by default files
  // The main structure and trajectory are exported by the API, but they may be stored as well
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
  const { accessionAndMdNumber, fileDescriptors, metadata } = useContext(ProjectCtx);

  // Send a request to the API with the url of the rgyr analysis
  const { loading, payload, error } = fileDescriptors;

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened with file descriptors';

  // Find the stored main trajectory among file descriptors, which is exported by the API if it exists
  const main_trajectory = payload.find(
    file => file.filename === STORED_TRAJECTORY_FILENAME,
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
      <ExportedFile
        title={'Main Structure'}
        endpoint={'structure'}
        formats={STRUCTURE_FORMATS}
        description={metadata.SYSTATS && `${formatNumber(metadata.SYSTATS)} atoms`}
        accessionAndMdNumber={accessionAndMdNumber}
      />
      {/* Main trajectory */}
      {main_trajectory &&
        <ExportedFile
          title={'Main Trajectory'}
          endpoint={'trajectory'}
          formats={TRAJECTORY_FORMATS}
          description={`${formatNumber(main_trajectory.metadata.atoms)} atoms in ` +
            `${formatNumber(main_trajectory.metadata.frames)} frames`}
          accessionAndMdNumber={accessionAndMdNumber}
        />}
      {/* Main topology */}
      {main_topology &&
        <SuggestedFile
          title={'Main Topology'}
          filenotes={main_topology}
          accessionAndMdNumber={accessionAndMdNumber}
        />}
      {interestingFiles.length > 0 &&
        <Typography variant="h6" className={style.title}>
          Other interesting files
        </Typography>}
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
