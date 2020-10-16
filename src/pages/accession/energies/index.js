import React, { lazy, Suspense, useState, useContext } from 'react';

import { CardContent, Typography } from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx, PdbCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import Info from '../../../components/info';
import Legend from '../../../components/legend';

import style from './style.module.css';

import {
  nglNumerationParser,
  model2sourceResidue,
  complexNumerationParser,
  source2modelResidue,
} from '../../../utils/topology-manager';

const Graph2 = lazy(() =>
  import(/* webpackChunkName: 'graph2' */ '../../../components/graph2'),
);

const Energies = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);

  // Send a request to the API with the url of the rgyr analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/energies/`,
  );

  // Set when one point in the graph is selected
  const [selected, setSelected] = useState(null);

  // Set which data is displayed: all, start, end or any combination of them
  const [display, setDisplay] = useState({ all: true, start: true, end: true });

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  const xTags = [];
  for (const residue of payload.residues_labels) {
    const numeration = complexNumerationParser(residue);
    const mod = source2modelResidue(numeration, pdbData.file);
    xTags.push(mod.ngl);
  }

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <Info
          reference={'energies'}
          tooltip={
            <>
              This graph represents from top to bottom the electrostatic
              charges, the Van der Waals forces and the sum of both values per
              each residue respectively. Energies are calculated for each atom
              individually and then added by residues. Averages are calculated
              from 100 selected frames along the trajectory. In addition, two
              more averages are calculated: the average for the frist 20 frames
              of the 100 selected frames and the average for the last 20 frames.
              These averages are represented in red and blue colors
              respectively.
              <br />
              <br />
              The horizontal edge stands for the main protein residues numbers.
              <br />
              The vertical edge stands for the residue charges in kcal/mol.
              <br />
              <br />
              The graph is{' '}
              <span style={{ color: 'lightGreen' }}>interactive</span>. Use the
              mouse to move along data by holding the click button and dragging
              left or right. Use the mouse wheel to zoom in a specific region.
              <span style={{ color: 'lightGreen' }}> Click any point </span>
              on the graph to open an interactive window to display the
              strucutre with the corresponding highlighted residue.
            </>
          }
        />
        <CardContent>
          <Typography variant="h6" />
          <Graph2
            yData={{
              esi: { data: payload.residues_es_avg_initial, color: 'red' },
              esf: { data: payload.residues_es_avg_final, color: 'blue' },
              es: { data: payload.residues_es_avg, color: 'black' },
            }}
            xAxisValues={xTags}
            xUnit={'residue'}
            title={'Electrostatic'}
            xScaleFactor={0.001}
            yAxisLabel={'kcal/mol'}
            onSelect={(xIndex, xValue) => {
              // Transform the model numeration in a single string format (e.g. 'B:1') to source numeration
              const num = nglNumerationParser(xValue);
              const source = model2sourceResidue(num, pdbData.file);
              setSelected([source.numeration]);
            }}
            show={{ esi: display.start, esf: display.end, es: display.all }}
            selected={selected}
          />
          <Graph2
            yData={{
              vdwi: { data: payload.residues_vdw_avg_initial, color: 'red' },
              vdwf: { data: payload.residues_vdw_avg_final, color: 'blue' },
              vdw: { data: payload.residues_vdw_avg, color: 'black' },
            }}
            title={'vdW'}
            xAxisValues={xTags}
            xUnit={'residue'}
            yAxisLabel={'kcal/mol'}
            onSelect={(xIndex, xValue) => {
              // Transform the model numeration in a single string format (e.g. 'B:1') to source numeration
              const num = nglNumerationParser(xValue);
              const source = model2sourceResidue(num, pdbData.file);
              setSelected([source.numeration]);
            }}
            show={{ vdwi: display.start, vdwf: display.end, vdw: display.all }}
            selected={selected}
          />
          <Graph2
            yData={{
              bothi: { data: payload.residues_both_avg_initial, color: 'red' },
              bothf: { data: payload.residues_both_avg_final, color: 'blue' },
              both: { data: payload.residues_both_avg, color: 'black' },
            }}
            title={'Electrostatic+vdW'}
            xAxisLabel={'Residue number'}
            xAxisValues={xTags}
            xUnit={'residue'}
            yAxisLabel={'kcal/mol'}
            onSelect={(xIndex, xValue) => {
              // Transform the model numeration in a single string format (e.g. 'B:1') to source numeration
              const num = nglNumerationParser(xValue);
              const source = model2sourceResidue(num, pdbData.file);
              setSelected([source.numeration]);
            }}
            show={{
              bothi: display.start,
              bothf: display.end,
              both: display.all,
            }}
            selected={selected}
          />
          <Legend
            entries={[
              { name: 'all', color: 'black', check: display.all },
              { name: 'start', color: 'red', check: display.start },
              { name: 'end', color: 'blue', check: display.end },
            ]}
            onChange={result =>
              setDisplay(previous => {
                // WARNING: Do not return the previous object modified
                // It won't trigger the re-render since it is the same object
                const newDisplay = { ...previous };
                newDisplay[result] = !newDisplay[result];
                return newDisplay;
              })
            }
          />
        </CardContent>
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          selected
            ? {
                accession: accession,
                selectedResidues: selected,
              }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelected(previous => {
            if (viewer.selectedResidues === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelected(previous => {
            if (viewer.selectedResidues === previous) return null;
            else return previous;
          })
        }
      />
    </Suspense>
  );
};

export default Energies;
