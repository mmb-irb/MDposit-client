import React, { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
// Hooks
import useAPI from 'src/hooks/use-api'; // API acces
// Components
import { TableRow, TableCell, Chip } from '@mui/material';
import LazyImg from '../../components/lazy-img';
import Highlight from '../../components/highlight';
import Loading from '../../components/loading'; // Displays an animated "loading" circle
// Utils
import reducedMotion from '../../utils/reduced-motion';
import { BASE_PATH_PROJECTS } from '../../utils/constants';
// CSS style
import style from './style.module.css';

// These keyframes are used for an animate()
// An image opacity is iterated between 0 (invisible) and 1 (visible)
const keyframes = { opacity: [0, 1] };

// Same image vertical position is iterated between 0 and 50 pixels (It may have no effect)
// This is only set when user has not activated the reduced motion option from the navigator
if (!reducedMotion()) {
  keyframes.transform = ['translateX(2.5%)', 'translateX(0)'];
}
  
const Row = ({ data, highlight, index }) => {
  // Declare a hook from a type called "useRef"
  const ref = useRef(null);
  // This type of hook is like a "useEffect" but it runs after the layout is calculated and before it is painted
  // useEffect here would re-render the whole page, thus creating "load hesitation" and a delay
  useLayoutEffect(() => {
    if (!(ref.current && ref.current.animate)) return;
    // Animate the rows to move from right to left when they appear
    const animation = ref.current.animate(keyframes, {
      fill: 'both',
      easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      duration: 750,
      // Set a delay which depends on the index to create a cascade effect
      delay: 100 + index * 75,
    });

    return () => animation.cancel();
  }, [index]);

  // Using the options API endpoint, get a summary of values from simulations in this collection
  const query = `query={"metadata.COLLECTIONS":"${data.id}"}`;
  const projection = `projection=metadata.SYSKEYS`;
  const optionsUrl = `${BASE_PATH_PROJECTS}/options?${query}&${projection}`;
  const { loading: optionsLoading, payload: optionsPayload, error: optionsError } = useAPI(optionsUrl);

  // Using the projects API endpoint, get the sum of projects and MDs which belong to this collection
  const projectsUrl = `${BASE_PATH_PROJECTS}?${query}&countMds=true`;
  const { loading: projectsLoading, payload: projectsPayload, error: projectsError } = useAPI(projectsUrl);
  // In case we retrieve an errored entry
  if (data.error) return (
    <TableRow ref={ref} className={style['error-row']}>
      {/* name */}
      <TableCell className={style.center}> {data.name || data.id || data._id} </TableCell>
      {/* system keywords */}
      <TableCell className={style.center}> {data.error || data.headerError} </TableCell>
      {/* preview */}
      <TableCell className={style.center}> - </TableCell>
      {/* size */}
      <TableCell className={style.center}> - </TableCell>
    </TableRow>
  );

  // Returns a table with multiple rows
  // The 3 first rows: accession, PDB accession and name are searchable. Search text is highlighted when found
  return (
    <TableRow ref={ref} >
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
          <Chip key={keyword} className={style.chips} label={keyword} variant={'outlined'} />
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
    </TableRow>
  );
};

Row.displayName = 'Row';
export default Row;