import React, { Suspense } from 'react';

import {
  FormControlLabel,
  Radio,
  RadioGroup,
  Select,
  MenuItem,
  TextField,
  IconButton,
} from '@material-ui/core';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExchangeAlt } from '@fortawesome/free-solid-svg-icons';

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
  selectedOrder,
  setSelectedOrder,
}) => {
  const changeInteraction = event => {
    setSelectedInteraction(event.target.value);
  };

  const changeResidues = event => {
    setSelectedResidues(event.target.value);
  };

  const changeOrder = () => {
    setSelectedOrder(previous => !previous);
  };

  const currentInteraction = interactions[selectedInteraction];

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Select
        value={selectedInteraction}
        onChange={changeInteraction}
        className={style['horizontal-margined']}
      >
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
      {selectedOrder !== undefined && (
        <>
          <TextField
            //margin="dense"
            label="Surfaced interface"
            title="Interface residues to be represented in electorstatic surface mode"
            value={
              selectedOrder
                ? currentInteraction.agent_1
                : currentInteraction.agent_2
            }
          />
          <IconButton
            title="Toggle interface representations"
            onClick={changeOrder}
          >
            <FontAwesomeIcon icon={faExchangeAlt} />
          </IconButton>
          <TextField
            //margin="dense"
            label="Sticked interface"
            title="Interface residues to be represented in balls and sticks mode"
            value={
              selectedOrder
                ? currentInteraction.agent_2
                : currentInteraction.agent_1
            }
          />
        </>
      )}
    </Suspense>
  );
};

export default InteractionSelector;
