import React, { lazy, Suspense, useState, useContext, useMemo, useEffect, useCallback } from 'react';
// Import tools to retrieve data using the API
import { BASE_PATH_PROJECTS } from '../../../utils/constants';
import useAPI from '../../../hooks/use-api';
// Import project data
import { ProjectCtx } from '../../../contexts';
// Import MUI components
import { CardContent, Typography, TextField } from '@mui/material';
// Import some custom components
import Card from '../../../components/animated-card';
import ViewerSpawner from '../../../components/viewer-spawner';
import Loading from '../../../components/loading';
import InteractionSelector from '../../../components/interaction-selector';
import DoubleSideSwitch from 'src/components/double-side-switch';
import Legend from '../../../components/legend';
// Import NGL default representations
import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';
// Import CSS style
import style from './style.module.css';
// Import some auxiliar functions
import { Version } from 'src/utils/auxiliar-functions';
// Import a custom hook
import useRemfo from 'src/hooks/use-remfo';

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
  const { accessionAndMdNumber, topology, interactions } = useContext(ProjectCtx);

  // Send a request to the API with the url of the energies analyses index
  const analysesUrlBase = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses`;
  const indexUrl = `${analysesUrlBase}/energies`;
  const { loading: indexLoading, payload: indexPayload, error: indexError } = useAPI(indexUrl);

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // Set the target interaction name
  const { interactionName, analysisName } = useMemo(() => {
    // Wait for main data to be downloaded
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
  const dataset = useRemfo(previous => {
    // Wait for the download to finish
    if (!indexPayload || !payload) return previous;
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

  // Mine data from the selected interaction
  // Set some required host and gues atom/residue selections
  const {
    hostAtomIndices,
    hostResidueIndices,
    guestInterfaceAtomIndices,
    strongBonds
  } = useMemo(() => {
    // Wait for main data to be downloaded
    if (!topology || !interactions) return {}
    // Get the selected interaction
    const interaction = interactions[selectedInteraction];
    // Get host atom indices
    const hostAtomIndices = selectedOrder
      ? interaction.atom_indices_1
      : interaction.atom_indices_2;
    // Convert atom indices to residue indices
    const hostResidueIndices = topology.atom2residueIndices(hostAtomIndices);
    // Get the guest interface atom indcies
    const guestInterfaceAtomIndices = selectedOrder
      ? interaction.interface_atom_indices_2
      : interaction.interface_atom_indices_1;
    // Get atom indices from covalent bonds between both interacting agents
    const strongBonds = interaction['strong_bonds'];
    return { hostAtomIndices, hostResidueIndices, guestInterfaceAtomIndices, strongBonds };
  }, [topology, interactions, selectedInteraction, selectedOrder]);

  // Get the default representations
  const defaultRepresentations = useDefaultRepresentations();

  // Define the representations to be displayed in the viewer
  const [ representations, setRepresentations ] = useState(null);

  // Set the representations
  useEffect(() => {
    // Wait for main data to be downloaded
    if (!topology || !defaultRepresentations || !guestInterfaceAtomIndices) return;
    // Set the host NGL selection
    const guestNglSelection = topology.atomIndices2Ngl(guestInterfaceAtomIndices);
    // Set the viewer representations
    setRepresentations(previousRepresentations => {
      // If this is the first render then set the default values
      if (previousRepresentations === null) return [
        ...defaultRepresentations,
        {
          selection: guestNglSelection,
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
      previousGuest.selection = guestNglSelection;
      return [...previousRepresentations];
    });
  }, [topology, defaultRepresentations, guestInterfaceAtomIndices]);

  // This is a toggle state for when data is displayed per atom or per residue
  const [perResidue, setPerResidue] = useState(true);

  // Reformat data se we can input it to the graph
  const {
    data,
    dataError,
    isDataPerResidue,
    strongBondMarks,
    esData,
    vdwData,
    bothData,
    xTooltip,
  } = useMemo(() => {
    // Return if the dataset is not ready yet
    if (!dataset || !topology) return {};
    if (dataset.error) return {};
    // Get the dataset version
    const datasetVersion = new Version(dataset.version);
    // Old versions of energies have only residue data, not atom data
    const isDataPerResidue = datasetVersion.major < 1;
    // Prepare data in a graph-friendly format
    let data;
    // Set the agent whose data will be displayed in the graph
    const hostAgent = selectedOrder ? 'agent1' : 'agent2';
    // Get the corresponding agent data
    data = dataset[hostAgent];
    // Data should exist at this point
    if (!data) return {
      data: null,
      dataError: `Data for ${hostAgent} not found in the interaction "${dataset.name}"`
    };

    // Set the tags to be displayed on each graph x axis
    // If data is represented per residue then we need the corresponding residue labels
    if (perResidue) {
      // Convert residue indices to their correspondong labels
      const hostResiduesLabels = hostResidueIndices.map(
        residueIndex => topology.getResidueByIndex(residueIndex).standardLabel
      );
      // Add this to the output formatted data
      data.xTags = hostResiduesLabels;
    }
    // If data is represented per atom then we need the corresponding atom labels
    else {
      // Convert atom indices to atom labels
      const hostAtomLabels = hostAtomIndices.map(
        index => topology.getAtomByIndex(index).label
      )
      // Add this to the output formatted data
      data.xTags = hostAtomLabels;
    }

    // In case of strong bonds, find the implicated residues and their position in the x axis
    // They will be marked in the graph
    const strongBondAtoms = [].concat.apply([], strongBonds);
    const strongBondLabels = perResidue
      ? strongBondAtoms.map(atomIndex =>
        topology.getAtomByIndex(atomIndex).residue.standardLabel,
      )
      : strongBondAtoms.map(atomIndex =>
        topology.getAtomByIndex(atomIndex).label,
      );
    const strongBondMarks = [];
    strongBondLabels.forEach(residue => {
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

    // Group data by residue IF data is to be represented by residue
    const grouper = perResidue && !isDataPerResidue
      ? values => {
        const residueValues = {};
        values.forEach((value, v) => {
          const atomIndex = hostAtomIndices[v];
          const residueIndex = topology.getAtomByIndex(atomIndex).residueIndex;
          residueValues[residueIndex] = (residueValues[residueIndex] || 0) + value
        });
        return hostResidueIndices.map(residueIndex => residueValues[residueIndex]);
      }
      : values => values;

    // Set the dataset for each graph
    const esData = {
      esi: { data: grouper(data.ies), color: 'red' },
      esf: { data: grouper(data.fes), color: 'blue' },
      es: { data: grouper(data.es), color: 'black' },
    };
    const vdwData = {
      vdwi: { data: grouper(data.ivdw), color: 'red' },
      vdwf: { data: grouper(data.fvdw), color: 'blue' },
      vdw: { data: grouper(data.vdw), color: 'black' },
    };
    const bothData = {
      bothi: { data: grouper(data.iboth), color: 'red' },
      bothf: { data: grouper(data.fboth), color: 'blue' },
      both: { data: grouper(data.both), color: 'black' },
    };

    // Set the tooltip generator for the graph hover
    const xTooltip = (_, xIndex) =>
      `${perResidue ? 'residue' : 'atom'} ${(data.xTags && data.xTags[xIndex]) || xIndex}`;

    return {
      data,
      isDataPerResidue,
      strongBondMarks,
      esData,
      vdwData,
      bothData,
      xTooltip,
    };
  }, [
    dataset,
    selectedOrder,
    perResidue,
    topology,
    hostAtomIndices,
    hostResidueIndices,
    strongBonds,
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
  const [selectedX, setSelectedX] = useState(null);

  // Memoize the marks
  const marks = useMemo(() => {
    if (selectedX === null) return strongBondMarks;
    const selectedMark = {
      x: selectedX,
      attr: { fill: '#c8c8c8' },
    };
    return [selectedMark, ...strongBondMarks];
  }, [selectedX, strongBondMarks]);

  // Set the selected residue indices (only one index with the current implmementation)
  const selectedResidueIndices = useMemo(() => {
    // If there is nothing selected then exit
    if (selectedX === null) return null;
    // If we are representing data by atom, not by residue, then exit
    if (!perResidue) return null;
    // Get the selected residue index
    const residueIndex = hostResidueIndices[selectedX];
    return [residueIndex];
  }, [hostResidueIndices, perResidue, selectedX]);

  // Set the selected residue indices (only one index with the current implmementation)
  const selectedAtomIndices = useMemo(() => {
    // If there is nothing selected then exit
    if (selectedX === null) return null;
    // If we are representing data by residue, not by atom, then exit
    if (perResidue) return null;
    // Get the selected residue index
    const atomIndex = hostAtomIndices[selectedX];
    return [atomIndex];
  }, [hostAtomIndices, perResidue, selectedX]);

  // Set a callback to reset the X selection whenever the viewer is closed or nail
  const resetX = useCallback(viewer =>
    setSelectedX(previous => {
      if (viewer && viewer.selectedX === previous)
        return null;
      else return previous;
    }), []);

  // Set some state setters
  const handleSelectInteraction = useCallback(newValue => {
    setSelectedInteraction(newValue);
    setSelectedX(null);
  }, []);
  const handleToggleOrder = useCallback(() => {
    setSelectedOrder(previous => !previous);
    setSelectedX(null);
  }, []);
  const handleTogglePerResidue = useCallback(() => {
    setPerResidue(previous => !previous);
    setSelectedX(null);
  }, []);

  // Check if anything is still beeing loaded
  const anyLoading = indexLoading || loading

  // Render loading or error messages according with the API response
  if (indexError) return indexError.toString();
  if (error) return error.toString();
  if (dataset && dataset.error) return dataset.error;
  if (!dataset) {
    if (anyLoading) return <Loading />;
    return 'Something bad happened';
  }

  if (!topology) return <Loading />;

  // Check if there is only 1 residue
  const singleValue = esData && esData.es.data.length === 1;

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <CardContent className={style.horizontal}>
          <Typography variant="h6">Interaction:</Typography>
          <InteractionSelector
            interactions={interactions}
            selectedInteraction={selectedInteraction}
            setSelectedInteraction={handleSelectInteraction}
            selectedOrder={selectedOrder}
            handleToggleOrder={handleToggleOrder}
            firstOrderLabel={'Host'}
            firstOrderTooltip={'Interactor whose energies are to be shown'}
            secondOrderLabel={'Guest'}
            secondOrderTooltip={'Interactor with the opposite energies'}
            toggleOrderTooltip={'Toggle interactors'}
          />
        </CardContent>
        <div className={anyLoading ? style.disabled : style.enabled}>
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
          {!isDataPerResidue && <DoubleSideSwitch
            firstLabel={'Residues'}
            secondLabel={'Atoms'}
            isFirst={perResidue}
            onChange={handleTogglePerResidue}
          />}
          {dataError || singleValue ? (
            <CardContent>
              <Typography variant="h6">
                {dataError ? dataError : `The host has only 1 ${perResidue ? 'residue' : 'atom'}`}
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
                onSelect={setSelectedX}
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
                onSelect={setSelectedX}
                dataDisplay={vdwDisplay}
                fullPrecision
                marks={marks}
              />
              <Graph
                yData={bothData}
                title={'Electrostatic + Van der Waals'}
                xAxisLabel={perResidue ? 'Residue' : 'Atom'}
                xAxisValues={data.xTags}
                xTooltip={xTooltip}
                yAxisLabel={'Interaction energy (kcal/mol)'}
                onSelect={setSelectedX}
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
        </div>
      </Card>
      <ViewerSpawner
        // Set the new viewer or null if there is not a proper "selectedResidueIndices" value
        newViewer={selectedResidueIndices || selectedAtomIndices
          ? {
              selectedResidueIndices: selectedResidueIndices,
              selectedAtoms: selectedAtomIndices,
              representationsState: [ representations, setRepresentations ],
              // Just for further reference
              selectedX
            }
          : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selectedX'
        onNail={resetX}
        onClose={resetX}
      />
    </Suspense>
  );
};

export default Energies;
