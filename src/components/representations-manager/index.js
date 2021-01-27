import React, { memo } from 'react';

import {
  Checkbox,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Select,
  Slider,
} from '@material-ui/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';

import style from './style.module.css';

const valueExist = (value, source) => {
  for (const opt of source) {
    if (opt.value === value) return true;
  }
  return false;
};

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
];

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
];

// Display a huge panel to select which representations must be shown or hidden
// In addition the user can manage the way these representatios are shown
const RepresentationsManager = memo(
  ({
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
    defaults, // Original values
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
                <TableCell component="th" scope="row">
                  {rep.name}
                </TableCell>
                <TableCell align="right">
                  {
                    <Checkbox
                      key={rep.name}
                      checked={showRepresentations[index]}
                      onChange={() =>
                        setShowRepresentations(previous => {
                          const newState = [...previous];
                          newState[index] = !newState[index];
                          return newState;
                        })
                      }
                      style={{ color: 'black' }}
                      inputProps={{ 'data-key': rep.name }}
                    />
                  }
                </TableCell>
                <TableCell align="right">
                  {
                    <TextField
                      id="outlined-basic"
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
                  }
                </TableCell>
                <TableCell align="right">
                  {
                    <Select
                      native
                      value={drawingMethods[index]}
                      onChange={({ target: { value } }) => {
                        let changed = drawingMethods;
                        changed[index] = value;
                        setDrawingMethods([...changed]);
                      }}
                    >
                      {!valueExist(
                        defaults.drawingMethods[index],
                        availableDrawingMethods,
                      ) && (
                        <option value={defaults.drawingMethods[index]}>
                          {defaults.drawingMethods[index]}
                        </option>
                      )}
                      {availableDrawingMethods.map((cm, i) => (
                        <option key={i} value={cm.value}>
                          {cm.label}
                        </option>
                      ))}
                    </Select>
                  }
                </TableCell>
                <TableCell align="right">
                  {
                    <Select
                      native
                      value={coloringMethods[index]}
                      onChange={({ target: { value } }) => {
                        let changed = coloringMethods;
                        changed[index] = value;
                        setColoringMethods([...changed]);
                      }}
                    >
                      {!valueExist(
                        defaults.coloringMethods[index],
                        availableColoringMethods,
                      ) && (
                        <option value={defaults.coloringMethods[index]}>
                          {defaults.coloringMethods[index]}
                        </option>
                      )}
                      {availableColoringMethods.map((cm, i) => (
                        <option key={i} value={cm.value}>
                          {cm.label}
                        </option>
                      ))}
                    </Select>
                  }
                </TableCell>
                <TableCell align="right">
                  {
                    <Slider
                      value={opacities[index] * 100}
                      onChange={(_, value) => {
                        let changed = opacities;
                        changed[index] = value / 100;
                        setOpacities([...changed]);
                      }}
                      className={style['popover-slider']}
                    />
                  }
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableBody>
            <TableRow key={'addCustom'}>
              <TableCell align="center" colSpan={6}>
                {
                  <Chip
                    icon={<FontAwesomeIcon icon={faPlusCircle} />}
                    label={'Add representation'}
                    variant="outlined"
                    onClick={() =>
                      setAdditionalRepresentations(previous => {
                        const newRepresentation = {
                          selection: 'None',
                          name: 'Custom',
                        };
                        const current = [newRepresentation, ...previous];
                        return current;
                      })
                    }
                  />
                }
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </>
    );
  },
);

export default RepresentationsManager;
