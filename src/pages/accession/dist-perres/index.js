import React, { useContext, useState, useMemo, useCallback } from 'react';

import { CardContent, Tabs, Tab, Typography } from '@mui/material';

import useAPI from '../../../hooks/use-api';

import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';

import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

//import Selector from '../../../components/selector';
import InteractionSelector from '../../../components/interaction-selector';
import Heatmap from '../../../components/heatmap';

import style from './style.module.css';

// Set the heatmap minimum and maximum colors
const heatmapMinimumColor = { r: 0, g: 0, b: 255 };
const heatmapMaximumColor = { r: 255, g: 0, b: 0 };

// Distance per residue analysis
const DistPerres = () => {
  // Get the current project data
  const projectData = useContext(ProjectCtx);
  const accession = projectData.accession;
  const accessionAndMdNumber = projectData.accessionAndMdNumber;

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // The interaction residues to be displayed
  // May be all 'residue_indices' or only the 'interface_indices'
  const [selectedResidues, setSelectedResidues] = useState('interface_indices');

  // The selected heatmap residues
  const [selected, setSelected] = useState(null);

  // The graphic to be displayed ('mean' or 'stdv')
  const [display, setDisplay] = useState('mean');

  // Set the API url for the heatmap data
  const url = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/dist-perres/`;

  const { loading, payload, error } = useAPI(url);

  // Filter data by selected residues
  const {
    heatmapData,
    residuesX,
    residuesY,
    xTitle,
    yTitle,
    isReduced,
  } = useMemo(() => {
    // Return if the payload is not ready
    if (loading || error || !payload) return {};
    const { topology: topologyManager, interactions } = projectData;

    // Get the selected interaction
    const interaction = interactions[selectedInteraction];

    // Get the data whose name matches the interaction name
    const data = payload.data.find(dataset => {
      return dataset.name === interaction.name;
    });

    // Set the data to be displayed
    const displayedData = display === 'mean' ? data.means : data.stdvs;

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
    else
      throw new Error(
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
    const [xLabels, yLabels] = [residuesX, residuesY].map(residues =>
      residues.map(residue => {
        const { label } = topologyManager.absolute2standard(residue);
        return label;
      }),
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
    loading,
    error,
    payload,
    projectData,
    selectedInteraction,
    selectedResidues,
    display,
  ]);

  // Transform the raw reside tag to source numeration
  // Also retrieve the absolute residue number, since it is used to ask for the distance representation
  // http://nglviewer.org/ngl/api/class/src/representation/distance-representation.js~DistanceRepresentation.html
  const parseResidue = useCallback(
    residue => {
      // We must check the residue has an alpha carbon
      // If not, there is no atom to use a distance reference, so return null
      const hasCA = projectData.topology.residueHasCAlpha(residue);
      // Set the numeration
      const source = projectData.topology.absolute2sourceResidue(residue);
      return {
        forResidue: residue,
        forDistance: hasCA
          ? source.residue.toString() + ':' + source.chain + '.CA'
          : null,
      };
    },
    [projectData],
  );

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

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!projectData) return <Loading />;

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
            interactions={projectData.interactions}
            selectedInteraction={selectedInteraction}
            setSelectedInteraction={setSelectedInteraction}
            selectedResidues={selectedResidues}
            setSelectedResidues={setSelectedResidues}
            interfaceOnly={isReduced}
          />
        </CardContent>
      </Card>
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
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          selected
            ? {
                accession: accession,
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
