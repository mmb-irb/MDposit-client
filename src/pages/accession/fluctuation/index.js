import React, { lazy, Suspense, useState, useContext, useMemo } from 'react';

import {
  CardContent,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';

import Card from '../../../components/animated-card';
import ViewerSpawner from '../../../components/viewer-spawner';
import Loading from '../../../components/loading';

import { Button } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashAlt } from '@fortawesome/free-regular-svg-icons';

import useAPI from '../../../hooks/use-api';

import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';
import Version from 'src/utils/version';

import style from './style.module.css';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

const FluctuationAnalysis = () => {
  // Get project data
  const { accessionAndMdNumber, topology } = useContext(ProjectCtx);

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/fluctuation/`,
  );

  // In the original version these values were is nanometers (nm)
  // Thus they had to be multiplied by 10 since we want values in Ångstroms (Å)
  // However in the version 0.1 and beyond values are in Ångstroms already
  useMemo(() => {
    if (!payload || !topology) return;
    const rmsf = payload.y['rmsf'];
    // If we have a version 0.1 or grater then do nothing
    const version = new Version(payload.version);
    if (version < '0.1' && !rmsf.inAngstroms) {
      // If this is an old version then multiply all values by 10
      // Mark the data as already converted to avoid multiplying it more than once
      rmsf.inAngstroms = true;
      rmsf.data = rmsf.data.map(v => v * 10);
      rmsf.average = rmsf.average * 10;
      rmsf.stddev = rmsf.stddev * 10;
    }
    // If we have PBC atoms then filter their values out of the data
    // They must be null anyway
    const pbcAtoms = topology.pbcAtoms;
    if (pbcAtoms) rmsf.data = rmsf.data.filter((v, i) => !pbcAtoms.has(i));
  }, [payload, topology]);

  // React hooks
  // Set when the mouse is over the graph
  const [hoveredAtom, setHoveredAtom] = useState(null);
  // Set when one point in the graph (which stands for an atom) is selected
  const [selectedAtoms, setSelectedAtoms] = useState(new Set());

  // Set the mark for selected
  const marks = useMemo(() => {
    return Array.from(selectedAtoms).map(atom => ({
      x: atom,
      attr: { fill: '#c8c8c8' },
    }));
  }, [selectedAtoms]);

  // Set some memoized elements which depend on the topology
  const { xColors, xTooltip } = useMemo(() => {
    if (!topology) return {};
    // Color graph rectangle according to the equivalent atom element
    const xColors = topology.getAtomElementColors();
    // Set the tooltip generator for when the mouse hovers the graph
    // Display an atom label based on the x index
    const xTooltip = (_, xIndex) => {
      const atomNumber = xIndex + 1;
      const tag = 'atom ' + atomNumber;
      const atom = topology.getAtomByIndex(xIndex);
      const atomName = atom.name;
      if (!atomName) return tag;
      if (!atom.residue.name) return tag + ` (${atomName})`;
      return tag + ` (${atom.label})`;
    };
    return { xColors, xTooltip };
  }, [topology]);

  // We require the topology for this analysis
  if (!topology) return <Loading />;

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  const cents = num => Math.round(num * 100) / 100;

  // Handle when we get the atom index after clicking in the graph
  const handleAtomsSelection = atomIndex => {
    setSelectedAtoms(previous => {
      // In case the atom is no an atom index but an empty set it means the selection has been cleaned
      if (atomIndex instanceof Set) return atomIndex;
      const newSet = new Set(previous);
      newSet[newSet.has(atomIndex) ? 'delete' : 'add'](atomIndex);
      return newSet;
    });
  };

  const handleButtonClick = () => setSelectedAtoms(new Set());

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
          <Graph
            yData={payload.y}
            step={1} // Step is always 1 since x values are atomic indices and we always have all atoms
            xAxisLabel={'Atom'}
            xColors={xColors}
            xTooltip={xTooltip}
            yAxisLabel={'Fluctuation (Å)'}
            type={'dash'}
            onHover={setHoveredAtom}
            onSelect={handleAtomsSelection}
            mean={true}
            standardDeviation={true}
            marks={marks}
            fullPrecision={true}
          />
          <div className={style.right}>
            <Button
              variant="contained"
              disabled={!selectedAtoms.size}
              onClick={handleButtonClick}
            >
              <FontAwesomeIcon icon={faTrashAlt} />
              &nbsp;
              <span>Clear selection</span>
            </Button>
          </div>
        </CardContent>
      </Card>
      <ViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={selectedAtoms && selectedAtoms.size
          ? {
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
