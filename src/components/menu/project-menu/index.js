import React, { useState, useContext, useCallback } from 'react';

import {
  Popper,
  Grow,
  Paper,
  ClickAwayListener,
  MenuList,
  MenuItem,
  Tab,
  Tabs,
} from '@material-ui/core';
import { Link } from 'react-router-dom';

// Load the project contexts
import { ProjectCtx } from '../../../contexts';

import style from './style.module.css';

// Render the menu of the project (i.e. the inferior header)
// It only appears when the user is inside a project
const ProjectMenu = ({ params: { accession, subPage } }) => {
  // Get the current project metadata
  const project = useContext(ProjectCtx);
  //console.log(project);
  // Set which menu is opened
  const [openMenu, setOpenMenu] = useState(-1);
  // Set a standarized format state for the popover to work properly
  const [element, setElement] = useState(null);

  // Set a function used to check if we are in a specific local url
  const currentLocation = window.location.hash;
  const isCurrent = useCallback(url => '#' + url === currentLocation, [
    currentLocation,
  ]);

  // Get data from the project context if it is available
  let analyses = [];
  let metadata = {};
  if (project && project.analyses) {
    analyses = project.analyses;
    metadata = project.metadata;
  }

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
      name: 'quality control analyses',
      drops: [
        { name: 'RMSD', dir: 'rmsd', cond: analyses.includes('rmsd') },
        {
          name: 'RMSD per residue',
          dir: 'rmsd-perres',
          cond: analyses.includes('rmsd-perres'),
        },
        {
          name: 'RMSD pairwise',
          dir: 'rmsd-pairwise',
          cond: analyses.includes('rmsd-pairwise'),
        },
        {
          name: 'Radius of gyration',
          dir: 'rgyr',
          cond: analyses.includes('rgyr'),
        },
        {
          name: 'Fluctuation',
          dir: 'fluctuation',
          cond: analyses.includes('fluctuation'),
        },
        { name: 'PCA', dir: 'pca', cond: analyses.includes('pca') },
      ],
    },
    {
      name: 'interface analyses',
      drops: [
        {
          name: 'Distance per residue',
          dir: 'dist-perres',
          cond: analyses.includes('dist-perres'),
        },
        {
          name: 'Electrostatic potencial surface',
          dir: 'electrostatic',
          cond: !!metadata.INTERFACES && !!metadata.INTERFACES[0],
        },
        {
          name: 'Hydrogen bonds',
          dir: 'hbonds',
          cond: analyses.includes('hbonds'),
        },
        {
          name: 'Energies',
          dir: 'energies',
          cond: analyses.includes('energies'),
        },
      ],
    },
    {
      name: 'Downloads',
      dir: 'files',
    },
  ];

  // Check if a string is found in the specified (by the 'index') dropTab links
  // If it is, return the same string. If it is not, return undefined
  const inDrop = (value, index) => {
    for (const drop of tabs[index].drops) if (drop.dir === value) return value;
    return undefined;
  };

  // Return each of the menu tabs
  return (
    <>
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
              to={`/browse/${accession}/${tab.dir}`}
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
                      <MenuList
                        autoFocusItem={openMenu === index}
                        onKeyDown={handleListKeyDown}
                      >
                        {tab.drops.map((drop, d) =>
                          drop.cond ? (
                            <MenuItem
                              key={d}
                              onClick={() => handleClose(index)}
                              component={Link}
                              to={`/browse/${accession}/${drop.dir}`}
                              className={
                                isCurrent(`/browse/${accession}/${drop.dir}`)
                                  ? style.current
                                  : undefined
                              }
                            >
                              {drop.name}
                            </MenuItem>
                          ) : (
                            <MenuItem key={d} className={style.disabled}>
                              {drop.name}
                            </MenuItem>
                          ),
                        )}
                      </MenuList>
                    </ClickAwayListener>
                  </Paper>
                </Grow>
              )}
            </Popper>
          ),
      )}
    </>
  );
};

export default ProjectMenu;
