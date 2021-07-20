import React, { lazy, Suspense, useState, useContext, useMemo } from 'react';

import { CardContent, Typography } from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx, PdbCtx, ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import Legend from '../../../components/legend';

import InteractionSelector from '../../../components/interaction-selector';

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
  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);

  // Send a request to the API with the url of the rgyr analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/energies/`,
  );

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // This is a toggle state for which agent data is shown
  const [selectedOrder, setSelectedOrder] = useState(true);

  // Set when one point in the graph is selected
  const [selected, setSelected] = useState(null);

  // Set which data is displayed: all, start, end or any combination of them
  const [display, setDisplay] = useState({ all: true, start: true, end: true });

  const interactions = metadata && metadata.INTERACTIONS;

  const data = useMemo(() => {
    // Return if the payload is not ready
    if (!payload) return;

    // Get the selected interaction
    const interaction = interactions[selectedInteraction];

    const agent = selectedOrder ? 'agent1' : 'agent2';

    // Get the data whose name matches the interaction name
    const data = payload.data.find(dataset => {
      return dataset.name === interaction.name;
    })[agent];
    if (!data)
      throw new Error(
        `Dataset for the interaction "${interaction.name}" not found`,
      );

    data.xTags = [];
    for (const residue of data.labels) {
      const numeration = complexNumerationParser(residue);
      const mod = source2modelResidue(numeration, pdbData.file);
      data.xTags.push(mod.ngl);
    }

    return data;
  }, [payload, interactions, selectedInteraction, selectedOrder, pdbData]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <CardContent className={style.horizontal}>
          <Typography variant="h6">Interaction:</Typography>
          <InteractionSelector
            interactions={interactions}
            selectedInteraction={selectedInteraction}
            setSelectedInteraction={setSelectedInteraction}
            selectedOrder={selectedOrder}
            setSelectedOrder={setSelectedOrder}
            firstOrderLabel={'Host'}
            firstOrderTooltip={'Interactor whose energies are to be shown'}
            secondOrderLabel={'Guest'}
            secondOrderTooltip={'Interactor with the opposite energies'}
            toggleOrderTooltip={'Toggle interactors'}
          />
        </CardContent>
        <CardContent>
          <Graph2
            yData={{
              esi: { data: data.ies, color: 'red' },
              esf: { data: data.fes, color: 'blue' },
              es: { data: data.es, color: 'black' },
            }}
            xAxisValues={data.xTags}
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
            dataDisplay={{
              esi: display.start,
              esf: display.end,
              es: display.all,
            }}
            selected={selected}
          />
          <Graph2
            yData={{
              vdwi: { data: data.ivdw, color: 'red' },
              vdwf: { data: data.fvdw, color: 'blue' },
              vdw: { data: data.vdw, color: 'black' },
            }}
            title={'vdW'}
            xAxisValues={data.xTags}
            xUnit={'residue'}
            yAxisLabel={'kcal/mol'}
            onSelect={(xIndex, xValue) => {
              // Transform the model numeration in a single string format (e.g. 'B:1') to source numeration
              const num = nglNumerationParser(xValue);
              const source = model2sourceResidue(num, pdbData.file);
              setSelected([source.numeration]);
            }}
            dataDisplay={{
              vdwi: display.start,
              vdwf: display.end,
              vdw: display.all,
            }}
            selected={selected}
          />
          <Graph2
            yData={{
              bothi: {
                data: data.iboth,
                color: 'red',
              },
              bothf: { data: data.fboth, color: 'blue' },
              both: { data: data.both, color: 'black' },
            }}
            title={'Electrostatic+vdW'}
            xAxisLabel={'Residue number'}
            xAxisValues={data.xTags}
            xUnit={'residue'}
            yAxisLabel={'kcal/mol'}
            onSelect={(xIndex, xValue) => {
              // Transform the model numeration in a single string format (e.g. 'B:1') to source numeration
              const num = nglNumerationParser(xValue);
              const source = model2sourceResidue(num, pdbData.file);
              setSelected([source.numeration]);
            }}
            dataDisplay={{
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
