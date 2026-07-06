import React from 'react';
import { Link } from 'react-router-dom';
import cn from 'classnames';
import { TableCell, Chip } from '@mui/material';
import AnimatedTableRow from '../animated-table-row';
import LazyImg from '../../components/lazy-img';
import Highlight from '../../components/highlight';
import { NICE_NAMES } from '../../utils/constants';
import style from './style.module.css';
import { Project } from '../../utils/project-manager';

const na = 'Not available';

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

  // In case we retrieve an errored entry
  if (project.error) return (
    <AnimatedTableRow index={index} className={style['error-row']}>
      {/* accession */}
      <TableCell className={style.center}> {project.accession} </TableCell>
      {/* name */}
      <TableCell className={style.center}> {project.error} </TableCell>
      {/* groups */}
      <TableCell className={style.center}> - </TableCell>
      {/* analyses */}
      <TableCell className={style.center}> - </TableCell>
    </AnimatedTableRow>
  );

  // Returns a table with multiple rows
  // The 3 first rows: accession, PDB accession and name are searchable. Search text is highlighted when found
  return (
    <AnimatedTableRow
      index={index}
      className={cn({ [style['not-published']]: !published })}
    >
      {/* accession */}
      <TableCell className={`${style.center} ${style['col-accession']}`}>
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
      <TableCell className={`${style.center} ${style['col-name']}`}>
        <Highlight highlight={highlight}>
          {metadata && metadata.NAME
            ? metadata.NAME
            : pdbInfo && pdbInfo.compound
            ? pdbInfo.compound
            : na}
        </Highlight>
      </TableCell>
      {/* preview */}
      <TableCell className={`${style.center} ${style['col-preview']}`}>
        <LazyImg
          src={previewUrl}
          className={style['preview-img']}
          loading="lazy"
          alt={`Project preview`}
        />
      </TableCell>
      {/* analyses */}
      <TableCell className={`${style.center} ${style['col-analyses']}`}>
        <div className={style['analyses-container']}>
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
        </div>
      </TableCell>
      {/* date */}
    </AnimatedTableRow>
  );
};

Row.displayName = 'Row';
export default Row;