import React from 'react';

import { Card, CardContent, MenuItem, Select, Typography } from '@mui/material';

import style from './style.module.css';

const Selector = ({ label, options, selection, setter, disabled }) => {
  // Make sure we have the mandatory parameters
  if (!options) return 'Missing options argument';
  if (!selection) return 'Missing selection argument';
  if (!setter) return 'Missing setter argument';
  // Handle when interactions change
  const changeSelection = event => { setter(event.target.value) };
  // Render the component
  return (
    <CardContent className={style.content}>
      {label && (
        <Typography variant="h5">
          {label}
        </Typography>
      )}
      <Select
        value={selection}
        onChange={changeSelection}
        className={style['horizontal-margined']}
        disabled={disabled}
      >
        {options.map((option, i) => (
          <MenuItem key={i} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </CardContent>
  );
};

export default Selector;
