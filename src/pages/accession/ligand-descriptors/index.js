import React, { useContext, useState } from 'react';

import {
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  TableFooter,
  Typography,
} from '@mui/material';

import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import LigandSelector from '../../../components/ligand-selector';
import { ProjectCtx } from '../../../contexts';

import style from './style.module.css';

import { InputAdornment, TextField } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';

// Define the columns for the table: Mordred Data
const columns = [
  { id: 'key', label: 'Mordred Submodules', minWidth: 170 },
  { id: 'value', label: 'Value', minWidth: 100, format: (value) => value.toLocaleString('en-US'), },
];
// Define the default rows per page and the options
const rowsPerPageDefault = 10;
const rowsPerPageOptions = [10, 25, 50, 100, { label: 'All', value: -1 }];

// Define the non-changing props
const inputProps = {
  'aria-label': 'Search projects by text',
  startAdornment: (
    <InputAdornment position="start">
      <FontAwesomeIcon
        icon={faSearch}
        size="2x"
        className={style['searchbar-icon']}
      />
    </InputAdornment>
  ),
  classes: {
    input: style['searchbar-letters'],
  },
};

// Render the ligand descriptors page
const LigandDescriptors = () => {
  // Import the ligandReferences from the ProjectCtx
  const { ligandReferences } = useContext(ProjectCtx);
  // Define the state variables for the table pagination and the selected ligand
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(rowsPerPageDefault);
  const [selectedLigand, setSelectedLigand] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // If we still are loading the ligand references then show a loading spinner
  if (ligandReferences === null) return <Loading />;
  // If there are no ligand references then show a message
  if (ligandReferences.length === 0) return 'There are no ligand references';

  // Get the selected ligand (could be more than one) and the ligand data: mordred and morgan
  const ligand = ligandReferences[selectedLigand];
  const mordredData = ligand.mordred;
  const morgan = ligand.morgan;

  // Create the rows for the table
  const rows = Object.entries(mordredData).map(([key, value]) => (
    <TableRow key={key}>
      <TableCell>{key}</TableCell>
      <TableCell>{value.toFixed(2)}</TableCell>
    </TableRow>
  ));

  // Filter the rows based on the search term
  const filteredRows = rows.filter((row) => {
    // Extract the text content from each child component of the row
    const rowData = Object.values(row.props.children).map(child => child.props.children).join(' ');
    // Check if the extracted text contains the search term (case-insensitive)
    return rowData.toLowerCase().includes(searchTerm.toLowerCase());
  });

// This function is called when the search input value changes
const handleSearch = (event) => {
  // Extract the value of the search input from the event object and assign it to the searchTerm variable
  const searchTerm = event.target.value;
  // This function is responsible for updating the state variable that stores the search term
  setSearchTerm(searchTerm);
  // Call the setPage function and pass 0 as an argument, updating the state variable that stores the current page number
  setPage(0);
};

// This function is called when the page number changes
const handleChangePage = (event, newPage) => {
  // It receives two parameters: an event object and the new page number
  // Update the state variable that stores the current page number to the new page number
  setPage(newPage);
};

// This function is called when the number of rows per page changes.
const handleChangeRowsPerPage = (event) => {
  // Extract the value of the rows per page input from the event object, convert it to an integer using parseInt,
  // and assign it to the rowsPerPage variable.
  setRowsPerPage(parseInt(event.target.value, 10));
  // Call the setPage function and pass 0 as an argument to update the state variable that stores the current page number.
  setPage(0);
};
  return (
    <>
      <Card style={{ width: '100%' }}>
        <CardContent className={style.horizontal}>
          <Typography variant="h6" align="center">Ligand selection:</Typography>
          <LigandSelector
            ligandReferences={ligandReferences}
            selectedLigand={selectedLigand}
            setSelectedLigand={setSelectedLigand}
          />
        </CardContent>
      </Card>
      <Card className={style.tablecard}>
        <CardContent style={{ height: '100%' }}>
        <TextField
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={handleSearch}
              className={style.searchbar}
              InputProps={inputProps}
            />
          <Table stickyHeader size="small" className={style.table}>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    style={{ minWidth: column.minWidth }}
                  >
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={rowsPerPageOptions}
                  colSpan={4}
                  count={filteredRows.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  slotProps={{
                    select: {
                      'aria-label': 'rows per page',
                    },
                    actions: {
                      showFirstButton: true,
                      showLastButton: true,
                    },
                  }}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
      <Card style={{ width: '100%' }}>
        <CardContent style={{ overflowWrap: 'break-word' }}>
          <Typography variant="h6" align="left">Morgan Data:</Typography>
            <div className={style.morganData}>
              {morgan.map((value, index) => (
                <span key={index} className={style.morganValue}>{value}</span>
              ))}
            </div>
        </CardContent>
      </Card>
    </>
  );
};
export default LigandDescriptors;
