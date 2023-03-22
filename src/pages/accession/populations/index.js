import React, { useContext, useState, useRef, useMemo } from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';

import Card from '../../../components/animated-card';
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';

import style from './style.module.css';

import { ProjectCtx, PdbCtx } from '../../../contexts';

import Loading from '../../../components/loading';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

// Set the meaningless populations cutoff
const populationsCutoff = 0.001;

// Set a function to calculate the average value from a values array
const roundedPercent = value => {
  const percent = value * 100;
  const rounded = Math.round(percent * 100) / 100;
  const label = rounded.toString().padEnd(4, '0');
  return label;
};

const Populations = () => {
  // Track if the NGL viewer
  // The status isNglVisible is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the current project metadata
  const { metadata, populations } = useContext(ProjectCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);

  // Set a ref to the ngl which allows access to the ngl viewer exposed methods
  const viewerRef = useRef(null);

  // Set when one point in the graph is selected
  const [selectedFrame, setSelectedFrame] = useState(0);

  // Send a request to the API with the url of the rgyr analysis
  const { loading, payload, error } = populations;

  // Set an array of objects, where each object includes the population value and the frame it belongs to
  // Populations are sorted so the biggest populations are first and there is a cutoff to exclude meaningless populations
  const sortedPopulations = useMemo(() => {
    if (!payload) return;
    const formatedPopulations = [];
    payload.forEach((population, i) => {
      if (population < populationsCutoff) return;
      formatedPopulations.push({
        pop: population,
        frame: i,
      });
    });
    formatedPopulations.sort((a, b) => {
      return a.pop < b.pop ? 1 : a.pop > b.pop ? -1 : 0;
    });
    return formatedPopulations;
  }, [payload]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!metadata || !pdbData.file) return <Loading />;

  return (
    <>
      <Card className={style.tablecard}>
        <div className={style.paper}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell key={0}>{'Population (%)'}</TableCell>
                <TableCell key={1}>{'Frame'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedPopulations.map((population, i) => {
                const frame = population.frame;
                return (
                  <TableRow
                    key={i}
                    // Hover only when it is not already selected
                    hover={frame !== selectedFrame}
                    className={
                      frame === selectedFrame ? style.selectedrow : style.row
                    }
                    onClick={() => setSelectedFrame(frame)}
                  >
                    <TableCell key={0}>
                      {roundedPercent(population.pop)}
                    </TableCell>
                    <TableCell key={1}>{frame}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
      <Card className={style.nglcard} ref={nglRef}>
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <NGLViewerWithControls
            className={style.container}
            requestedFrame={selectedFrame}
            preventTrajectory
            ref={viewerRef}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
    </>
  );
};

export default Populations;
