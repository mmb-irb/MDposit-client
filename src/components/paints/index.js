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

// Display a small panel to select which chains to display or hide
const Paints = memo(({ // Array with all chain letters ("A","B","C"...)
  // Array with all chain letters ("A","B","C"...)
  chains, drawingMethods, setDrawingMethods, coloringMethods, setColoringMethods, opacities, setOpacities, children, ...buttonProps }) => {
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
                <TableCell>Chain name</TableCell>
                <TableCell align="right">Drawing method</TableCell>
                <TableCell align="right">Coloring method</TableCell>
                <TableCell align="right">Opacity</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {chains.map(chain => (
                <TableRow key={chain.name}>
                  <TableCell component="th" scope="row">
                    {chain.name}
                  </TableCell>
                  <TableCell align="right">
                    {
                      <Select
                        native
                        value={
                          drawingMethods[chains.findIndex(c => c === chain)]
                        }
                        onChange={({ target: { value } }) => {
                          let changed = drawingMethods;
                          changed[chains.findIndex(c => c === chain)] = value;
                          setDrawingMethods(changed);
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
                        value={
                          coloringMethods[chains.findIndex(c => c === chain)]
                        }
                        onChange={({ target: { value } }) => {
                          let changed = coloringMethods;
                          changed[chains.findIndex(c => c === chain)] = value;
                          setColoringMethods(changed);
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
                        value={
                          opacities[chains.findIndex(c => c === chain)] * 100
                        }
                        onChange={(_, value) => {
                          let changed = opacities;
                          changed[chains.findIndex(c => c === chain)] =
                            value / 100;
                          setOpacities(changed);
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
});

export default Paints;
