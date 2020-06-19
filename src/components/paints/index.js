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
                  <TableRow key={rep.name}>
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
                          <option value={'cartoon'}>Cartoon</option>
                          <option value={'licorice'}>Licorice</option>
                          <option value={'surface'}>Surface</option>
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
                          <option value={'bfactor'}>B factor</option>
                          <option value={'chainid'}>By chain id</option>
                          <option value={'electrostatic'}>Electrostatic</option>
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
