import React, { memo, useState, useCallback } from 'react';
import screenfull from 'screenfull';

import {
  IconButton,
  Popover,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Select,
  Slider,
} from '@material-ui/core';

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

// Display a small panel to select which representations to show or hide
const Paints = memo(
  ({
    representations, // Array with all representations
    drawingMethods,
    setDrawingMethods,
    coloringMethods,
    setColoringMethods,
    opacities,
    setOpacities,
    defaults, // Original values
    children,
    ...buttonProps
  }) => {
    const [element, setElement] = useState(null);

    return (
      <>
        <IconButton
          {...buttonProps}
          onClick={event => setElement(event.currentTarget)}
        >
          {children}
        </IconButton>
        <Popover
          open={!!element}
          anchorEl={element}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'center',
          }}
          data-popover
          container={screenfull.element || document.body}
          onClose={useCallback(() => setElement(null), [])}
        >
          <Paper className={style['popover-paper']}>
            <Table aria-label="simple table">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell align="right">Drawing method</TableCell>
                  <TableCell align="right">Coloring method</TableCell>
                  <TableCell align="right">Opacity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {representations.map((rep, index) => (
                  <TableRow key={rep.name + index}>
                    <TableCell component="th" scope="row">
                      {rep.name}
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
            </Table>
          </Paper>
        </Popover>
      </>
    );
  },
);

export default Paints;
