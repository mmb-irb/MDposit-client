import React from 'react';
import {
	TablePagination,
	TableRow,
} from '@mui/material';
import { stringify } from 'qs';

// Define non-changing props used by the table footer
const rowsPerPageOptions = [5, 10, 25, 50];
const backIconButtonProps = { title: 'Previous page' };
const nextIconButtonProps = { title: 'Next page' };

/* Table footer used to change the page to see more results */
const Pagination = ({
	matchCount,
	mdCount,
	search,
	location,
	history,
	queryPayload,
	component = 'div',
	colSpan,
	DEFAULT_LIMIT,
	DEFAULT_PAGE
}) => {
	return (
		<TableRow>
			<TablePagination
				// IMPORTANT: Pagination is controled through the 'history', which may be updated from 'search'
				// Many of the following variables are methods from TablePagination (They are tagged as MTP). https://material-ui.com/api/table-pagination/
				rowsPerPageOptions={rowsPerPageOptions} // (MTP) Optional numbers of rows displayed in each page. It can be modified by the user.
				colSpan={6} // Set the anchor of columns which is taken as a reference for the horizontal position of the footer
				count={matchCount} // (MTP) Total number of rows
				rowsPerPage={+search.limit || DEFAULT_LIMIT} // (MTP) The actual number of rows displayed
				page={(+search.page || DEFAULT_PAGE) - 1} // (MTP) The actual page
				onPageChange={(_, page) => {
					// (MTP) When the page is changed
					history({
						...location, // Load all location variables: hast, pathname, search and state
						// Convert into a single encoded string all parameters listed below
						search: stringify({
							search: search.search,
							query: search.query,
							option: search.option,
							page: page + 1 === DEFAULT_PAGE ? undefined : page + 1,
							limit:
								!search.limit || +search.limit === DEFAULT_LIMIT
									? undefined
									: +search.limit,
							 // Preserve sort state
							sort: search.sort,
							sortField: search.sortField,
							sortDirection: search.sortDirection,
						}),
					});
				}}
				onRowsPerPageChange={({ target: { value } }) => {
					// (MTP) When the rowsPerPage is modified by the user
					history({
						...location, // Load all location variables: hast, pathname, search and state
						// Convert into a single encoded string all parameters listed below
						search: stringify({
							search: search.search,
							query: search.query,
							option: search.option,
							limit: +value === DEFAULT_LIMIT ? undefined : value,
							// Preserve sort state
							sort: search.sort,
							sortField: search.sortField,
							sortDirection: search.sortDirection,
						}),
					});
				}}
				backIconButtonProps={backIconButtonProps} // (MTP) Non-changing propierties of the back page button
				nextIconButtonProps={nextIconButtonProps} // (MTP) Non-changing propierties of the next page button
				labelDisplayedRows={({ from, to, count }) => {
					return `${from}-${to} of ${count} projects (${mdCount} MDs)`;
				}}
			/>
		</TableRow>
	);
};

export default Pagination;