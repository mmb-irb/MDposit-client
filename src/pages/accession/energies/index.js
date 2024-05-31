import React, { lazy, Suspense, useState, useContext, useMemo } from 'react';

import { CardContent, Typography, TextField } from '@mui/material';

import Card from '../../../components/animated-card';
import ViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import Legend from '../../../components/legend';

import InteractionSelector from '../../../components/interaction-selector';

import style from './style.module.css';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

// Set references to find representations between different renders
const GUEST_REFERENCE = 'guest';

// Return the rounded summatory
const getSum = values => {
  const sum = values.reduce((a, b) => a + b, 0);
  const rounded = Math.round(sum * 10000) / 10000;
  return rounded;
};

const Energies = () => {
  // Get the current project data
  const { accessionAndMdNumber, topology: topologyManager, interactions } = useContext(
    ProjectCtx,
  );

  // Get the default representations
  const defaultRepresentations = useDefaultRepresentations();

  // Send a request to the API with the url of the energies analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/energies/`,
  );

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // This is a toggle state for which agent data is shown
  const [selectedOrder, setSelectedOrder] = useState(true);

  // Track when one point in the graph is selected
  const [selected, setSelected] = useState(null);

  // Set which data is displayed: all, start, end or any combination of them
  const [display, setDisplay] = useState({ all: true, start: true, end: true });

  // Define the representations to be displayed in the viewer
  const [ representations, setRepresentations ] = useState(null);

  const {
    data,
    dataError,
    strongBondMarks,
    esData,
    vdwData,
    bothData,
    xTooltip,
  } = useMemo(() => {
    // Return if the payload is not ready
    if (!payload || !topologyManager) return {};

    let data;
    let guestSelection;

    // Get the selected interaction
    const interaction = interactions[selectedInteraction];

    const agent = selectedOrder ? 'agent1' : 'agent2';

    // Get the data whose name matches the interaction name
    const dataset = payload.data.find(dataset => {
      return dataset.name === interaction.name;
    });
    let dataError;
    if (!dataset) {
      dataError = `Dataset for the interaction "${interaction.name}" not found`;
      return { data: null, dataError };
    }
    data = dataset[agent];
    if (!data) {
      dataError = `Data for the interaction "${interaction.name}" not found`;
      return { data: null, dataError };
    }
    // Set the guest NGL selection
    const guestInterfaceResidues = selectedOrder
      ? interaction.interface_indices_2
      : interaction.interface_indices_1;
    const {
      rangedSelection: rangedInterfaceResiduesSelection,
    } = topologyManager.residueIndices2Ngl(guestInterfaceResidues);
    guestSelection = rangedInterfaceResiduesSelection;

    // Set the tags to be displayed on each graph x axis
    data.xTags = [];
    const hostResidues = selectedOrder
      ? interaction.residue_indices_1
      : interaction.residue_indices_2;
    hostResidues.forEach(residueIndex => {
      const residue = topologyManager.getResidueByIndex(residueIndex);
      data.xTags.push(residue.standardLabel);
    });

    // Set the viewer representations
    setRepresentations(previousRepresentations => {
      // If this is the first render then set the default values
      if (previousRepresentations === null) return [
        ...defaultRepresentations,
        {
          selection: guestSelection,
          name: 'Guest elements',
          type: 'ball+stick',
          color: 'element',
          opacity: 0.3,
          reference: GUEST_REFERENCE
        }
      ];
      // Otherwise just update the guest representation
      const previousGuest = previousRepresentations.find(rep => rep.reference === GUEST_REFERENCE);
      previousGuest.selection = guestSelection;
      return [...previousRepresentations];
    });

    // In case of strong bonds, find the implicated residues and their position in the x axis
    // They will be marked in the graph
    const strongBonds = interaction['strong_bonds'];
    const strongBondAtoms = [].concat.apply([], strongBonds);
    const strongBondResidueIndexes = strongBondAtoms.map(atom =>
      topologyManager.getAtomResidueIndex(atom),
    );
    const strongBondResidues = strongBondResidueIndexes.map(
      residueIndex => topologyManager.getResidueByIndex(residueIndex).standardLabel,
    );
    const strongBondMarks = [];
    strongBondResidues.forEach(residue => {
      const xPosition = data.xTags.indexOf(residue);
      if (xPosition !== -1)
        strongBondMarks.push({
          x: xPosition,
          attr: {
            fill: 'orange',
            opacity: 0.5,
          },
        });
    });

    // Set the dataset for each graph
    const esData = {
      esi: { data: data.ies, color: 'red' },
      esf: { data: data.fes, color: 'blue' },
      es: { data: data.es, color: 'black' },
    };
    const vdwData = {
      vdwi: { data: data.ivdw, color: 'red' },
      vdwf: { data: data.fvdw, color: 'blue' },
      vdw: { data: data.vdw, color: 'black' },
    };
    const bothData = {
      bothi: {
        data: data.iboth,
        color: 'red',
      },
      bothf: { data: data.fboth, color: 'blue' },
      both: { data: data.both, color: 'black' },
    };

    // Set the tooltip generator for the graph hover
    const xTooltip = (_, xIndex) =>
      'residue ' + ((data.xTags && data.xTags[xIndex]) || xIndex);

    return {
      data,
      dataError,
      strongBondMarks,
      esData,
      vdwData,
      bothData,
      xTooltip,
    };
  }, [
    payload,
    selectedInteraction,
    selectedOrder,
    topologyManager,
    interactions,
    defaultRepresentations,
  ]);

  // Memoize the marks
  const marks = useMemo(() => {
    if (selected === null) return strongBondMarks;
    const selectedMark = {
      x: selected,
      attr: { fill: '#c8c8c8' },
    };
    return [selectedMark, ...strongBondMarks];
  }, [selected, strongBondMarks]);

  // Memoize the display parameters for each graph
  const { esDisplay, vdwDisplay, bothDisplay } = useMemo(() => {
    const esDisplay = {
      esi: display.start,
      esf: display.end,
      es: display.all,
    };
    const vdwDisplay = {
      vdwi: display.start,
      vdwf: display.end,
      vdw: display.all,
    };
    const bothDisplay = {
      bothi: display.start,
      bothf: display.end,
      both: display.all,
    };
    return { esDisplay, vdwDisplay, bothDisplay };
  }, [display]);

  // Set the selected residue indices (only one index with the current implmementation)
  const selectedResidueIndices = useMemo(() => {
    if (selected === null) return null;
    // Get the selected interaction
    const interaction = interactions[selectedInteraction];
    const hostResidues = selectedOrder
      ? interaction.residue_indices_1
      : interaction.residue_indices_2;
    const index = hostResidues[selected];
    return [index];
  }, [selected, interactions, selectedInteraction, selectedOrder]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!topologyManager) return <Loading />;

  // Check if there is only 1 residue
  const singleResidue = data && data.es.length === 1;

  const handleResidueSelection = xIndex => {
    setSelected(xIndex);
  };

  const handleToggleOrder = () => {
    setSelectedOrder(previous => !previous);
    setSelected(null);
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
            handleToggleOrder={handleToggleOrder}
            firstOrderLabel={'Host'}
            firstOrderTooltip={'Interactor whose energies are to be shown'}
            secondOrderLabel={'Guest'}
            secondOrderTooltip={'Interactor with the opposite energies'}
            toggleOrderTooltip={'Toggle interactors'}
          />
        </CardContent>
        {dataError || !data ? null : (
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
            <Graph
              yData={esData}
              xAxisValues={data.xTags}
              xTooltip={xTooltip}
              title={'Electrostatic'}
              xScaleFactor={0.001}
              yAxisLabel={'Interaction energy (kcal/mol)'}
              onSelect={handleResidueSelection}
              dataDisplay={esDisplay}
              fullPrecision
              marks={marks}
            />
            <Graph
              yData={vdwData}
              title={'vdW'}
              xAxisValues={data.xTags}
              xTooltip={xTooltip}
              yAxisLabel={'Interaction energy (kcal/mol)'}
              onSelect={handleResidueSelection}
              dataDisplay={vdwDisplay}
              fullPrecision
              marks={marks}
            />
            <Graph
              yData={bothData}
              title={'Electrostatic+vdW'}
              xAxisLabel={'Residue'}
              xAxisValues={data.xTags}
              xTooltip={xTooltip}
              yAxisLabel={'Interaction energy (kcal/mol)'}
              onSelect={handleResidueSelection}
              dataDisplay={bothDisplay}
              fullPrecision
              marks={marks}
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
      <ViewerSpawner
        // Set the new viewer or null if there is not a proper "selectedResidueIndices" value
        newViewer={selectedResidueIndices
          ? {
              selectedResidueIndices: selectedResidueIndices,
              representationsState: [ representations, setRepresentations ]
            }
          : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelected(previous => {
            if (viewer.selectedResidueIndices === selectedResidueIndices) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelected(previous => {
            if (viewer.selectedResidueIndices === selectedResidueIndices) return null;
            else return previous;
          })
        }
      />
    </Suspense>
  );
};

export default Energies;
