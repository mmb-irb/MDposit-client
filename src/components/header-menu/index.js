import React, { useState, useRef, useCallback } from 'react';

import { Link } from 'react-router-dom';
// Import MUI components
import {
    Button,
    Popper,
    Grow,
    Paper,
    ClickAwayListener,
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
    Mail as MailIcon
} from '@mui/icons-material';
// Import constants
import { BASE_PATH, HOST_CONFIG, MDPOSIT_URL } from '../../utils/constants';
// Import CSS style
import style from './style.module.css';
import { useTheme } from '@mui/material/styles';

// Render all buttons in the superior header and manage the user redirection when they are clicked
const HeaderMenu = () => {
    // Set a state to control if the help panel is open or closed
    const [ isHelpOpen, openHelp ] = useState(false);
    // Set a reference for the help button so we can further anchor the pop up menu
    const helpRef = useRef();
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
                component={Link}
                color="inherit"
                to="/meta"
                startIcon={<TimelineIcon />}
                className={style.button}
            >
                Meta-analysis
            </Button>
            <Button
                component={Link}
                color="inherit"
                to="/statistics"
                startIcon={<BarChartIcon />}
                className={style.button}
            >
                Statistics
            </Button>
            <Button
                onClick={() => openHelp(!isHelpOpen)}
                color="inherit"
                startIcon={<InfoIcon />}
                className={style.button}
                ref={helpRef}
            >
                About
            </Button>
            <Popper
                open={isHelpOpen}
                anchorEl={helpRef.current}
                transition
                placement={'bottom'}
                className={style.popper}
            >
                {({ TransitionProps }) => (
                <Grow
                    {...TransitionProps}
                    style={{ transformOrigin: 'center top' }}
                >
                    <Paper sx={{ backgroundColor: primaryColor }}>
                    <ClickAwayListener onClickAway={() => openHelp(false)}>
                        <MenuList>
                            <MenuItem
                                onClick={() => openHelp(false)}
                                component={Link}
                                to="/documents"
                                // If this is the current tab then use a different style
                                style={(isCurrent("documents") && selectedTabStyle) || normalTabStyle}
                            >
                                <ListItemIcon >
                                    <ArticleIcon fontSize="small" sx={{ color: contrastText }} />
                                </ListItemIcon>
                                Documents
                            </MenuItem>
                            <MenuItem
                                onClick={() => openHelp(false)}
                                component={Link}
                                to="/software"
                                // If this is the current tab then use a different style
                                style={(isCurrent("software") && selectedTabStyle) || normalTabStyle}
                            >
                                <ListItemIcon >
                                    <DataObjectIcon fontSize="small" sx={{ color: contrastText }} />
                                </ListItemIcon>
                                Software
                            </MenuItem>
                            <MenuItem
                                onClick={() => openHelp(false)}
                                component={Link}
                                to="/help"
                                // If this is the current tab then use a different style
                                style={(isCurrent("help") && selectedTabStyle) || normalTabStyle}
                            >
                                <ListItemIcon>
                                    <HelpIcon fontSize="small" sx={{ color: contrastText }} />
                                </ListItemIcon>
                                Help
                            </MenuItem>
                            <MenuItem
                                onClick={() => openHelp(false)}
                                component={Link}
                                to="/contact"
                                // If this is the current tab then use a different style
                                style={(isCurrent("contact") && selectedTabStyle) || normalTabStyle}
                            >
                                <ListItemIcon>
                                    <MailIcon fontSize="small" sx={{ color: contrastText }} />
                                </ListItemIcon>
                                Contact
                            </MenuItem>
                        </MenuList>
                    </ClickAwayListener>
                    </Paper>
                </Grow>
                )}
            </Popper>
        </div>
    </menu>);
}
  

export default HeaderMenu;