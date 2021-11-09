import React, { lazy, Suspense, useState, useContext, useMemo } from 'react';

import { CardContent, Typography, TextField } from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx, PdbCtx, ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import Legend from '../../../components/legend';

import InteractionSelector from '../../../components/interaction-selector';

import style from './style.module.css';

import {
  complexNumerationParser,
  complexSelectionRanger,
  source2absoluteResidue,
  absolute2reference,
  getResidueType,
} from '../../../utils/topology-manager';

const Graph2 = lazy(() =>
  import(/* webpackChunkName: 'graph2' */ '../../../components/graph2'),
);

// Return the rounded summatory
const getSum = values => {
  const sum = values.reduce((a, b) => a + b, 0);
  const rounded = Math.round(sum * 10000) / 10000;
  return rounded;
};

const Energies = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);

  // Get the default representations
  const defaultRepresentations = useDefaultRepresentations();

  // Send a request to the API with the url of the rgyr analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/energies/`,
  );

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // This is a toggle state for which agent data is shown
  const [selectedOrder, setSelectedOrder] = useState(true);

  // Track when one point in the graph is selected
  const [selected, setSelected] = useState(null);

  // Track the corresponding residue when one point in the graph is selected
  const [selectedResidues, setSelectedResidues] = useState(null);

  // Set which data is displayed: all, start, end or any combination of them
  const [display, setDisplay] = useState({ all: true, start: true, end: true });

  const interactions = metadata && metadata.INTERACTIONS;

  const { data, dataError, representations } = useMemo(() => {
    // Return if the payload is not ready
    if (!payload) return {};

    let data;
    let guestSelection;

    // Get the selected interaction
    const interaction = interactions[selectedInteraction];

    const agent = selectedOrder ? 'agent1' : 'agent2';

    // Get the data whose name matches the interaction name
    const dataset = payload.data.find(dataset => {
      return dataset.name === interaction.name;
    });
    if (!dataset) {
      const dataError = `Dataset for the interaction "${interaction.name}" not found`;
      return { data: null, dataError };
    }
    data = dataset[agent];
    if (!data) {
      const dataError = `Data for the interaction "${interaction.name}" not found`;
      return { data: null, dataError };
    }
    // Set the guest NGL selection
    const guestResidues = selectedOrder
      ? interaction.interface_2
      : interaction.interface_1;
    const { rangedSelection: parsedResidues } = complexSelectionRanger(
      guestResidues,
    );
    guestSelection = parsedResidues;

    // Set the tags to be displayed on each graph x axis
    data.xTags = [];
    data.labels.forEach(residue => {
      const numeration = complexNumerationParser(residue);
      const absolute = source2absoluteResidue(
        numeration,
        pdbData.file,
        metadata,
      );
      const residueType = getResidueType(absolute, pdbData.file);
      // Use the reference numeration to represent residues in
      const ref = absolute2reference(absolute, metadata);
      if (ref) {
        const tag = ref.index + '(' + residueType + ')';
        data.xTags.push(tag);
        return;
      }
      // If we have no reference for this residue we use the source numeration
      // Add a '*' to warn the user that the numeration is not "official"
      const tag = numeration.residue + '*(' + residueType + ')';
      data.xTags.push(tag);
    });

    const representations = [
      ...defaultRepresentations,
      {
        selection: guestSelection,
        name: 'Guest elements',
        type: 'ball+stick',
        color: 'element',
        opacity: 0.3,
      },
    ];

    return { data, dataError, representations };
  }, [
    payload,
    interactions,
    selectedInteraction,
    selectedOrder,
    pdbData,
    metadata,
    defaultRepresentations,
  ]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  // Check if there is only 1 residue
  const singleResidue = data && data.es.length === 1;

  const handleResidueSelection = xIndex => {
    setSelected(xIndex);
    setSelectedResidues([data.labels[xIndex]]);
  };

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
        {dataError ? null : (
          <CardContent>
            <legend>Overall energies summatory</legend>
            <div>
              <TextField
                className={style['text-field']}
                label="Electrostatic"
                title="Sum electorstatic value along the whole trajectory"
                value={getSum(data.es) + ' kcal/mol'}
              />
              <TextField
                className={style['text-field']}
                label="Electrostatic Initial"
                title="Sum electorstatic value along the first 20% trajectory frames"
                value={getSum(data.ies) + ' kcal/mol'}
              />
              <TextField
                className={style['text-field']}
                label="Electrostatic Final"
                title="Sum electorstatic value along the last 20% trajectory frames"
                value={getSum(data.fes) + ' kcal/mol'}
              />
            </div>
            <div>
              <TextField
                className={style['text-field']}
                label="Van der Waals"
                title="Sum Van der Waals value along the whole trajectory"
                value={getSum(data.vdw) + ' kcal/mol'}
              />
              <TextField
                className={style['text-field']}
                label="Van der Waals Initial"
                title="Sum Van der Waals value along the first 20% trajectory frames"
                value={getSum(data.ivdw) + ' kcal/mol'}
              />
              <TextField
                className={style['text-field']}
                label="Van der Waals Final"
                title="Sum Van der Waals value along the last 20% trajectory frames"
                value={getSum(data.fvdw) + ' kcal/mol'}
              />
            </div>
            <div>
              <TextField
                className={style['text-field']}
                label="Electrostatic + Van der Waals"
                title="Sum electorstatic + Van der Waals value along the whole trajectory"
                value={getSum(data.both) + ' kcal/mol'}
              />
              <TextField
                className={style['text-field']}
                label="Electrostatic + Van der Waals Initial"
                title="Sum electorstatic + Van der Waals value along the first 20% trajectory frames"
                value={getSum(data.iboth) + ' kcal/mol'}
              />
              <TextField
                className={style['text-field']}
                label="Electrostatic + Van der Waals Final"
                title="Sum electorstatic + Van der Waals value along the last 20% trajectory frames"
                value={getSum(data.fboth) + ' kcal/mol'}
              />
            </div>
          </CardContent>
        )}
        {dataError || singleResidue ? (
          <CardContent>
            <Typography variant="h6">
              {dataError ? dataError : 'The host has only 1 residue'}
            </Typography>
          </CardContent>
        ) : (
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
              yAxisLabel={'Interaction energy (kcal/mol)'}
              onSelect={handleResidueSelection}
              dataDisplay={{
                esi: display.start,
                esf: display.end,
                es: display.all,
              }}
              selected={selected}
              fullPrecision
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
              yAxisLabel={'Interaction energy (kcal/mol)'}
              onSelect={handleResidueSelection}
              dataDisplay={{
                vdwi: display.start,
                vdwf: display.end,
                vdw: display.all,
              }}
              selected={selected}
              fullPrecision
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
              xAxisLabel={'Residue'}
              xAxisValues={data.xTags}
              xUnit={'residue'}
              yAxisLabel={'Interaction energy (kcal/mol)'}
              onSelect={handleResidueSelection}
              dataDisplay={{
                bothi: display.start,
                bothf: display.end,
                both: display.all,
              }}
              selected={selected}
              fullPrecision
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
        )}
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selectedResidues" value
        newViewer={
          selectedResidues
            ? {
                accession: accession,
                selectedResidues: selectedResidues,
                representations: representations,
              }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selectedResidues'
        onNail={viewer =>
          setSelectedResidues(previous => {
            if (viewer.selectedResidues === previous) {
              setSelected(null);
              return null;
            } else {
              return previous;
            }
          })
        }
        onClose={viewer =>
          setSelectedResidues(previous => {
            if (viewer.selectedResidues === previous) {
              setSelected(null);
              return null;
            } else {
              return previous;
            }
          })
        }
      />
    </Suspense>
  );
};

export default Energies;
