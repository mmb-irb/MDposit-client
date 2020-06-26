import React, { Suspense, useState } from 'react';

import {
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@material-ui/core';

import Loading from '../loading';

import style from './style.module.css';

const Selector = ({ label, selection, setter, options, custom = false }) => {
  // The internal selection
  const [internal, setInternal] = useState(selection);

  // When an option button is pressed
  const handleChange = event => {
    const value = event.target.value;
    setInternal(value);
    if (value !== 'custom') setter(value);
  };

  // Render
  return (
    <Suspense fallback={<Loading />}>
      {label && (
        <Typography variant="h5" className={style.margined}>
          {label}
        </Typography>
      )}
      {options && (
        <RadioGroup value={internal} onChange={handleChange}>
          {options.map((opt, i) => (
            <FormControlLabel
              key={i}
              value={opt.value}
              control={<Radio />}
              label={opt.label}
            />
          ))}
          {custom && (
            //<FormControlLabel value={'custom'} control={<Radio />} label={'Custom selection'} />
            <FormControlLabel
              value={'custom'}
              disabled
              control={<Radio />}
              label={'Custom selection (Not available)'}
            />
          )}
        </RadioGroup>
      )}
      {custom && (
        <TextField
          id="outlined-basic"
          value={selection}
          variant="outlined"
          onChange={event => setter(event.target.value)}
          className={style.widest}
          disabled={internal !== 'custom'}
        />
      )}
    </Suspense>
  );
};

export default Selector;
