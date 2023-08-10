import React, { useState, useContext, useCallback, useMemo } from 'react';

import {
  CardContent,
  Popper,
  Grow,
  Paper,
  ClickAwayListener,
  MenuList,
  MenuItem,
  Tab,
  Tabs,
  Typography,
  AppBar,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Link } from 'react-router-dom';

// Load the project contexts
import { ProjectCtx } from '../../../contexts';

import { NICE_NAMES } from '../../../utils/constants';
import style from './style.module.css';

// Set manually which references have entropies or epitopes
// This needs to be updated by hand when there is a new reference with entropies or epitopes
// This workaround prevents having to pass the references context to the root, which makes no sense
const referencesWithEntropies = ['P0DTC2'];
const hasEntropies = referenceId => {
  return referencesWithEntropies.indexOf(referenceId) > -1;
};
const referencesWithEpitopes = ['P0DTC2'];
const hasEpitopes = referenceId => {
  return referencesWithEpitopes.indexOf(referenceId) > -1;
};

// Render the menu of the project (i.e. the inferior header)
// It only appears when the user is inside a project
const ProjectMenu = ({ accession, subPage }) => {
  // Get the current project metadata
  // WARNING: context may be missing in the first renders
  const { metadata, analyses, files } = useContext(ProjectCtx) || {
    metadata: {},
    analyses: [],
    files: [],
  };

  // Set which menu is opened
  const [openMenu, setOpenMenu] = useState(-1);
  // Set a standarized format state for the popover to work properly
  const [element, setElement] = useState(null);

  // Set a function used to check if we are in a specific local url
  const currentLocation = window.location.hash;
  const isCurrent = useCallback(url => '#' + url === currentLocation, [
    currentLocation,
  ]);

  // Open the specified menu
  // If the specified menu is the already open menu, then close it
  const handleClick = (key, event) => {
    if (key !== openMenu) setOpenMenu(key);
    else setOpenMenu(-1);

    setElement(event.currentTarget);
  };

  // Close the menu
  const handleClose = (key = openMenu) => {
    if (key === openMenu) {
      setOpenMenu(-1);
      setElement(null);
    }
  };

  function handleListKeyDown(event) {
    if (event.key === 'Tab') {
      event.preventDefault();
      setOpenMenu(-1);
    }
  }

  const tabs = useMemo(() => {
    // Check if any metadata reference has a map and its reference data has entropies
    const references = metadata && metadata.REFERENCES;
    const anySuitableReferenceWithEntropies =
      references && references.some(reference => hasEntropies(reference));
    // Check if any metadata reference has a map and its reference data has entropies
    const anySuitableReferenceWithEpitopes =
      references && references.some(reference => hasEpitopes(reference));

    // Set the tabs to be displayed
    // Each tab must have 'dir' or 'drops'. Never both, never none.
    // Tabs with 'dir' link the user directly on click
    // Tabs with 'drops' display a menu with multiple links on click
    // 'dir' is the subpage name
    // 'cond' is the condition to this subpage to be avilable
    const tabs = [
      {
        name: 'Overview',
        dir: 'overview',
      },
      {
        name: 'Trajectory',
        dir: 'trajectory',
      },
      {
        name: 'Analyses',
        drops: [
          {
            name: 'Quality control',
            analyses: [
              {
                name: 'RMSDs',
                dir: 'rmsds',
                cond: analyses && analyses.includes('rmsds'),
              },
              {
                name: 'RMSD per residue',
                dir: 'rmsd-perres',
                cond: analyses && analyses.includes('rmsd-perres'),
              },
              {
                name: 'RMSD pairwise',
                dir: 'rmsd-pairwise',
                cond: analyses && analyses.includes('rmsd-pairwise'),
              },
              {
                name: 'Radius of gyration',
                dir: 'rgyr',
                cond: analyses && analyses.includes('rgyr'),
              },
              {
                name: 'Fluctuation',
                dir: 'fluctuation',
                cond: analyses && analyses.includes('fluctuation'),
              },
              {
                name: 'PCA',
                dir: 'pca',
                cond: analyses && analyses.includes('pca'),
              },
              {
                name: 'Solvent accessible surface',
                dir: 'sasa',
                cond: analyses && analyses.includes('sasa'),
              },
            ],
          },
          {
            name: 'Interactions',
            analyses: [
              {
                name: 'Distance per residue',
                dir: 'dist-perres',
                cond: analyses && analyses.includes('dist-perres'),
              },
              {
                name: 'Electrostatic potencial surface',
                dir: 'electrostatic',
                cond: metadata.INTERACTIONS && metadata.INTERACTIONS.length > 0,
              },
              {
                name: 'Hydrogen bonds',
                dir: 'hbonds',
                cond: analyses && analyses.includes('hbonds'),
              },
              {
                name: 'Energies',
                dir: 'energies',
                cond: analyses && analyses.includes('energies'),
              },
            ],
          },
          {
            name: 'Bibliography',
            analyses: [
              {
                name: 'Epitopes',
                dir: 'epitopes',
                cond: anySuitableReferenceWithEpitopes,
              },
              {
                name: 'Mutations',
                dir: 'mutations',
                cond: anySuitableReferenceWithEntropies,
              },
            ],
          },
          {
            name: 'Other',
            analyses: [
              {
                name: 'Pockets',
                dir: 'pockets',
                cond: analyses && analyses.includes('pockets'),
              },
            ],
          },
        ],
      },
      {
        name: 'Downloads',
        dir: 'files',
      },
    ];

    // In case the simulation comes from a Markov state model, add the populations analysis to the tabs
    if (metadata && metadata.METHOD === 'Markov state model (MSM)'){
      tabs[2].drops[3].analyses.push({
        name: NICE_NAMES.get('populations'),
        dir: 'populations',
        cond: files && files.find(file => file.filename === 'populations.json'),
      });
      tabs[2].drops[3].analyses.push({
        name: NICE_NAMES.get('markov'),
        dir: 'markov',
        cond: analyses && analyses.includes('markov'),
      });
    }
      

    return tabs;
  }, [metadata, analyses, files]);

  // Get the provided theme
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;
  const secondaryColor = theme.palette.secondary.main;

  // Check if a string is found in the specified (by the 'index') dropTab links
  // If it is, return the same string. If it is not, return undefined
  const inDrop = (value, index) => {
    for (const drop of tabs[index].drops)
      if (drop.analyses.find(analysis => analysis.dir === value)) return value;
    return undefined;
  };

  // Return each of the menu tabs
  return (
    <AppBar position="sticky" className={style['overcome-parent']}>
      <Tabs
        value={subPage}
        indicatorColor="secondary"
        textColor="secondary"
        variant="scrollable"
        scrollButtons="auto"
      >
        {// Tabs
        tabs.map((tab, index) =>
          tab.dir ? (
            // Tabs which link the user directly
            <Tab
              key={index}
              component={Link}
              to={`/id/${accession}/${tab.dir}`}
              label={tab.name}
              value={tab.dir}
              className={style['tab-link']}
              onClick={() => handleClose()}
            />
          ) : (
            // Tabs which drop a menu with multiple links
            // The drop list is defined further, out of the 'Tabs' component
            <Tab
              key={index}
              label={tab.name}
              value={inDrop(subPage, index)}
              className={style['tab-link']}
              onClick={event => handleClick(index, event)}
            />
          ),
        )}
      </Tabs>

      {// The drop lists
      tabs.map(
        (tab, index) =>
          tab.drops && (
            <Popper
              key={'popper' + index}
              open={openMenu === index}
              anchorEl={element}
              transition
              placement={'bottom'}
            >
              {({ TransitionProps }) => (
                <Grow
                  {...TransitionProps}
                  style={{ transformOrigin: 'center top' }}
                >
                  <Paper className={style['tab-drop']}>
                    <ClickAwayListener onClickAway={() => handleClose(index)}>
                      <CardContent className={style.analyses}>
                        {tab.drops.map((drop, d) => (
                          <div key={d}>
                            <Typography variant="h6">{drop.name}</Typography>
                            <MenuList
                              autoFocusItem={openMenu === index}
                              onKeyDown={handleListKeyDown}
                            >
                              {drop.analyses.map((analysis, a) =>
                                analysis.cond ? (
                                  <MenuItem
                                    key={a}
                                    onClick={() => handleClose(index)}
                                    component={Link}
                                    to={`/id/${accession}/${analysis.dir}`}
                                    style={
                                      isCurrent(
                                        `/id/${accession}/${analysis.dir}`,
                                      )
                                        ? {
                                            color: secondaryColor,
                                            backgroundColor: primaryColor,
                                          }
                                        : undefined
                                    }
                                  >
                                    {analysis.name}
                                  </MenuItem>
                                ) : (
                                  <MenuItem key={a} className={style.disabled}>
                                    {analysis.name}
                                  </MenuItem>
                                ),
                              )}
                            </MenuList>
                          </div>
                        ))}
                      </CardContent>
                    </ClickAwayListener>
                  </Paper>
                </Grow>
              )}
            </Popper>
          ),
      )}
    </AppBar>
  );
};

export default ProjectMenu;
