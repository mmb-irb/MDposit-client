import React, { useContext, useState, useMemo } from 'react';

import { CardContent, Tabs, Tab, Typography } from '@material-ui/core';

import useAPI from '../../../hooks/use-api';

import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';

import { AccessionCtx, ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

//import Selector from '../../../components/selector';
import InteractionSelector from '../../../components/interaction-selector';
import Heatmap from '../../../components/heatmap';

import style from './style.module.css';

// Distance per residue analysis
const DistPerres = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project data
  const projectData = useContext(ProjectCtx);

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
  const url = `${BASE_PATH_PROJECTS}${accession}/analyses/dist-perres/`;

  const { loading, payload, error } = useAPI(url);

  // Filter data by selected residues
  const filteredData = useMemo(() => {
    // Return if the payload is not ready
    if (loading || error || !payload) return;
    const { topology: topologyManager, interactions } = projectData;

    // Get the selected interaction
    const interaction = interactions[selectedInteraction];

    // Get the data whose name matches the interaction name
    const data = payload.data.find(dataset => {
      return dataset.name === interaction.name;
    });

    const residuesX = interaction[selectedResidues + '_1'];
    const residuesY = interaction[selectedResidues + '_2'];

    let means = [];
    let stdvs = [];
    if (selectedResidues === 'residue_indices') {
      means = data.means;
      stdvs = data.stdvs;
    } else {
      const allResiduesX = interaction['residue_indices_1'];
      const allResiduesY = interaction['residue_indices_2'];
      for (const y of residuesY) {
        const yIndex = allResiduesY.indexOf(y);
        const newMeansRow = [];
        const newStdvsRow = [];
        for (const x of residuesX) {
          const xIndex = allResiduesX.indexOf(x);
          newMeansRow.push(data.means[yIndex][xIndex]);
          newStdvsRow.push(data.stdvs[yIndex][xIndex]);
        }
        means.push(newMeansRow);
        stdvs.push(newStdvsRow);
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

    return {
      mean: means,
      stdv: stdvs,
      residuesX,
      residuesY,
      xLabels,
      yLabels,
      xTitle,
      yTitle,
    };
  }, [
    loading,
    error,
    payload,
    projectData,
    selectedInteraction,
    selectedResidues,
  ]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!projectData) return <Loading />;

  // handles when the tabs are switched
  const handleTabs = (event, newValue) => {
    setDisplay(newValue);
  };

  // Transform the raw reside tag to source numeration
  // Also retrieve the absolute residue number, since it is used to ask for the distance representation
  // http://nglviewer.org/ngl/api/class/src/representation/distance-representation.js~DistanceRepresentation.html
  const parseResidue = residue => {
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
            inputData={{
              data: filteredData[display],
              xLabels: filteredData['xLabels'],
              yLabels: filteredData['yLabels'],
            }}
            onTooltip={({ value, xAxisValue, yAxisValue }) =>
              xAxisValue +
              ' - ' +
              yAxisValue +
              '\n' +
              Math.round(value * 100) / 100 +
              ' Å'
            }
            onClick={({ xIndex, yIndex }) => {
              const px = parseResidue(filteredData.residuesX[xIndex]);
              const py = parseResidue(filteredData.residuesY[yIndex]);
              setSelected({
                residues: [px.forResidue, py.forResidue],
                // There is no values "for distance" when any residues has no alpha carbon
                distance: px.forDistance &&
                  py.forDistance && [[px.forDistance, py.forDistance]],
              });
            }}
            legendTitle={
              display === 'mean'
                ? 'Distance average (Å)'
                : 'Distance standard deviation (Å)'
            }
            // Invert colors here, since minimum values belong to closer residues
            maxValueColor={{ r: 0, g: 0, b: 255 }}
            minValueColor={{ r: 255, g: 0, b: 0 }}
            totalHeight={filteredData['yLabels'].length === 1 ? 30 : undefined}
            xTitle={filteredData['xTitle']}
            yTitle={filteredData['yTitle']}
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
