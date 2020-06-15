import React, { useState, useContext } from 'react';

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

import Loading from '../../loading';

// Load the project contexts
//import { ProjectCtx } from '../../../contexts';

import useAPI from '../../../hooks/use-api';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

// Render the menu of the project (i.e. the inferior header)
// It only appears when the user is inside a project
const ProjectMenu = ({ params: { accession, subPage } }) => {
  // Get the current project metadata
  //const project = useContext(ProjectCtx);
  //console.log(project);
  // Set which menu is opened
  const [openMenu, setOpenMenu] = useState(-1);
  // Set a standarized format state for the popover to work properly
  const [element, setElement] = useState(null);
  // Request all the available analyses in this project to the API
  // Then, this menu displays a tab for each analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/`,
  );

  if (loading) return <Loading />;
  if (error) return error.toString();
  if (!payload) return 'Chain analysis is not found';

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
        { name: 'RMSD', dir: 'rmsd', cond: payload.includes('rmsd') },
        {
          name: 'RMSD per residue',
          dir: 'rmsd-perres',
          cond: payload.includes('rmsd-perres'),
        },
        {
          name: 'RMSD pairwise',
          dir: 'rmsd-pairwise',
          cond: payload.includes('rmsd-pairwise'),
        },
        {
          name: 'Radius of gyration',
          dir: 'rgyr',
          cond: payload.includes('rgyr'),
        },
        {
          name: 'Fluctuation',
          dir: 'fluctuation',
          cond: payload.includes('fluctuation'),
        },
        { name: 'PCA', dir: 'pca', cond: payload.includes('pca') },
      ],
    },
    {
      name: 'interface analyses',
      drops: [
        {
          name: 'Distance per residue',
          dir: 'dist-perres',
          cond: payload.includes('dist-perres'),
        },
        {
          name: 'Electrostatic potencial surface',
          dir: 'electrostatic',
          cond: payload.includes('rmsd'),
        }, // DANI: Este hay que cambiarlo
        {
          name: 'Hydrogen bonds',
          dir: 'hbonds',
          cond: payload.includes('hbonds'),
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
        value={!loading && subPage}
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
