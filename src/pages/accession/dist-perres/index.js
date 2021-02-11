import React, { useContext, useState, useMemo } from 'react';

import { CardContent, Tabs, Tab, Typography } from '@material-ui/core';

import useAPI from '../../../hooks/use-api';

import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';

import { AccessionCtx, ProjectCtx, PdbCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import {
  complexNumerationParser,
  nglNumerationParser,
  source2modelResidue,
  model2sourceResidue,
} from '../../../utils/topology-manager';

import Info from '../../../components/info';
//import Selector from '../../../components/selector';
import InteractionSelector from '../../../components/interaction-selector';
import Heatmap from '../../../components/heatmap';

import style from './style.module.css';

// Distance per residue analysis
const DistPerres = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project chains and metadata
  const { metadata } = useContext(ProjectCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // The interaction residues to be displayed
  // May be all 'residues' or only the 'interface' residues
  const [selectedResidues, setSelectedResidues] = useState('interface');

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

    // Get the selected interaction
    const interaction = metadata.INTERACTIONS[selectedInteraction];

    // Get the data whose name matches the interaction name
    const data = payload.data.find(dataset => {
      return dataset.name === interaction.name;
    });

    const residuesX = interaction[selectedResidues + '_1'];
    const residuesY = interaction[selectedResidues + '_2'];

    let means = [];
    let stdvs = [];
    if (selectedResidues === 'residues') {
      means = data.means;
      stdvs = data.stdvs;
    } else {
      const allResiduesX = interaction['residues_1'];
      const allResiduesY = interaction['residues_2'];
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

    // Convert the residues from topology numeration to model numeration to use them as labels
    const xLabels = residuesX.map(lab => {
      const numeration = complexNumerationParser(lab);
      const mod = source2modelResidue(numeration, pdbData.file);
      return mod.ngl;
    });
    const yLabels = residuesY.map(lab => {
      const numeration = complexNumerationParser(lab);
      const mod = source2modelResidue(numeration, pdbData.file);
      return mod.ngl;
    });

    // Get the titles from the interaction data
    const xTitle = interaction['agent_1'];
    const yTitle = interaction['agent_2'];

    return {
      mean: means,
      stdv: stdvs,
      xLabels,
      yLabels,
      xTitle,
      yTitle,
    };
  }, [
    loading,
    error,
    payload,
    pdbData,
    metadata,
    selectedInteraction,
    selectedResidues,
  ]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!pdbData.file) return <Loading />;

  // handles when the tabs are switched
  const handleTabs = (event, newValue) => {
    setDisplay(newValue);
  };

  // Transform the model numeration in a single string format (e.g. 'B:1') to source numeration
  // Also retrieve the absolute residue number, since it is used to ask for the distance representation
  const parseLabel = label => {
    const num = nglNumerationParser(label);
    const source = model2sourceResidue(num, pdbData.file);
    return {
      forResidue: source.numeration,
      forDistance: source.residueNumber.toString() + '.CA',
    };
  };

  // Render
  return (
    <>
      <Card>
        <Info
          reference={'dist-perres-selector'}
          tooltip={
            <>
              This is the residues selector.
              <br />
              <br />
              Use this panel to select which residues are displayed in the
              heatmap below. Some default residue groups are provided by the
              authors (e.g. interface residues between two proteins).
            </>
          }
        />
        <CardContent className={style.horizontal}>
          <Typography variant="h6">Residues selection:</Typography>
          <InteractionSelector
            interactions={metadata.INTERACTIONS}
            selectedInteraction={selectedInteraction}
            setSelectedInteraction={setSelectedInteraction}
            selectedResidues={selectedResidues}
            setSelectedResidues={setSelectedResidues}
          />
        </CardContent>
      </Card>
      <Card className={style.margined} id="heatmap">
        <Info
          reference={'dist-perres-heatmap'}
          tooltip={
            <>
              This is the distance per residue representation.
              <br />
              <br />
              This heatmap represents the distance between the geometric center
              of selected residues from different molecules. Both horizontal and
              vertical edges stand for residue numbers. The color stands for the
              distance and it ranges from blue (far) to red (close). The legend
              below shows the corresponding values in Ångstroms.
              <br />
              <br />
              Use tabs over the heatmap to switch between mean and standard
              deviation.
              <br />
              <br />
              <span style={{ color: 'lightGreen' }}> Click any cell </span>
              on the heatmap to open an interactive window displaying the
              trajectory with the corresponding highlighted residues.
            </>
          }
        />
        <CardContent>
          <Tabs
            value={display}
            variant="fullWidth"
            indicatorColor="secondary"
            textColor="secondary"
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
            onClick={(x, y) => {
              const px = parseLabel(x);
              const py = parseLabel(y);
              setSelected({
                residues: [px.forResidue, py.forResidue],
                distance: [[px.forDistance, py.forDistance]],
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
                selectedResidues: selected.residues,
                // DANI: Las representación de las distancias queda suspendida temporalmente
                // DANI: Es un percal. Solo se puede hacer con átomos, no con residuos.
                // DANI: Tal y como está ahora solo funcionaría para distancias entre 2 proteínas
                // DANI: Y posiblemente ni eso. Depende de la topología.
                //selectedDistances: selected.distance,
              }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelected(previous => {
            if (viewer.selectedResidues === previous.residues) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelected(previous => {
            if (viewer.selectedResidues === previous.residues) return null;
            else return previous;
          })
        }
      />
    </>
  );
};

export default DistPerres;
