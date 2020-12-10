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

import Info from '../../../components/info';

import style from './style.module.css';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
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

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <Info
          reference={'fluctuation-statistics'}
          tooltip={
            <>
              Statistics table including fluctuation data label, mean and
              standard deviation. Values are in namometers.
            </>
          }
        />
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
        <Info
          reference={'fluctuation-graph'}
          tooltip={
            <>
              This graph represents the fluctuation of each atom. Data is
              displayed (more opaque lines) alongside corresponding mean value
              (light horizontal line) and mean ± 1 standard deviation (lighter
              horizontal bands)
              <br />
              <br />
              The horizontal edge stands for the atoms numeration.
              <br />
              The vertical edge stands for the flucutation in nanometers.
              <br />
              <br />
              The graph is{' '}
              <span style={{ color: 'lightGreen' }}>interactive</span>. Use the
              mouse to move along data by holding the click button and dragging
              left or right. Use the mouse wheel to zoom in a specific region.
              <span style={{ color: 'lightGreen' }}> Click any point </span>
              on the graph to open an interactive window displaying the
              trajectory with the corresponding atom highlighted.
            </>
          }
        />
        <CardContent>
          <Typography variant="h6" />
          <Graph
            y={payload.y}
            step={payload.step}
            xLabel={'Atom'}
            xUnit={'atom'}
            yLabel={'Fluctuation (Å)'}
            type={'dash'}
            onHover={setHoveredAtom}
            hovered={hoveredAtom}
            onSelect={setSelectedAtoms}
            selected={selectedAtoms}
            showPrecisionSlider={false}
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
