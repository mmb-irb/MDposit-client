import React, { useState, useRef, useCallback } from 'react';

import { Link } from 'react-router-dom';
// Import MUI components
import {
    Button,
    Popper,
    Grow,
    Paper,
    MenuList,
    MenuItem,
    ListItemIcon,
} from '@mui/material';
// Import MUI icons
import {
    Public as PublicIcon,
    Home as HomeIcon,
    Search as SearchIcon,
    ChevronRight as ChevronRightIcon,
    Timeline as TimelineIcon,
    BarChart as BarChartIcon,
    Info as InfoIcon,
    Article as ArticleIcon,
    DataObject as DataObjectIcon,
    Help as HelpIcon,
    Mail as MailIcon,
    Storage as StorageIcon,
    Assignment as AssignmentIcon,
    ArrowDropDown as ArrowDropDownIcon,
} from '@mui/icons-material';
// Import constants
import { BASE_PATH, HOST_CONFIG, MDPOSIT_URL } from '../../utils/constants';
// Import CSS style
import style from './style.module.css';
import { useTheme } from '@mui/material/styles';

// Render all buttons in the superior header and manage the user redirection when they are clicked
const HeaderMenu = () => {
    // Set states to control if buton panels are open or closed
    const [ isDataOpen, openData ] = useState(false);
    const [ isAboutOpen, openAbout ] = useState(false);
    // Set references for the buttos which open panels, so we can further anchor the pop up menus
    const dataRef = useRef();
    const aboutRef = useRef();
    const currentLocation = window.location.hash;
    const isCurrent = useCallback(dir => currentLocation.endsWith(dir), [ currentLocation ]);
    // Get the provided theme
    const theme = useTheme();
    // Set some style-related values
    const primaryColor = theme.palette.primary.light;
    const secondaryColor = theme.palette.secondary.main;
    const contrastText = theme.palette.secondary.contrastText;
    const selectedTabStyle = { color: contrastText, backgroundColor: secondaryColor };
    const normalTabStyle= { color: contrastText };
    // Set components in the menu
    return (<menu className={style.menu}>
        <div className={style.main}>
            {!HOST_CONFIG.global && <Button
                component={"a"}
                color="inherit"
                href={MDPOSIT_URL}
                target={"_blank"}
                startIcon={<PublicIcon />}
                className={style.button}
                style={{'marginRight': '1.5em'}}
                variant='outlined'
            >
                Global
            </Button>}
            <Button
                component={Link}
                color="inherit"
                to="/"
                startIcon={<HomeIcon />}
                className={style.button}
            >
                Home
            </Button>
            <Button
                component={Link}
                color="inherit"
                to="/browse"
                startIcon={<SearchIcon />}
                className={style.button}
            >
                Browse
            </Button>

            <Button
                color="inherit"
                startIcon={<StorageIcon />}
                endIcon={<ArrowDropDownIcon style={{ marginLeft: '-4px' }} />}
                className={style.button}
                ref={dataRef}
                onMouseEnter={() => openData(true)}
                onMouseLeave={() => openData(false)}
            >
                Data
            </Button>
            <Popper
                open={isDataOpen}
                anchorEl={dataRef.current}
                transition
                placement={'bottom'}
                className={style.popper}
                onMouseEnter={() => openData(true)}
                onMouseLeave={() => openData(false)}
            >
                {({ TransitionProps }) => (
                <Grow
                    {...TransitionProps}
                    style={{ transformOrigin: 'center top' }}
                >
                    <Paper sx={{ backgroundColor: primaryColor }}>
                        <MenuList>
                            <MenuItem
                                onClick={() => openData(false)}
                                component={Link}
                                to="/statistics"
                                // If this is the current tab then use a different style
                                style={(isCurrent("statistics") && selectedTabStyle) || normalTabStyle}
                            >
                                <ListItemIcon >
                                    <BarChartIcon fontSize="small" sx={{ color: contrastText }} />
                                </ListItemIcon>
                                Statistics
                            </MenuItem>
                            {!HOST_CONFIG.singleCollection && <MenuItem
                                onClick={() => openData(false)}
                                component={Link}
                                to="/collections"
                                // If this is the current tab then use a different style
                                style={(isCurrent("collections") && selectedTabStyle) || normalTabStyle}
                            >
                                <ListItemIcon >
                                    <AssignmentIcon fontSize="small" sx={{ color: contrastText }} />
                                </ListItemIcon>
                                Collections
                            </MenuItem>}
                            <MenuItem
                                onClick={() => openData(false)}
                                component={Link}
                                to="/meta"
                                // If this is the current tab then use a different style
                                style={(isCurrent("meta") && selectedTabStyle) || normalTabStyle}
                            >
                                <ListItemIcon >
                                    <TimelineIcon fontSize="small" sx={{ color: contrastText }} />
                                </ListItemIcon>
                                Meta-analysis
                            </MenuItem>
                        </MenuList>
                    </Paper>
                </Grow>
                )}
            </Popper>
            <Button
                component="a"
                color="inherit"
                href={`${BASE_PATH}docs/`}
                target={"_blank"}
                startIcon={<ChevronRightIcon />}
                className={style.button}
            >
                REST API
            </Button>
            <Button
                color="inherit"
                startIcon={<InfoIcon />}
                endIcon={<ArrowDropDownIcon style={{ marginLeft: '-4px' }} />}
                className={style.button}
                ref={aboutRef}
                onMouseEnter={() => openAbout(true)}
                onMouseLeave={() => openAbout(false)}
            >
                About
            </Button>
            <Popper
                open={isAboutOpen}
                anchorEl={aboutRef.current}
                transition
                placement={'bottom'}
                className={style.popper}
                onMouseEnter={() => openAbout(true)}
                onMouseLeave={() => openAbout(false)}
            >
                {({ TransitionProps }) => (
                <Grow
                    {...TransitionProps}
                    style={{ transformOrigin: 'center top' }}
                >
                    <Paper sx={{ backgroundColor: primaryColor }}>
                        <MenuList>
                            <MenuItem
                                onClick={() => openAbout(false)}
                                component={Link}
                                to="/documents"
                                style={(isCurrent("documents") && selectedTabStyle) || normalTabStyle}
                            >
                                <ListItemIcon >
                                    <ArticleIcon fontSize="small" sx={{ color: contrastText }} />
                                </ListItemIcon>
                                Documents
                            </MenuItem>
                            {/* <MenuItem
                                onClick={() => openAbout(false)}
                                component={Link}
                                to="/software"
                                style={(isCurrent("software") && selectedTabStyle) || normalTabStyle}
                            >
                                <ListItemIcon >
                                    <DataObjectIcon fontSize="small" sx={{ color: contrastText }} />
                                </ListItemIcon>
                                Software
                            </MenuItem> */}
                            <MenuItem
                                onClick={() => openAbout(false)}
                                component={Link}
                                to="/help"
                                style={(isCurrent("help") && selectedTabStyle) || normalTabStyle}
                            >
                                <ListItemIcon>
                                    <HelpIcon fontSize="small" sx={{ color: contrastText }} />
                                </ListItemIcon>
                                Help
                            </MenuItem>
                            <MenuItem
                                onClick={() => openAbout(false)}
                                component={Link}
                                to="/contact"
                                style={(isCurrent("contact") && selectedTabStyle) || normalTabStyle}
                            >
                                <ListItemIcon>
                                    <MailIcon fontSize="small" sx={{ color: contrastText }} />
                                </ListItemIcon>
                                Contact
                            </MenuItem>
                        </MenuList>
                    </Paper>
                </Grow>
                )}
            </Popper>
        </div>
    </menu>);
}
  

export default HeaderMenu;