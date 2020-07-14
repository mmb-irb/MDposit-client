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

import { AccessionCtx, ProjectCtx, PdbCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

import {
  complexNumerationParser,
  source2modelResidue,
} from '../../../utils/topology-manager';

import Selector from '../../../components/selector';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

const RmsdPerres = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project chains
  const { metadata, chains } = useContext(ProjectCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);
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
  const [searchResidues, setSearchResidues] = useState('');

  // Table management
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // The graphics to be displayed
  const [displays, setDisplays] = useState(Array(rowsPerPage).fill(true));

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!pdbData.file) return 'Waiting for context...';

  // Remove the first property: 'RMSD_00001'
  if (payload.y['RMSD_00001']) delete payload.y['RMSD_00001'];

  // Parse the selection string into a numeric array
  const curatedSelection = searchResidues ? searchResidues.split(', ') : null;

  // Find the corrsponding key for each selected resiude
  // First get all available keys in order
  const keys = [];
  for (const key of Object.keys(payload.y)) {
    const numeration = complexNumerationParser(key);
    if (!numeration) continue;
    keys[numeration.residueNumber] = key;
  }

  // Now get only the selected keys from the payload
  let selectedPayload = {};
  if (curatedSelection)
    for (const res of curatedSelection) {
      const key = keys[res];
      selectedPayload[key] = payload.y[key];
    }
  else {
    // If there is no selection, get the whole payload
    selectedPayload = payload.y;
  }

  // Now give the selected payload a standarized format for the data table
  const data = {
    Name: [],
    'Mean (Å)': [],
    'Standard deviation (Å)': [],
  };

  for (const key of Object.keys(selectedPayload)) {
    const numeration = complexNumerationParser(key);
    const model = source2modelResidue(
      numeration.chain,
      numeration.residueNumber,
      pdbData.file,
    );
    data['Name'].push(
      model.chain +
        '(' +
        model.chainName +
        '):' +
        model.chainResidue +
        '(' +
        model.residueType +
        ')',
    );
    data['Mean (Å)'].push(selectedPayload[key].average);
    data['Standard deviation (Å)'].push(selectedPayload[key].stddev);
  }

  const rowsNumber = Object.keys(selectedPayload).length;

  // Harvest the finally selected residues
  const selectedResidues = [];

  // Set an object with boolean keys defining which data is displayed (true) or hidden (false)
  let displayedPayload = {};
  const from = page * rowsPerPage;
  const to = (page + 1) * rowsPerPage;
  let count = 0;
  Object.keys(selectedPayload).forEach((key, index) => {
    // If the residue appears in the data table
    if (index >= from && index < to) {
      // If it is marked to be displayed
      if (displays[count]) {
        displayedPayload[key] = true;
        const numeration = complexNumerationParser(key);
        selectedResidues.push(numeration.residueNumber);
      } else displayedPayload[key] = false;
      count += 1;
    } else displayedPayload[key] = false;
  });

  // Handle when user clicks on legend checkboxes
  const handleChange = row => {
    const newDisplays = [...displays];
    newDisplays[row] = !newDisplays[row];
    setDisplays(newDisplays);
  };

  // Set which options will be available in the resiude selector
  const selectorOptions = [{ label: 'All', value: '' }];
  if (metadata.INTERFACE)
    selectorOptions.push({ label: 'Interface', value: metadata.INTERFACE });

  // Set the chains to be represented in the NGL viewer
  const chainsNGL = [];
  for (const chain of chains) {
    chainsNGL.push({
      name: 'Chain ' + chain,
      selection: ':' + chain,
    });
  }

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <Info
          reference={'rmsd-perres-selector'}
          tooltip={
            <>
              This is the residues selector.
              <br />
              <br />
              Use this panel to select which residues are taken in count in the
              data table below and thus in the graph. Some default residue
              groups are provided by the authors (e.g. interface residues
              between two proteins).
            </>
          }
        />
        <CardContent>
          <Selector
            label="Residues selection"
            selection={searchResidues}
            setter={setSearchResidues}
            options={selectorOptions}
            //custom
          />
        </CardContent>
      </Card>
      <Card className={style.margined}>
        <Info
          reference={'rmsd-perres-table'}
          tooltip={
            <>
              This data table shows the selected residues list. First column
              contains residue name, which is composed by the union of the
              residue type abbreviation (e.g. ASN, ASP, CYS...) and the topology
              numeration. Next two columns provide the RMSD mean and standard
              deviation for each residue respectively. Both measures are in
              angstroms.
              <br />
              <br />
              Use this data table to navigate through all selected resiudes and
              set which of them must be displayed in the graph below. To do so,
              click in the first column checkbox of the residue to be
              shown/hidden.
            </>
          }
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
        <Info
          reference={'rmsd-perres-graph'}
          tooltip={
            <>
              This graph represents the RMSd in the for each residue position
              along the trajectory compared to the original position (frame 0).
              Data is displayed (more opaque lines) alongside corresponding mean
              value (light horizontal line) and mean ± 1 standard deviation
              (lighter horizontal bands)
              <br />
              <br />
              The horizontal edge stands for the trajectory time in nanoseconds.
              <br />
              The vertical edge stands for the RMSd in nanometers.
              <br />
              <br />
              The graph is{' '}
              <span style={{ color: 'lightGreen' }}>interactive</span>. Use the
              mouse to move along data by holding the click button and dragging
              left or right. Use the mouse wheel to zoom in a specific region.
              <span style={{ color: 'lightGreen' }}> Click any point </span>
              on the graph to open an interactive window to display the
              strucutre at the corresponding frame with the specified
              highlighted residues.
            </>
          }
        />
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
            show={displayedPayload}
          />
        </CardContent>
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          typeof selected === 'number'
            ? {
                accession: accession,
                requestedFrame: selected,
                representations: chainsNGL,
                selectedResidues: selectedResidues,
              }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelected(previous => {
            if (viewer.requestedFrame === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelected(previous => {
            if (viewer.requestedFrame === previous) return null;
            else return previous;
          })
        }
      />
    </Suspense>
  );
};

export default RmsdPerres;
