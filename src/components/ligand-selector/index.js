import React, { Suspense } from 'react';

import { Select, MenuItem } from '@material-ui/core';

import Loading from '../loading';

//import style from './style.module.css';

// Render a panel which allows to select the desired ligand
// If the user selects a new ligand then the 'setSelectedLigand' is set as its index
// Ligands have the following structure:
// { name: string, label: string, ... }
// The 'label' field will replace the 'name' in the selector labels if exists
const LigandSelector = ({ ligands, selectedLigand, setSelectedLigand }) => {
  const changeLigand = event => {
    setSelectedLigand(event.target.value);
  };

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Select value={selectedLigand} onChange={changeLigand}>
        {ligands.map((ligand, i) => (
          <MenuItem key={i} value={i}>
            {ligand.label || ligand.name}
          </MenuItem>
        ))}
      </Select>
    </Suspense>
  );
};

export default LigandSelector;
