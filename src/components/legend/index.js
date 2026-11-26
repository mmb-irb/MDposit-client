import React from 'react';

import { FormControlLabel, Checkbox } from '@mui/material';

import style from './style.module.css';
import ink from '../../utils/ink';

// Expected input format is entires =
//  [
//    {
//      name: 'entry name',
//      color: 'black',
//      check: true,
//    }
//  ]
const Legend = ({ entries, onChange, onMouseOver, onMouseOut }) => {
  return (
    <div className={style['graph-legend']}>
      {entries.map(({ name, color, check }) => (
        <FormControlLabel
          data-key={name}
          key={name}
          onChange={p => onChange(p.target.dataset.key)}
          onMouseOver={onMouseOver}
          onMouseOut={onMouseOut}
          control={
            <Checkbox
              checked={check}
              style={{ color: ink(color) }}
              inputProps={{ 'data-key': name }}
            />
          }
          label={name}
        />
      ))}
    </div>
  );
};

export default Legend;
