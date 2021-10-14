import React, { memo } from 'react';

import {
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Select,
  Slider,
  IconButton,
} from '@material-ui/core';
import {
  faEye,
  faEyeSlash,
  faPlusCircle,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import style from './style.module.css';

const availableDrawingMethods = [
  {
    label: 'Cartoon',
    value: 'cartoon',
  },
  {
    label: 'Licorice',
    value: 'licorice',
  },
  {
    label: 'Ball and stick',
    value: 'ball+stick',
  },
  {
    label: 'Surface',
    value: 'surface',
  },
  {
    label: 'Spacefill',
    value: 'spacefill',
  },
  {
    label: 'Tube',
    value: 'tube',
  },
  {
    label: 'Trace',
    value: 'trace',
  },
  {
    label: 'Backbone',
    value: 'backbone',
  },
];

// Check if a value exists inside the available values
const DrawingMethodExists = value => {
  for (const opt of availableDrawingMethods) {
    if (opt.value === value) return true;
  }
  return false;
};

const availableColoringMethods = [
  {
    label: 'By chain id',
    value: 'chainid',
  },
  {
    label: 'By residue',
    value: 'resname',
  },
  {
    label: 'By element',
    value: 'element',
  },
  {
    label: 'B factor',
    value: 'bfactor',
  },
  {
    label: 'Electrostatic',
    value: 'electrostatic',
  },
  {
    label: 'Secondary structure',
    value: 'sstruc',
  },
  {
    label: 'Uniform',
    value: 'uniform',
  },
];

const availableColors = [
  'red',
  'yellow',
  'blue',
  'green',
  'orange',
  'purple',
  'white',
  'grey',
  'black',
];

// Check if a value exists inside the available values
const coloringExists = value => {
  for (const opt of availableColoringMethods) {
    if (opt.value === value) return true;
  }
  for (const opt of availableColors) {
    if (opt === value) return true;
  }
  return false;
};

// Return a word but with the first letter in upper case
const firstLetterUpper = word => word[0].toUpperCase() + word.slice(1);

// Display a huge panel to select which representations must be shown or hidden
// In addition the user can manage the way these representatios are shown
const RepresentationsManager = memo(
  ({
    components, // Array with all components
    representations, // Array with all representations
    setAdditionalRepresentations,
    showRepresentations,
    setShowRepresentations,
    nglSelections,
    setNglSelections,
    drawingMethods,
    setDrawingMethods,
    coloringMethods,
    setColoringMethods,
    opacities,
    setOpacities,
  }) => {
    return (
      <>
        <Table
          aria-label="simple table"
          size="small"
          padding="checkbox"
          stickyHeader
        >
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="right">Show</TableCell>
              <TableCell align="right">Selection</TableCell>
              <TableCell align="right">Drawing method</TableCell>
              <TableCell align="right">Coloring method</TableCell>
              <TableCell align="right">Opacity</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {representations.map((rep, index) => (
              <TableRow key={rep.name + index + nglSelections[index]}>
                {/* Name */}
                <TableCell component="th" scope="row">
                  {rep.name}
                </TableCell>
                {/* Show */}
                <TableCell align="right">
                  <IconButton
                    title="Show/Hide representation"
                    onClick={() =>
                      setShowRepresentations(previous => {
                        const newState = [...previous];
                        newState[index] = !newState[index];
                        return newState;
                      })
                    }
                    color={'primary'}
                  >
                    <FontAwesomeIcon
                      icon={showRepresentations[index] ? faEye : faEyeSlash}
                    />
                  </IconButton>
                </TableCell>
                {/* Selection */}
                <TableCell align="right">
                  <TextField
                    defaultValue={nglSelections[index]}
                    title={nglSelections[index]}
                    variant="outlined"
                    onKeyPress={event => {
                      if (event.key !== 'Enter') return;
                      setNglSelections(previous => {
                        const newState = [...previous];
                        if (!event.target || !event.target.value)
                          return previous;
                        newState[index] = event.target.value;
                        return newState;
                      });
                    }}
                    disabled={!rep.custom}
                    size="small"
                    margin="dense"
                  />
                </TableCell>
                {/* Drawing method */}
                <TableCell align="right">
                  <Select
                    native
                    value={drawingMethods[index]}
                    onChange={({ target: { value } }) => {
                      let changed = drawingMethods;
                      changed[index] = value;
                      setDrawingMethods([...changed]);
                    }}
                  >
                    {!DrawingMethodExists(drawingMethods[index]) && (
                      <option value={drawingMethods[index]}>
                        {drawingMethods[index]}
                      </option>
                    )}
                    {availableDrawingMethods.map((cm, i) => (
                      <option key={i} value={cm.value}>
                        {cm.label}
                      </option>
                    ))}
                  </Select>
                </TableCell>
                {/* Coloring method */}
                <TableCell align="right">
                  <Select
                    native
                    value={coloringMethods[index]}
                    onChange={({ target: { value } }) => {
                      let changed = coloringMethods;
                      changed[index] = value;
                      setColoringMethods([...changed]);
                    }}
                  >
                    {!coloringExists(coloringMethods[index]) && (
                      <option value={coloringMethods[index]}>
                        {coloringMethods[index]}
                      </option>
                    )}
                    {availableColoringMethods.map((cm, i) => (
                      <option key={i} value={cm.value}>
                        {cm.label}
                      </option>
                    ))}
                    {availableColors.map((color, i) => (
                      <option key={i} value={color}>
                        {firstLetterUpper(color)}
                      </option>
                    ))}
                  </Select>
                </TableCell>
                {/* Opacity */}
                <TableCell align="right">
                  <Slider
                    value={opacities[index] * 100}
                    onChange={(_, value) => {
                      let changed = opacities;
                      changed[index] = value / 100;
                      setOpacities([...changed]);
                    }}
                    className={style['popover-slider']}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableBody>
            <TableRow key={'addCustom'}>
              <TableCell align="center" colSpan={6}>
                <Chip
                  icon={<FontAwesomeIcon icon={faPlusCircle} />}
                  label={'Add representation'}
                  variant="outlined"
                  onClick={() =>
                    setAdditionalRepresentations(previous => {
                      // Use the first components a reference and copy its parameters
                      // This way, the new representation will use the principal component
                      // Otherwise it would may create a new component with no trajectory
                      const principalComponent = components[0];
                      const newRepresentation = {
                        selection: 'None',
                        name: 'Custom',
                        topologyURL: principalComponent.topologyURL,
                        trajectoryURLs: principalComponent.trajectoryURLs,
                        frame: principalComponent.frame,
                      };
                      const current = [newRepresentation, ...previous];
                      return current;
                    })
                  }
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </>
    );
  },
);

export default RepresentationsManager;
