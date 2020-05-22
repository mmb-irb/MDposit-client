import React, { lazy, Suspense, useState, useContext } from 'react';

import {
  CardContent,
  Checkbox,
  FormControlLabel,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableFooter,
  TablePagination,
  TextField,
  Typography,
} from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx } from '../../../contexts';
import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';
import { range } from 'lodash-es';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

const InterfaceAnalysis = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project chains
  const { chains } = useContext(ProjectCtx);
  // Set the graph analysis propierties
  const analysis = 'rmsd-perres';
  const defaultPrecision = 1;
  const xLabel = 'Time (ns)';
  const xScaleFactor = 0.001;
  const yLabel = 'RMSd (nm)';
  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/${analysis}/`,
  );

  // Set when one point in the graph is selected
  const [selected, setSelected] = useState(null);

  // Set when which resiudes are we meant to find
  const [searchResidues, setSearchResidues] = useState(
    '1-30,60-65,303-315,330-339,365-375,669,683,700-722,739-745,750-771',
  );

  // Table management
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  // Get the interface residues in a standarized fromat: an array with each resiude 1 by 1
  //const selection = '1-30,60-65,303-315,330-339,365-375,669,683,700-722,739-745,750-771'.split(
  //console.log(searchResidues);
  const selection = searchResidues.split(',');
  const ranged = /^([0-9]*)-([0-9]*)$/;
  const curatedSelection = [];
  for (const res of selection) {
    if (res.match(ranged)) {
      const matches = ranged.exec(res);
      const resiudes = range(+matches[1], +matches[2] + 1);
      curatedSelection.push(...resiudes);
    } else curatedSelection.push(+res);
  }

  // Find the corrsponding key for each selected resiude
  // First get all available keys in order
  const keyNumber = /^[A-Z]*:([0-9]*)$/;
  const keys = [];
  for (const key of Object.keys(payload.y)) {
    //console.log(key);
    const result = keyNumber.exec(key);
    if (!result) continue;
    keys[result[1]] = key;
  }

  // Now get only the selected keys from the payload
  let selectedPayload = {};
  for (const res of curatedSelection) {
    const key = keys[res];
    selectedPayload[key] = payload.y[key];
  }

  // Now give the selected payload a standarized format for the data table
  const data = {
    Name: [],
    'Mean (nm)': [],
    'Standard deviation (nm)': [],
  };

  for (const key of Object.keys(selectedPayload)) {
    data['Name'].push(key);
    data['Mean (nm)'].push(selectedPayload[key].average);
    data['Standard deviation (nm)'].push(selectedPayload[key].stddev);
  }

  const rowsNumber = Object.keys(selectedPayload).length;

  // Check if there are selected
  const showDND = !!(
    (typeof selected === 'number' && Number.isFinite(selected)) ||
    (selected && selected.size)
  );

  // Set the chains to be represented in the NGL viewer
  const chainsNGL = [];
  for (const c in chains) {
    // The last chain is represented as licorice
    if (+c === +(chains.length - 1)) {
      chainsNGL.push({
        name: 'Chain ' + chains[c],
        selection: ':' + chains[c],
        defaultDrawingMethod: 'licorice',
      });
    } else {
      chainsNGL.push({
        name: 'Chain ' + chains[c],
        selection: ':' + chains[c],
        defaultDrawingMethod: 'surface',
        defaultColoringMethod: 'electrostatic',
      });
    }
  }

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.margined}>
        <CardContent>
          {/* Render the table with all the statistics */}
          <Typography variant="h6">Residues selection</Typography>
          <TextField
            id="outlined-basic"
            value={searchResidues}
            variant="outlined"
            onChange={event => setSearchResidues(event.target.value)}
            className={style.widest}
          />
          <Typography variant="h6" className={style.margined}>
            Data table
          </Typography>
          <Table>
            <TableHead>
              <TableRow>
                {Object.keys(data).map(column => (
                  <TableCell key={column}>{column}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {[...Array(rowsNumber).keys()]
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map(row => (
                  <TableRow key={row}>
                    {Object.entries(data).map(column => (
                      <TableCell key={column[0]}>
                        {// Data is returned as plain text as default
                        // If u want some specific column to behave different set it here
                        column[0] === 'Name' ? (
                          <FormControlLabel
                            //onChange={handleChange}
                            //onMouseOver={handleMouseOver}
                            //onMouseOut={handleMouseOut}
                            control={
                              <Checkbox
                              //checked={lab[key]}
                              //style={{ color: COLORS.get(key) || '#000000' }}
                              //inputProps={{ 'data-key': key }}
                              />
                            }
                            label={column[1][row]}
                          />
                        ) : (
                          // Return the plain text
                          column[1][row]
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25]}
                  colSpan={3}
                  count={rowsNumber}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onChangePage={(event, newPage) => setPage(newPage)}
                  onChangeRowsPerPage={event => {
                    setRowsPerPage(parseInt(event.target.value, 10));
                    setPage(0);
                  }}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
      <Card className={style.margined}>
        <CardContent>
          <Typography variant="h6" />
          <Graph
            y={selectedPayload}
            start={payload.start}
            step={payload.step}
            defaultPrecision={defaultPrecision}
            xLabel={xLabel}
            xScaleFactor={xScaleFactor}
            yLabel={yLabel}
            onSelect={setSelected}
            selected={selected}
            mean={false}
            standardDeviation={false}
            startKeys={2}
          />
        </CardContent>
      </Card>
      {showDND && (
        <NGLViewerSpawner
          accession={accession}
          analysis={'rmsd'}
          selected={selected}
          chains={chainsNGL}
        />
      )}
    </Suspense>
  );
};

export default InterfaceAnalysis;
