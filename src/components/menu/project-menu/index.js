import React, { useState, useContext, useCallback } from 'react';

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

// Set the configuration of the tabs to be displayed in the menu
// Each tab must have 'dir' or 'drops'. Never both, never none.
// Tabs with 'dir' link the user directly on click
// Tabs with 'drops' display a menu with multiple links on click
const tabs = [
  { dir: 'overview' },
  { dir: 'trajectory' },
  {
    name: 'Analyses',
    drops: [
      {
        name: 'Quality control',
        analyses: [
          'rmsds',
          'rmsd-perres',
          'rmsd-pairwise',
          'rgyr',
          'fluctuation',
          'pca',
          'sasa',
          'clusters'
        ],
      },
      {
        name: 'Interactions',
        analyses: [
          'dist-perres',
          'electrostatic',
          'hbonds',
          'energies',
        ],
      },
      {
        name: 'Bibliography',
        analyses: [
          'epitopes',
          'mutations',
        ],
      },
      {
        name: 'Other',
        analyses: [
          'pockets',
          'populations',
          'markov', 
          'ligand-descriptors',
          'density',
          'thickness',
          'apl',
        ],
      },
    ],
  },
  { dir: 'files' },
];

// Render the menu of the project (i.e. the inferior header)
// It only appears when the user is inside a project
const ProjectMenu = ({ accessionAndMdNumber, subPage }) => {
  // Get the current project metadata
  // WARNING: context may be missing in the first renders
  const { directions } = useContext(ProjectCtx) || { directions: {} };

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

  // Get the provided theme
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;
  const secondaryColor = theme.palette.secondary.main;

  // Set the style of the current selected tab
  const currentTabStyle = {
    color: secondaryColor,
    backgroundColor: primaryColor,
  };

  // Check if a string is found in the specified (by the 'index') dropTab links
  // If it is, return the same string. If it is not, return undefined
  const inDrop = (value, index) => {
    for (const drop of tabs[index].drops)
      if (drop.analyses.includes(value)) return value;
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
              to={`/id/${accessionAndMdNumber}/${tab.dir}`}
              label={NICE_NAMES.get(tab.dir) || tab.dir}
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
              className={style.popper}
            >
              {({ TransitionProps }) => (
                <Grow
                  {...TransitionProps}
                  style={{ transformOrigin: 'center top' }}
                >
                  <Paper className={style['tab-drop']}>
                    <ClickAwayListener onClickAway={() => handleClose(index)}>
                      <CardContent className={style.analyses}>
                        {tab.drops.map((drop, d) => {
                          // Discard analyses whose direction is not even declared since they are not to be shown
                          const displayableAnalyses = drop.analyses.filter(analysis => directions[analysis] !== undefined);
                          if (displayableAnalyses.length === 0) return;
                          return <div key={d}>
                            <Typography variant="h6">{drop.name}</Typography>
                            <MenuList
                              autoFocusItem={openMenu === index}
                              onKeyDown={handleListKeyDown}
                            >
                              {displayableAnalyses.map(analysis => {
                                // Check if this direction is available
                                const available = directions[analysis];
                                // Otherwise set a new button for the direction
                                // Set the name of the button
                                const name = NICE_NAMES.get(analysis) || analysis;
                                // Set a disabled button if the direction is not available
                                if (available === false) return (
                                  <MenuItem key={analysis} className={style.disabled}>
                                    {name}
                                  </MenuItem> );
                                // Set the button direction
                                const buttonDirection = `/id/${accessionAndMdNumber}/${analysis}`;
                                return (<MenuItem
                                    key={analysis}
                                    onClick={() => handleClose(index)}
                                    component={Link}
                                    to={buttonDirection}
                                    // If this is the current tab the use a different style
                                    style={(isCurrent(buttonDirection) && currentTabStyle) || undefined}
                                  >
                                    {name}
                                  </MenuItem>
                                )}
                              )}
                            </MenuList>
                          </div>
                          }
                        )}
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
