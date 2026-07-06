import React, { useState, useEffect } from 'react';
import {
	TableRow,
	TableCell,
	Select,
	MenuItem,
	IconButton,
	Typography,
	InputBase,
} from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { stringify } from 'qs';
import style from './style.module.css';

const DEFAULT_ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

// Table footer/header used to change the page and the amount of results shown per page
// Reused by every URL-driven, server-paginated table (project browser, collections, ...)
const Pagination = ({
	matchCount,
	// Optional secondary count rendered next to the item count, e.g. the amount of MDs behind a set of projects
	extraCount,
	extraLabel,
	// Label describing what is being counted, e.g. 'projects' or 'references'
	itemLabel = 'results',
	search,
	location,
	history,
	DEFAULT_LIMIT,
	DEFAULT_PAGE,
	rowsPerPageOptions = DEFAULT_ROWS_PER_PAGE_OPTIONS,
	colSpan = 6,
}) => {
	const rowsPerPage = +search.limit || DEFAULT_LIMIT;
	const page = (+search.page || DEFAULT_PAGE) - 1; // 0-indexed
	const totalPages = Math.ceil(matchCount / rowsPerPage) || 1;
	const from = matchCount === 0 ? 0 : page * rowsPerPage + 1;
	const to = Math.min((page + 1) * rowsPerPage, matchCount);

	const [pageInput, setPageInput] = useState(String(page + 1));
	useEffect(() => { setPageInput(String(page + 1)); }, [page]);

	const commitPageInput = () => {
		const n = parseInt(pageInput, 10);
		if (!isNaN(n) && n >= 1 && n <= totalPages) goToPage(n - 1);
		else setPageInput(String(page + 1)); // reset invalid input
	};

	const goToPage = (newPage) => {
		history({
			...location,
			search: stringify({
				search: search.search,
				query: search.query,
				option: search.option,
				page: newPage + 1 === DEFAULT_PAGE ? undefined : newPage + 1,
				limit:
					!search.limit || +search.limit === DEFAULT_LIMIT
						? undefined
						: +search.limit,
				sort: search.sort,
				sortField: search.sortField,
				sortDirection: search.sortDirection,
			}),
		});
	};

	const changeRowsPerPage = (value) => {
		history({
			...location,
			search: stringify({
				search: search.search,
				query: search.query,
				option: search.option,
				limit: +value === DEFAULT_LIMIT ? undefined : value,
				sort: search.sort,
				sortField: search.sortField,
				sortDirection: search.sortDirection,
			}),
		});
	};

	return (
		<TableRow>
			<TableCell colSpan={colSpan} className={style['pagination-cell']}>
				<div className={style['pagination-layout']}>

					{/* Left: rows-per-page control */}
					<div className={style['pagination-left']}>
						<Typography variant="body2" color="text.secondary" noWrap>
							Rows per page:
						</Typography>
						<Select
							value={rowsPerPage}
							onChange={(e) => changeRowsPerPage(e.target.value)}
							size="small"
							variant="outlined"
							className={style['pagination-select']}
						>
							{rowsPerPageOptions.map((opt) => (
								<MenuItem key={opt} value={opt}>{opt}</MenuItem>
							))}
						</Select>
					</div>

					{/* Center: result count */}
					<Typography variant="body2" color="text.secondary" className={style['pagination-center']}>
						<strong style={{ color: 'inherit', fontWeight: 600 }}>{from}–{to}</strong>
						{' of '}
						<strong style={{ color: 'inherit', fontWeight: 600 }}>{matchCount.toLocaleString()}</strong>
						{` ${itemLabel}`}
						{extraCount != null && (
							<>
								{' ('}
								<strong style={{ color: 'inherit', fontWeight: 600 }}>{extraCount.toLocaleString()}</strong>
								{` ${extraLabel})`}
							</>
						)}
					</Typography>

					{/* Right: page navigation */}
					<div className={style['pagination-right']}>
						<IconButton
							size="small"
							onClick={() => goToPage(page - 1)}
							disabled={page === 0}
							title="Previous page"
						>
							<NavigateBeforeIcon fontSize="small" />
						</IconButton>
						<InputBase
							value={pageInput}
							onChange={(e) => setPageInput(e.target.value)}
							onBlur={commitPageInput}
							onKeyDown={(e) => { if (e.key === 'Enter') commitPageInput(); }}
							inputProps={{ 'aria-label': 'page number' }}
							className={style['pagination-page-input']}
							style={{ width: `${String(totalPages).length + 1.5}ch` }}
						/>
						<Typography variant="body2" color="text.secondary">
							/ {totalPages}
						</Typography>
						<IconButton
							size="small"
							onClick={() => goToPage(page + 1)}
							disabled={page >= totalPages - 1}
							title="Next page"
						>
							<NavigateNextIcon fontSize="small" />
						</IconButton>
					</div>

				</div>
			</TableCell>
		</TableRow>
	);
};

export default Pagination;
