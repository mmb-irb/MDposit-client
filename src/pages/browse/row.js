import React, { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import cn from 'classnames';
import { TableRow, TableCell, Chip } from '@mui/material';
import LazyImg from '../../components/lazy-img';
import Highlight from '../../components/highlight';
import reducedMotion from '../../utils/reduced-motion';
import { NICE_NAMES } from '../../utils/constants';
import style from './style.module.css';
import { Project } from '../../utils/project-manager';

const na = 'Not available';

// These keyframes are used for an animate()
// An image opacity is iterated between 0 (invisible) and 1 (visible)
const keyframes = {
  opacity: [0, 1],
};

// Same image vertical position is iterated between 0 and 50 pixels (It may have no effect)
// This is only set when user has not activated the reduced motion option from the navigator
if (!reducedMotion()) {
  keyframes.transform = ['translateX(2.5%)', 'translateX(0)'];
}
  
const Row = ({ projectData, highlight, index, previewUrl }) => {
  // Parse the project data using the project manager
  const project = new Project(projectData);
  // Harvest data from the project object
  const {
    identifier,
    accession,
    published,
    pdbInfo,
    metadata,
    mdCount,
    directions
  } = project;
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

  // In case we retrieve an errored entry
  if (project.error) return (
    <TableRow ref={ref} className={style['error-row']}>
      {/* accession */}
      <TableCell className={style.center}> {project.accession} </TableCell>
      {/* name */}
      <TableCell className={style.center}> {project.error} </TableCell>
      {/* groups */}
      <TableCell className={style.center}> - </TableCell>
      {/* analyses */}
      <TableCell className={style.center}> - </TableCell>
    </TableRow>
  );

  // Returns a table with multiple rows
  // The 3 first rows: accession, PDB accession and name are searchable. Search text is highlighted when found
  return (
    <TableRow
      ref={ref} // "ref" is a method from TableRow and many other rendered elements
      className={cn({ [style['not-published']]: !published })}
    >
      {/* accession */}
      <TableCell className={style.center}>
        <Link
          to={{
            pathname: `/id/${accession || identifier}/overview`,
            // We pass the selected project data so there is no need to query it again
            state: { projectData: project },
          }}
        >
          <Highlight highlight={highlight}>
            {accession || identifier}
            {!published && <div>(not published)</div>}
          </Highlight>
        </Link>
        {mdCount > 1 && <div className={style.small}>{`${mdCount} MDs`}</div>}
      </TableCell>
      {/* name */}
      <TableCell className={style.center}>
        <Highlight highlight={highlight}>
          {metadata && metadata.NAME
            ? metadata.NAME
            : pdbInfo && pdbInfo.compound
            ? pdbInfo.compound
            : na}
        </Highlight>
      </TableCell>
      {/* preview */}
      <TableCell className={style.center}>
        <LazyImg
          src={previewUrl}
          width="110"
          height="110"
          loading="lazy"
          alt={`Project preview`}
        />
      </TableCell>
      {/* analyses */}
      <TableCell className={style.center}>
        {Object.entries(directions)
          // Display only available directions
          .filter(([direction, available]) => available)
          // For each direction create a clickable button which links to the direction route
          .map(([direction, available]) => (
            <Chip
              key={direction}
              clickable
              className={style.analysis}
              component={Link}
              to={{
                pathname: `/id/${accession || identifier}/${direction}`,
                // We pass the selected project data so there is no need to query it again
                state: { projectData: project },
              }}
              label={NICE_NAMES.get(direction) || direction}
              variant="outlined"
            />
          ))}
      </TableCell>
      {/* date */}
    </TableRow>
  );
};

Row.displayName = 'Row';
export default Row;