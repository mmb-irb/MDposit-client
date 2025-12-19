import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Paper,
} from '@mui/material';

const LigandTable = ({ ligandReference }) => {
  if (!ligandReference) return null;
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const mordredData = ligandReference.mordred || {};
  const rows = Object.entries(mordredData || {}).map(([key, value]) => ({
    key,
    value: typeof value === 'number' ? value.toFixed(2) : String(value),
  }));
  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows =
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - rows.length) : 0;

  const filteredRows = rows.filter(
    ({key,value}) =>
      key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      value.toString().includes(searchTerm)
  );

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Paper 
      sx={{ 
        width: "auto", 
        maxWidth: "400px", 
        padding: "10px", 
        overflow: "hidden", 
        boxShadow: "none",
        margin: "auto",
        marginTop: "0px",
        marginBottom: "10px",
        display:"table",
        borderCollapse: "collapse"
      }}
    >
      <TextField
        label="Search..."
        variant="outlined"
        fullWidth
        margin="dense"
        size="small"
        value={searchTerm}
        onChange={handleSearch}
      />
      <TableContainer>
        <Table size="small"> {/* Reduce el tamaño de las filas */}
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold", padding: "5px", textAlign: "center" }}>Descriptor</TableCell>
              <TableCell sx={{ fontWeight: "bold", padding: "5px", textAlign: "center" }}>Valor</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.length > 0 ? filteredRows
              .slice(page * rowsPerPage, (page + 1) * rowsPerPage)
              .map(({key,value}) => (
                <TableRow key={key} sx={{ "&:last-child td, &:last-child th": { border: 0 } }} >
                  <TableCell component="th" sx={{ padding: "5px", textAlign: "center" }}>{key}</TableCell>
                  <TableCell component="th" sx={{ padding: "5px", textAlign: "center" }}>{value}</TableCell>
                </TableRow>
              ))
            : null}
            {emptyRows > 0 && (
              <TableRow style={{ height: 33 * emptyRows }}>
                <TableCell colSpan={2} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
        component="div"
        colSpan={3}
        count={filteredRows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        sx={{ fontSize: "12px" }}
        display="flex"
        //justifyContent="center"
        //alignItems="flex-start"
        margin="auto"
      />
    </Paper>
  );
};

export default LigandTable;