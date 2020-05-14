import React from 'react';
//import { format } from 'd3';

import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@material-ui/core';

//-import { NICE_NAMES } from '../../utils/constants';

//const formatter = format('.4f');

// Input data expected format:
/*
{
  nameColumn1: [rowValues], IMPORTANT: All 'rows' arrays must have the same length
  NameColumn2: [...]
}
*/
// Render the data table
const DataTable = ({ data }) => {
  const rowsNumber = Object.entries(data)[0][1].length;
  return (
    <Table>
      <TableHead>
        <TableRow>
          {Object.keys(data).map(column => (
            <TableCell key={column}>{column}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {[...Array(rowsNumber).keys()].map(row => (
          <TableRow key={row}>
            {Object.entries(data).map(column => (
              <TableCell key={column[0]}>{column[1][row]}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default DataTable;
