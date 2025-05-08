import React from 'react';

import { Switch, Typography } from '@mui/material';
import style from './style.module.css';

// Render a switch with a label on each side
const DoubleSideSwitch = ({ firstLabel, secondLabel, isFirst, onChange }) => 
    <div className={style.horizontal}>
        <Typography color={isFirst ? null : "textSecondary"} variant="h6" >{firstLabel}</Typography>
        <Switch checked={!isFirst} onChange={onChange} />
        <Typography color={isFirst ? "textSecondary" : null} variant="h6">{secondLabel}</Typography>
    </div>

export default DoubleSideSwitch;
