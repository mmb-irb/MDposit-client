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
} from '@mui/material';
import {
  faEye,
  faEyeSlash,
  faPlusCircle,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Info from '../../info';
import style from './style.module.css';
import {
  NGL_DRAWING_METHODS,
  NGL_COLORING_METHODS,
  NGL_COLORS
} from '../constants';

// Check if a value exists inside the available values
const DrawingMethodExists = value => {
  for (const opt of NGL_DRAWING_METHODS) {
    if (opt.value === value) return true;
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
    setRepresentations, // Representations setter
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
              <TableCell style={{ whiteSpace: 'nowrap' }} align="right">
                Selection <Info     tooltip={
                <>
                  Using{' '}
                  <a href="https://nglviewer.org/ngl/api/manual/selection-language.html" 
                    target="_blank" 
                    rel="noopener noreferrer">
                    NGL selection language
                  </a>.
                </>
              }  className={style.info} />
              </TableCell>
              <TableCell align="right">Drawing method</TableCell>
              <TableCell align="right">Coloring method</TableCell>
              <TableCell align="right">Opacity</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {representations && representations.map((representation, index) => (
              <TableRow key={representation.reference || index}>
                {/* Name */}
                <TableCell component="th" scope="row">
                  {representation.name}
                </TableCell>
                {/* Show */}
                <TableCell align="right">
                  <IconButton
                    title="Show/Hide representation"
                    onClick={() =>
                      setRepresentations(previousRepresentations => {
                        previousRepresentations[index].show = !previousRepresentations[index].show;
                        return [...previousRepresentations];
                      })
                    }
                    color={'primary'}
                  >
                    <FontAwesomeIcon
                      icon={representation.show ? faEye : faEyeSlash}
                    />
                  </IconButton>
                </TableCell>
                {/* Selection */}
                <TableCell align="right">
                  <TextField
                    defaultValue={representation.selection}
                    title={representation.selection}
                    variant="outlined"
                    onKeyPress={event => {
                      if (event.key !== 'Enter') return;
                      setRepresentations(previousRepresentations => {
                        if (!event.target || !event.target.value) return previousRepresentations;
                        previousRepresentations[index].selection = event.target.value;
                        return [...previousRepresentations];
                      });
                    }}
                    disabled={!representation.custom}
                    size="small"
                    margin="dense"
                  />
                </TableCell>
                {/* Drawing method */}
                <TableCell align="right">
                  <Select
                    native
                    value={representation.type}
                    onChange={({ target: { value } }) => {
                      setRepresentations(previousRepresentations => {
                        previousRepresentations[index].type = value;
                        return [...previousRepresentations];
                      })
                    }}
                  >
                    {!DrawingMethodExists(representation.type) && (
                      <option value={representation.type}>
                        {representation.type}
                      </option>
                    )}
                    {NGL_DRAWING_METHODS.map((cm, i) => (
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
                    value={representation.color}
                    onChange={({ target: { value } }) => {
                      setRepresentations(previousRepresentations => {
                        previousRepresentations[index].color = value;
                        return [...previousRepresentations];
                      })
                    }}
                  >
                    {representation.customScheme === 'distorsion' ? (
                      <option value={representation.color}>{'Distorsion'}</option>
                    ) : representation.customScheme ? (
                      <option value={'custom'}>{'Custom'}</option>
                    ) : null}
                    
                    {NGL_COLORING_METHODS.map((cm, i) => (
                      <option key={i} value={cm.value}>
                        {cm.label}
                      </option>
                    ))}
                    {NGL_COLORS.map((color, i) => (
                      <option key={i} value={color}>
                        {firstLetterUpper(color)}
                      </option>
                    ))}
                  </Select>
                </TableCell>
                {/* Opacity */}
                <TableCell align="right">
                  <Slider
                    value={representation.opacity * 100}
                    onChange={(_, value) => {
                      setRepresentations(previousRepresentations => {
                        previousRepresentations[index].opacity = value / 100;
                        return [...previousRepresentations];
                      })
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
                  sx={{ margin: '0.5em' }}
                  onClick={() =>
                    setRepresentations(previousRepresentations => {
                      // Set the default values for the custom representation
                      const newRepresentation = {
                        name: 'Custom', show: true,
                        selection: 'None', type: 'licorice',
                        color: 'chainid', opacity: 1,
                        // Link the representation to the first (main) component
                        component: components[0] && components[0].name,
                        // Add the custom flag so this representation is treated differently
                        custom: true,
                      };
                      const newRepresentations = [...previousRepresentations, newRepresentation];
                      return newRepresentations;
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
