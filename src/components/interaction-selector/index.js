import React, { Suspense } from 'react';

import {
  FormControlLabel,
  Radio,
  RadioGroup,
  Select,
  MenuItem,
} from '@material-ui/core';

import Loading from '../loading';

import style from './style.module.css';

const options = [
  { label: 'All residues', value: 'residues' },
  { label: 'Interface residues', value: 'interface' },
];

// Render a panel which allows to select the desired interaction
// When 'residueCustomizable' is true, render also tools to select interaction residues
// Options are 'all' or 'interface' residues
// DANI: La guinda sería un 'custom' dentro del 'residueCustomizable'
// DANI: La idea sería desplegar dos residue selectors, uno para cada interaction agent
const InteractionSelector = ({
  interactions,
  selectedInteraction,
  setSelectedInteraction,
  selectedResidues,
  setSelectedResidues,
}) => {
  const changeInteraction = event => {
    setSelectedInteraction(event.target.value);
  };

  const changeResidues = event => {
    setSelectedResidues(event.target.value);
  };

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Select value={selectedInteraction} onChange={changeInteraction}>
        {interactions.map((interaction, i) => (
          <MenuItem key={i} value={i}>
            {interaction.name}
          </MenuItem>
        ))}
      </Select>
      {selectedResidues && (
        <RadioGroup
          value={selectedResidues}
          onChange={changeResidues}
          className={style.horizontal}
        >
          {options.map((opt, i) => (
            <FormControlLabel
              key={i}
              value={opt.value}
              control={<Radio />}
              label={opt.label}
            />
          ))}
        </RadioGroup>
      )}
    </Suspense>
  );
};

export default InteractionSelector;
