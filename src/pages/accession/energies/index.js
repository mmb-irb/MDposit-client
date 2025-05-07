import React, { lazy, Suspense, useState, useContext, useMemo } from 'react';

import { CardContent, Typography, TextField } from '@mui/material';

import Card from '../../../components/animated-card';
import ViewerSpawner from '../../../components/viewer-spawner';
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

// DANI: Note that here coexit the old and the new energies data format
// DANI: Old energies contained all interactions data in a single place
// DANI: New energies has an index in the main analysis and the results for every interaction separated
const Energies = () => {
  // Get the current project data
  const { accessionAndMdNumber, topology: topologyManager, interactions } = useContext(
    ProjectCtx,
  );

  // Send a request to the API with the url of the energies analyses index
  const analysesUrlBase = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses`;
  const indexUrl = `${analysesUrlBase}/energies`;
  const { loading: indexLoading, payload: indexPayload, error: indexError } = useAPI(indexUrl);

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // Set the target interaction name
  const { interactionName, analysisName } = useMemo(() => {
    if (!interactions || !indexPayload) return {};
    // Get the selected interaction
    const interaction = interactions[selectedInteraction];
    // Check if the analysis is in the old or the new format
    const isOld = indexPayload.data !== undefined;
    // If so, there is no target analysis name, but the whole data is already in the payload
    if (isOld) return { interactionName: interaction.name };
    const targetEntry = indexPayload.find(entry => entry.name === interaction.name);
    return { interactionName: interaction.name, analysisName: targetEntry.analysis }
  }, [interactions, selectedInteraction, indexPayload]);

  // Send a request to the API with the url of some specific energies analysis
  const interactionAnalysisUrl = analysisName ? `${analysesUrlBase}/${analysisName}` : null;
  const { loading, payload, error } = useAPI(interactionAnalysisUrl);

  // Now set the actual dataset to be used
  // Note that this is a compatibility layer between the old and the new energies system
  const dataset = useMemo(() => {
    // Wait for the download to finish
    if (!indexPayload) return;
    // Check if the analysis is in the old or the new format
    const isOld = indexPayload.data !== undefined;
    // If this is the new system then the dataset is the payload itself
    if (!isOld) return payload;
    // If this is the old system then the dataset is in the index payload
    const interactionData = indexPayload.data.find(entry => entry.name === interactionName);
    if (!interactionData) return { error: `Dataset for interaction "${interactionName}" not found` };
    return interactionData;
  }, [indexPayload, payload, interactionName]);

  // This is a toggle state for which agent data is shown
  const [selectedOrder, setSelectedOrder] = useState(true);

  // Get the default representations
  const defaultRepresentations = useDefaultRepresentations();

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
    // Return if the dataset is not ready yet
    if (!dataset || !topologyManager) return {};
    if (dataset.error) return {};
    // Get the selected interaction
    const interaction = interactions[selectedInteraction];
    // Prepare data in a graph-friendly format
    let data;
    let guestSelection;
    const agent = selectedOrder ? 'agent1' : 'agent2';
    let dataError;
    data = dataset[agent];
    if (!data) {
      dataError = `Data for ${agent} not found in the interaction "${dataset.name}"`;
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
          //other: { radius: 0.6 },
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
    const strongBondResidues = strongBondAtoms.map(atomIndex =>
      topologyManager.getAtomByIndex(atomIndex).residue.standardLabel,
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
    dataset,
    selectedOrder,
    topologyManager,
    interactions,
    defaultRepresentations,
  ]);

  // Set which data is displayed: all, start, end or any combination of them
  const [display, setDisplay] = useState({ all: true, start: true, end: true });

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

  // Track when one point in the graph is selected
  const [selected, setSelected] = useState(null);

  // Memoize the marks
  const marks = useMemo(() => {
    if (selected === null) return strongBondMarks;
    const selectedMark = {
      x: selected,
      attr: { fill: '#c8c8c8' },
    };
    return [selectedMark, ...strongBondMarks];
  }, [selected, strongBondMarks]);

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
  if (indexLoading || loading) return <Loading />;
  else if (indexError) return indexError.toString();
  else if (error) return error.toString();
  else if (dataset && dataset.error) return dataset.error;
  else if (!dataset) return 'Something bad happened';

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
            firstOrderLabel={'Guest'}
            firstOrderTooltip={'Interactor whose energies are to be shown'}
            secondOrderLabel={'Host'}
            secondOrderTooltip={'Interactor with the opposite energies'}
            toggleOrderTooltip={'Toggle interactors'}
          />
        </CardContent>
        {dataError || !data ? null : (
          <CardContent>
            <legend className={style['margined-bottom']}>Overall energies summatory</legend>
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
              title={'Van der Waals'}
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
              title={'Electrostatic + Van der Waals'}
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
