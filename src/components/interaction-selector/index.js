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

const residueOptions = [
  { label: 'All residues', value: 'residues' },
  { label: 'Interface residues', value: 'interface' },
];

// Render a panel which allows to select the desired interaction
// If the user selects a new interaction then the 'setSelectedInteraction' is set as its index
// Interactions have the following structure:
// { name: string, label: string, ... }
// The 'label' field will replace the 'name' in the selector labels if exists
// When 'selectedResidues' is passed, render also tools to select interaction residues
// Residue options are 'all' or 'interface' residues
// DANI: La guinda sería un 'custom' en las opciones de residuos
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
            {interaction.label || interaction.name}
          </MenuItem>
        ))}
      </Select>
      {selectedResidues && (
        <RadioGroup
          value={selectedResidues}
          onChange={changeResidues}
          className={style.horizontal}
        >
          {residueOptions.map((opt, i) => (
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
