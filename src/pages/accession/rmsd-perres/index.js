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
  Typography,
} from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Loading from '../../../components/loading';
import Info from '../../../components/info';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx } from '../../../contexts';
import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

import residueSelectionParser from '../../../utils/residue-selection-parser';

import Selector from '../../../components/selector';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

const RmsdPerres = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project chains
  const { metadata, chains } = useContext(ProjectCtx);
  // Set the graph analysis propierties
  const analysis = 'rmsd-perres';
  const defaultPrecision = 1;
  const xLabel = 'Time (ns)';
  const xScaleFactor = 0.001;
  const yLabel = 'RMSd (Å)';

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/${analysis}/`,
  );

  // Set when one point in the graph is selected
  const [selected, setSelected] = useState(null);

  // Set when which resiudes are we meant to find
  const [searchResidues, setSearchResidues] = useState(metadata.INTERFACE);

  // Table management
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // The graphics to be displayed
  const [displays, setDisplays] = useState(Array(rowsPerPage).fill(true));

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  // Parse the selection string into a numeric array
  const curatedSelection = residueSelectionParser(searchResidues);

  // Find the corrsponding key for each selected resiude
  // First get all available keys in order
  const keyNumber = /^[A-Z]*:([0-9]*)$/;
  const keys = [];
  for (const key of Object.keys(payload.y)) {
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
    'Mean (Å)': [],
    'Standard deviation (Å)': [],
  };

  for (const key of Object.keys(selectedPayload)) {
    data['Name'].push(key);
    data['Mean (Å)'].push(selectedPayload[key].average);
    data['Standard deviation (Å)'].push(selectedPayload[key].stddev);
  }

  const rowsNumber = Object.keys(selectedPayload).length;

  // Set an object with boolean keys defining which data is displayed (true) or hidden (false)
  let displayedPayload = {};
  const from = page * rowsPerPage;
  const to = (page + 1) * rowsPerPage;
  let count = 0;
  Object.keys(selectedPayload).forEach((key, index) => {
    // If the residue appears in the data table
    if (index >= from && index < to) {
      // If it is marked to be displayed
      if (displays[count]) displayedPayload[key] = true;
      else displayedPayload[key] = false;
      count += 1;
    } else displayedPayload[key] = false;
  });

  // Check if there are selected
  const showDND = !!(
    (typeof selected === 'number' && Number.isFinite(selected)) ||
    (selected && selected.size)
  );

  // Handle when user clicks on legend checkboxes
  const handleChange = row => {
    const newDisplays = [...displays];
    newDisplays[row] = !newDisplays[row];
    setDisplays(newDisplays);
  };

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
      <Selector
        label="Residues selection"
        selection={searchResidues}
        setter={setSearchResidues}
        options={[
          { label: 'All', value: '' },
          { label: 'Interface', value: metadata.INTERFACE },
        ]}
        //custom
      />
      <Card className={style.margined}>
        <Info
          reference={'rmsd-perres'}
          tooltip={`This data table shows the selected residues list. First column contains residue name, which is
            composed by the union of the residue type abbreviation (e.g. ASN, ASP, CYS...) and the topology
            numeration. Next two columns provide the RMSD mean and standard deviation for each residue
            respectively. Both measures are in Angstroms.
            Use this data table to navigate trough all selected resiudes and set which of them must be 
            displayed in the graph below. To do so, click in the first column checkbox of the residue to be
            shown/hidden.`}
        />
        <CardContent>
          {/* Render the table with all the statistics */}
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
                .map((row, index) => (
                  <TableRow key={row}>
                    {Object.entries(data).map(column => (
                      <TableCell key={column[0]}>
                        {// Data is returned as plain text as default
                        // If u want some specific column to behave different set it here
                        column[0] === 'Name' ? (
                          <FormControlLabel
                            key={row}
                            onChange={() => handleChange(index)}
                            //onMouseOver={handleMouseOver}
                            //onMouseOut={handleMouseOut}
                            control={
                              <Checkbox
                                checked={displays[index]}
                                //style={{ color: COLORS.get(key) || '#000000' }}
                                //inputProps={{ 'data-key': key }}
                              />
                            }
                            label={column[1][row]}
                          />
                        ) : (
                          // Return the plain text
                          Math.round(column[1][row] * 10000) / 10000
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
                  onChangePage={(event, newPage) => {
                    setDisplays(Array(rowsPerPage).fill(true));
                    setPage(newPage);
                  }}
                  onChangeRowsPerPage={event => {
                    const newValue = event.target.value;
                    setRowsPerPage(parseInt(newValue, 10));
                    setDisplays(Array(newValue).fill(true));
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
            lab={displayedPayload}
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

export default RmsdPerres;
