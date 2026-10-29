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

// Styling for the native select dropdown arrow: transparent background and
// the arrow itself painted with the theme's primary color
const selectSx = {
  '& .MuiNativeSelect-icon': {
    color: 'primary.main',
  },
};

// Display a huge panel to select which representations must be shown or hidden
// In addition the user can manage the way these representatios are shown
const RepresentationsManager = memo(
  ({
    components, // Array with all components
    representations, // Array with all representations
    setRepresentations, // Representations setter
  }) => {
    // Replace a representation by a copy with some fields changed
    // Representations are never modified, since they may be shared (e.g. the topology default representations)
    const updateRepresentation = (index, getChanges) =>
      setRepresentations(previousRepresentations => previousRepresentations.map((representation, r) =>
        r === index ? { ...representation, ...getChanges(representation) } : representation));
    return (
      <div className={style.container}>
        <Table
          aria-label="representations table"
          size="small"
          stickyHeader
          className={style.table}
        >
          <TableHead>
            <TableRow>
              <TableCell className={style.headerCell}>Name</TableCell>
              <TableCell className={style.headerCell} align="center">Show</TableCell>
              <TableCell className={style.headerCell}>
                <span className={style.selectionHeader}>
                  Selection
                  <Info tooltip={
                    <>
                      Using{' '}
                      <a href="https://nglviewer.org/ngl/api/manual/selection-language.html"
                        target="_blank"
                        rel="noopener noreferrer">
                        NGL selection language
                      </a>.
                    </>
                  } className={style.info} />
                </span>
              </TableCell>
              <TableCell className={style.headerCell}>Drawing method</TableCell>
              <TableCell className={style.headerCell}>Coloring method</TableCell>
              <TableCell className={style.headerCell}>Opacity</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {representations && representations.map((representation, index) => (
              <TableRow key={representation.reference || index} className={style.row}>
                {/* Name */}
                <TableCell component="th" scope="row" className={style.nameCell}>
                  {representation.name}
                </TableCell>
                {/* Show */}
                <TableCell align="center" className={style.cell}>
                  <IconButton
                    size="small"
                    title="Show/Hide representation"
                    onClick={() =>
                      updateRepresentation(index, previous => ({ show: !previous.show }))
                    }
                    color={'primary'}
                  >
                    <FontAwesomeIcon
                      icon={representation.show ? faEye : faEyeSlash}
                    />
                  </IconButton>
                </TableCell>
                {/* Selection */}
                <TableCell className={style.cell}>
                  <TextField
                    className={style.selectionField}
                    value={representation.custom ? undefined : representation.selection}
                    defaultValue={representation.custom ? representation.selection : undefined}
                    title={representation.selection}
                    variant="outlined"
                    onKeyPress={event => {
                      if (event.key !== 'Enter') return;
                      if (!event.target || !event.target.value) return;
                      const selection = event.target.value;
                      updateRepresentation(index, () => ({ selection }));
                    }}
                    disabled={!representation.custom}
                    size="small"
                    margin="dense"
                  />
                </TableCell>
                {/* Drawing method */}
                <TableCell className={style.cell}>
                  <Select
                    native
                    className={style.select}
                    sx={selectSx}
                    value={representation.type}
                    onChange={({ target: { value } }) => {
                      updateRepresentation(index, () => ({ type: value }));
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
                <TableCell className={style.cell}>
                  <Select
                    native
                    className={style.select}
                    sx={selectSx}
                    value={representation.color}
                    onChange={({ target: { value } }) => {
                      updateRepresentation(index, () => ({ color: value }));
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
                <TableCell className={style.cell}>
                  <div className={style.sliderWrap}>
                    <Slider
                      size="small"
                      value={representation.opacity * 100}
                      onChange={(_, value) => {
                        updateRepresentation(index, () => ({ opacity: value / 100 }));
                      }}
                      className={style['popover-slider']}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableBody>
            <TableRow key={'addCustom'}>
              <TableCell align="center" colSpan={6} className={style.addCell}>
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
      </div>
    );
  },
);

export default RepresentationsManager;
