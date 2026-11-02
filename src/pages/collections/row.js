import React from 'react';
import { Link } from 'react-router';
// Hooks
import useAPI from 'src/hooks/use-api'; // API acces
// Components
import { TableCell, Chip } from '@mui/material';
import AnimatedTableRow from '../../components/animated-table-row';
import LazyImg from '../../components/lazy-img';
import Highlight from '../../components/highlight';
import Loading from '../../components/loading'; // Displays an animated "loading" circle
// Utils
import { BASE_PATH_PROJECTS } from '../../utils/constants';
import { formatOptionLabel } from '../../utils/auxiliar-functions';
import { buildFilter, buildReturn, stringifyQuery } from '../../utils/filters';
// CSS style
import style from './style.module.css';

const Row = ({ data, highlight, index }) => {
  // Using the options API endpoint, get a summary of values from simulations in this collection
  const filter = stringifyQuery({ filter: buildFilter('metadata.COLLECTIONS', '==', data.id) });
  const optionsUrl = `${BASE_PATH_PROJECTS}/options?${filter}&${buildReturn(['metadata.SYSKEYS'])}`;
  const { loading: optionsLoading, payload: optionsPayload, error: optionsError } = useAPI(optionsUrl);

  // Using the projects API endpoint, get the sum of projects and MDs which belong to this collection
  const projectsUrl = `${BASE_PATH_PROJECTS}?${filter}&countMds=true`;
  const { loading: projectsLoading, payload: projectsPayload, error: projectsError } = useAPI(projectsUrl);
  // In case we retrieve an errored entry
  if (data.error) return (
    <AnimatedTableRow index={index} className={style['error-row']}>
      {/* name */}
      <TableCell className={style.center}> {data.name || data.id || data._id} </TableCell>
      {/* system keywords */}
      <TableCell className={style.center}> {data.error || data.headerError} </TableCell>
      {/* preview */}
      <TableCell className={style.center}> - </TableCell>
      {/* size */}
      <TableCell className={style.center}> - </TableCell>
    </AnimatedTableRow>
  );

  // Returns a table with multiple rows
  // The 3 first rows: accession, PDB accession and name are searchable. Search text is highlighted when found
  return (
    <AnimatedTableRow index={index}>
      {/* name */}
      <TableCell className={`${style.center} ${style['col-accession']}`}>
        <Link to={{ pathname: `/collection/${data.id}` }} >
          <Highlight highlight={highlight}>
            {data.name}
          </Highlight>
        </Link>
      </TableCell>
      {/* summary */}
      <TableCell className={style.center}>
        {data.summary}
      </TableCell>
      {/* system keywords */}
      <TableCell className={style.center}>
        {optionsLoading && <Loading />}
        {optionsError && optionsError.toString()}
        {optionsPayload && Object.keys(optionsPayload["metadata.SYSKEYS"]).map(keyword => 
          <Chip key={keyword} className={style.chips} label={formatOptionLabel(keyword)} variant={'outlined'} />
        )}
      </TableCell>
      {/* preview */}
      <TableCell className={`${style.center} ${style['col-preview']}`}>
        <LazyImg
          src={data.image}
          className={style['preview-img']}
          loading="lazy"
          alt={`Collection logo`}
        />
      </TableCell>
      {/* size */}
      <TableCell className={style.center}>
        {projectsLoading && <Loading />}
        {projectsError && projectsError.toString()}
        {projectsPayload && <>
          <div className={style.rowtext}>{`${projectsPayload.filteredCount} projects`}</div>
          <div className={style.rowtext}>{`(${projectsPayload.totalMdsCount} MDs)`}</div>
        </>}
      </TableCell>
    </AnimatedTableRow>
  );
};

Row.displayName = 'Row';
export default Row;