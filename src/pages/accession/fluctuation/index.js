import React, { lazy, Suspense, useState, useContext, useMemo } from 'react';

import {
  CardContent,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

const Graph2 = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph2'),
);

const FluctuationAnalysis = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/fluctuation/`,
  );

  // Fluctuation analysis comes in nanometers (nm) and we want it in Ångstroms
  useMemo(() => {
    if (!payload) return;
    const rmsf = payload.y['rmsf'];
    rmsf.data = rmsf.data.map(v => v * 10);
    rmsf.average = rmsf.average * 10;
    rmsf.stddev = rmsf.stddev * 10;
  }, [payload]);

  // React hooks
  // Set when the mouse is over the graph
  const [hoveredAtom, setHoveredAtom] = useState(null);
  // Set when one point in the graph (which stands for an atom) is selected
  const [selectedAtoms, setSelectedAtoms] = useState(new Set());

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  const cents = num => Math.round(num * 100) / 100;

  // Handle when we get the atom index after clicking in the graph
  const handleAtomsSelection = atomIndex => {
    setSelectedAtoms(previous => {
      const newSet = new Set(previous);
      newSet[newSet.has(atomIndex) ? 'delete' : 'add'](atomIndex);
      return newSet;
    });
  };

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>name</TableCell>
                <TableCell>mean (Å)</TableCell>
                <TableCell>standard deviation (Å)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>{'Fluctuation'}</TableCell>
                <TableCell>{cents(payload.y.rmsf.average)}</TableCell>
                <TableCell>{cents(payload.y.rmsf.stddev)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className={style.card}>
        <CardContent>
          <Typography variant="h6" />
          <Graph2
            yData={payload.y}
            step={payload.step}
            xAxisLabel={'Atom'}
            xUnit={'atom'}
            yAxisLabel={'Fluctuation (Å)'}
            type={'dash'}
            onHover={setHoveredAtom}
            onSelect={handleAtomsSelection}
            selected={selectedAtoms}
            mean={true}
            standardDeviation={true}
          />
        </CardContent>
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          selectedAtoms && selectedAtoms.size
            ? {
                accession: accession,
                selectedAtoms: hoveredAtom
                  ? new Set([...selectedAtoms, hoveredAtom])
                  : selectedAtoms,
              }
            : null
        }
        nailing={false}
        // If the closed viewer is the current viewer then reset the 'selected'
        onClose={viewer =>
          setSelectedAtoms(previous => {
            if (viewer.selectedAtoms === previous) return new Set();
            else return previous;
          })
        }
      />
    </Suspense>
  );
};

export default FluctuationAnalysis;
