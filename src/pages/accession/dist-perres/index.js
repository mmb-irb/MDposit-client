import React, { useContext, useState, useMemo, useCallback } from 'react';
// Import Material UI components
import { CardContent, Tabs, Tab, Typography } from '@mui/material';
// Import custom hooks
import useAPI from '../../../hooks/use-api';
import useRemfo from 'src/hooks/use-remfo';
// Import custom components
import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import InteractionSelector from '../../../components/interaction-selector';
import Heatmap from '../../../components/heatmap';
import ViewerSpawner from '../../../components/viewer-spawner';
// Load context data
import { ProjectCtx } from '../../../contexts';
// Load some constants
import { BASE_PATH_PROJECTS } from '../../../utils/constants';
// Load CSS style
import style from './style.module.css';

// Set the heatmap minimum and maximum colors
const heatmapMinimumColor = { r: 0, g: 0, b: 255 };
const heatmapMaximumColor = { r: 255, g: 0, b: 0 };

// Distance per residue analysis
const DistPerres = () => {
  // Get the current project data
  const {
    accessionAndMdNumber,
    topology,
    interactions,
    loading: isProjectLoading,
  } = useContext(ProjectCtx);

  // Send a request to the API with the url of the analyses index
  const analysesUrlBase = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses`;
  const indexUrl = `${analysesUrlBase}/dist-perres`;
  const { loading: isIndexLoading, payload: indexPayload, error: indexError } = useAPI(indexUrl);

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // The newest format has 4 fields: acceptors, donors, hydrogens and hbonds
  // The hbonds includes arrays of true and false per frame
  const interaction = interactions && interactions[selectedInteraction];

  // Get analysis data from the API
  // Set the target interaction name
  const { interactionName, analysisName } = useMemo(() => {
    // Wait for main data to be downloaded
    if (!interaction || !indexPayload) return {};
    // Check if the analysis is in the old or the new format
    const isOld = indexPayload.data !== undefined;
    // If so, there is no target analysis name, but the whole data is already in the payload
    if (isOld) return { interactionName: interaction.name };
    const targetEntry = indexPayload.find(entry => entry.name === interaction.name);
    return { interactionName: interaction.name, analysisName: targetEntry.analysis }
  }, [interaction, indexPayload]);

  // Send a request to the API with the url of some specific analysis
  const interactionAnalysisUrl = analysisName ? `${analysesUrlBase}/${analysisName}` : null;
  const { loading: isAnalysisLoading, payload, error } = useAPI(interactionAnalysisUrl);

  // Now set the actual dataset to be used
  // Note that this is a compatibility layer between the old and the new system
  const dataset = useRemfo(previous => {
    // Wait for the download to finish
    if (!indexPayload) return previous;
    // Check if the analysis is in the old or the new format
    const isOld = indexPayload.data !== undefined;
    // If this is the new system then the dataset is the payload itself
    if (!isOld) {
      if (!payload) return previous;
      return payload;
    }
    // If this is the old system then the dataset is in the index payload
    const interactionData = indexPayload.data.find(entry => entry.name === interactionName);
    if (!interactionData) return { error: `Dataset for interaction "${interactionName}" not found` };
    return interactionData;
  }, [indexPayload, payload, interactionName]);

  // The interaction residues to be displayed
  // May be all 'residue_indices' or only the 'interface_indices'
  const [selectedResidues, setSelectedResidues] = useState('interface_indices');

  // The graphic to be displayed ('mean' or 'stdv')
  const [display, setDisplay] = useState('mean');

  // Filter data by selected residues
  const {
    heatmapData,
    residuesX,
    residuesY,
    xTitle,
    yTitle,
    isReduced,
  } = useMemo(() => {
    // Return if the dataset is not ready
    if (!dataset || !topology) return {};

    // Set the data to be displayed
    const displayedData = display === 'mean' ? dataset.means : dataset.stdvs;

    // Find out if the analysis contains data for all residues or just the interface residues
    // It may happen in large interactions that only interface residues are saved in order to reduce data size
    // WARNING: We must check both data dimensions
    // WARNING: it may happen that one agent has the same number of total and interface residues
    let isReduced;
    const xDim = displayedData[0].length;
    const yDim = displayedData.length;
    if (
      yDim === interaction['residue_indices_2'].length &&
      xDim === interaction['residue_indices_1'].length
    )
      isReduced = false;
    else if (
      yDim === interaction['interface_indices_2'].length &&
      xDim === interaction['interface_indices_1'].length
    )
      isReduced = true;
    else throw new Error(
      `The numbers of values in data does not match any number of residues in the interaction (neither all or interface)`,
    );

    // Select the interaction residues whosa data is to be represented in the heatmap
    const residuesX = interaction[selectedResidues + '_1'];
    const residuesY = interaction[selectedResidues + '_2'];

    // Set data to be represented in the heatmap
    let filteredData = [];
    // If we have a reduced dataset
    if (isReduced) {
      // If interface residues are requested then we return the whole dataset
      if (selectedResidues === 'interface_indices') {
        filteredData = displayedData;
      }
      // If all residues are requested then we must build a new matrix and fill the gaps with 'null' values
      // WARNING: Although this has been programmed, the button tu do this should be disabled from the client
      // WARNING: This code is functional but it should never be called or you may run out of memory
      // WARNING: If you allow to represent a whole heatmap for a reduced analysis you may be trying to build a huge heatmap
      else {
        const interfaceResiduesX = interaction['interface_indices_1'];
        const interfaceResiduesY = interaction['interface_indices_2'];
        for (const y of residuesY) {
          const yIndex = interfaceResiduesY.indexOf(y);
          let newRow;
          // If the index is not in the interface then the whole row is full of nulls
          if (yIndex === -1) {
            const XResiduesCount = residuesX.length;
            newRow = new Array(XResiduesCount).fill(10);
            filteredData.push(newRow);
            continue;
          }
          // Otherwise, we must check each column value
          newRow = [];
          for (const x of residuesX) {
            const xIndex = interfaceResiduesX.indexOf(x);
            if (xIndex === -1) {
              newRow.push(10);
              continue;
            }
            newRow.push(displayedData[yIndex][xIndex]);
          }
          filteredData.push(newRow);
        }
      }
    }
    // If we have the full dataset
    else {
      // If all residues are requested then we return all data
      if (selectedResidues === 'residue_indices') {
        filteredData = displayedData;
      }
      // If interface residues are requested then we must filter interface resdiues only
      else {
        const allResiduesX = interaction['residue_indices_1'];
        const allResiduesY = interaction['residue_indices_2'];
        for (const y of residuesY) {
          const yIndex = allResiduesY.indexOf(y);
          const newRow = [];
          for (const x of residuesX) {
            const xIndex = allResiduesX.indexOf(x);
            newRow.push(displayedData[yIndex][xIndex]);
          }
          filteredData.push(newRow);
        }
      }
    }

    // Convert the residues from topology numeration to standard numeration to use them as labels
    const [xLabels, yLabels] = [residuesX, residuesY].map(residueIndices =>
      residueIndices.map(residueIndex => topology.getResidueByIndex(residueIndex).standardLabel),
    );

    // Get the titles from the interaction data
    const xTitle = interaction['agent_1'];
    const yTitle = interaction['agent_2'];

    // Get the object to be passed to the heatmap as input
    const heatmapData = { data: filteredData, xLabels, yLabels };

    return {
      heatmapData,
      residuesX,
      residuesY,
      xTitle,
      yTitle,
      isReduced,
    };
  }, [
    dataset,
    topology,
    selectedResidues,
    display,
  ]);

  // Transform the raw reside tag to source numeration
  // Also retrieve the residue index, since it is used to ask for the distance representation
  // http://nglviewer.org/ngl/api/class/src/representation/distance-representation.js~DistanceRepresentation.html
  const parseResidue = useCallback(
    residueIndex => {
      // Set the numeration
      const residue = topology.getResidueByIndex(residueIndex);
      return {
        forResidue: residueIndex,
        // We must check the residue has an alpha carbon
        // If not, there is no atom to use a distance reference, so return null
        forDistance: residue.hasCAlpha
          ? residue.number.toString() + ':' + residue.chainName + '.CA'
          : null,
      };
    },
    [topology],
  );

  // The selected heatmap residues
  const [selected, setSelected] = useState(null);

  // Memoize heatmap handler functions
  const handleHeatmapTooltip = useCallback(
    ({ value, xAxisValue, yAxisValue }) =>
      xAxisValue +
      ' - ' +
      yAxisValue +
      '\n' +
      Math.round(value * 100) / 100 +
      ' Å',
    [],
  );
  const handleHeatmapClick = useCallback(
    ({ xIndex, yIndex }) => {
      const px = parseResidue(residuesX[xIndex]);
      const py = parseResidue(residuesY[yIndex]);
      setSelected({
        residues: [px.forResidue, py.forResidue],
        // There is no values "for distance" when any residues has no alpha carbon
        distance: px.forDistance &&
          py.forDistance && [[px.forDistance, py.forDistance]],
      });
    },
    [residuesX, residuesY, parseResidue],
  );

  // Check if anything is still beeing loaded
  const anyLoading = isIndexLoading || isAnalysisLoading || isProjectLoading;

  // Render loading or error messages according with the API response
  if (indexError) return indexError.toString();
  if (error) return error.toString();
  if (dataset && dataset.error) return dataset.error;
  if (!dataset) {
    if (anyLoading) return <Loading />;
    if (!interactions) return 'There are no interactions';
    if (!topology) return 'There is no topology';
    return 'Something bad happened with the analysis data';
  }

  // Handles when the tabs are switched
  const handleTabs = (event, newValue) => {
    setDisplay(newValue);
  };

  // Render
  return (
    <>
      <Card>
        <CardContent className={style.horizontal}>
          <Typography variant="h6">Residues selection:</Typography>
          <InteractionSelector
            interactions={interactions}
            selectedInteraction={selectedInteraction}
            setSelectedInteraction={setSelectedInteraction}
            selectedResidues={selectedResidues}
            setSelectedResidues={setSelectedResidues}
            interfaceOnly={isReduced}
          />
        </CardContent>
      </Card>
      <div className={anyLoading ? style.disabled : style.enabled}>
        <Card className={style.margined} id="heatmap">
          <CardContent>
            <Tabs
              value={display}
              variant="fullWidth"
              indicatorColor="primary"
              textColor="primary"
              onChange={handleTabs}
              className={style['margined-bottom']}
            >
              <Tab
                value={'mean'}
                label="Residues distance averages"
                //className={style['disabled-tab']}
              />
              <Tab value={'stdv'} label="Residues distance standard deviations" />
            </Tabs>
            <Heatmap
              inputData={heatmapData}
              onTooltip={handleHeatmapTooltip}
              onClick={handleHeatmapClick}
              legendTitle={
                display === 'mean'
                  ? 'Distance average (Å)'
                  : 'Distance standard deviation (Å)'
              }
              // Invert colors here, since minimum values belong to closer residues
              maxValueColor={heatmapMinimumColor}
              minValueColor={heatmapMaximumColor}
              totalHeight={heatmapData.yLabels.length === 1 ? 30 : undefined}
              xTitle={xTitle}
              yTitle={yTitle}
            />
          </CardContent>
        </Card>
      </div>
      
      <ViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          selected
            ? {
                selectedResidueIndices: selected.residues,
                // WARNING: Distance is not always available
                // This only works when both residues have alpha carbon
                // (i.e. both are protein residues)
                selectedDistances: selected.distance,
              }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelected(previous => {
            if (previous && previous.residues === viewer.selectedResidueIndices)
              return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelected(previous => {
            if (previous && previous.residues === viewer.selectedResidueIndices)
              return null;
            else return previous;
          })
        }
      />
    </>
  );
};

export default DistPerres;
