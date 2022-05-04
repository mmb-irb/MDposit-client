import React, { useContext, useState, useMemo } from 'react';

import { CardContent, Chip, Typography } from '@material-ui/core';

import useAPI from '../../../hooks/use-api';

import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';

import { AccessionCtx, ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

import InteractionSelector from '../../../components/interaction-selector';
import Heatmap from '../../../components/heatmap';

const RmsdPairwise = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project data
  const {
    metadata,
    interactions: defaultInteractions,
    topology: topologyManager,
  } = useContext(ProjectCtx);

  // Get the default representations
  const defaultRepresentations = useDefaultRepresentations();

  // The selected frames
  const [selected, setSelected] = useState(null);

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // Set the API url for the heatmap data
  const url = `${BASE_PATH_PROJECTS}${accession}/analyses/rmsd-pairwise/`;

  const { loading, payload, error } = useAPI(url);

  const interactions = useMemo(() => {
    if (!defaultInteractions) return [{ name: 'Overall' }];
    // Label all metadata interactions with the 'interface residues' ending
    defaultInteractions.forEach(interaction => {
      interaction.label = interaction.name + ' (interface residues)';
    });
    const interactions = [{ name: 'Overall' }, ...defaultInteractions];
    return interactions;
  }, [defaultInteractions]);

  const { rmsds, AxesValues } = useMemo(() => {
    // Return if the payload is not ready
    if (!payload) return {};

    // Get the selected interaction
    const interaction = interactions[selectedInteraction];

    // Get the data whose name matches the interaction name
    const data = payload.data.find(dataset => {
      return dataset.name === interaction.name;
    });
    if (!data)
      return `Dataset for the interaction "${interaction.name}" not found`;

    // Get the rmsds values
    const rmsds = data.rmsds;

    // Calculate the step
    // DANI: Esto no es del todo correcto pero hace que los números de frames siempre cuadren
    const dataLength = rmsds.length;
    const AxesStep = Math.floor(metadata.SNAPSHOTS / (dataLength - 1));

    // DANI: Esto es lo correcto
    // DANI: En algunos análisis antiguos las frames no cuadran y hay que rehacerlos
    //const xAxesStep = payload.step;

    // Calculate the frames labels
    // These values are used for BOTH axes
    const AxesValues = Array(dataLength)
      .fill(undefined)
      .map((v, i) => i * AxesStep);

    return { rmsds, AxesValues };
  }, [payload, metadata, interactions, selectedInteraction]);

  // Set the frames to be represented in the NGL viewer
  const { components, agent1, agent2 } = useMemo(() => {
    if (!selected) return {};

    // Get the selected interaction
    const interaction = interactions[selectedInteraction];
    // Get the interaction interface, if it exists, in NGL format
    // The default interaction (Overall) has no interface
    const interactionInterface1 =
      interaction.interface_indices_1 &&
      interaction.interface_indices_1
        .map(
          res =>
            '(' +
            topologyManager.absolute2sourceResidue(res).nglSelection +
            ')',
        )
        .join(' or ');

    const interactionInterface2 =
      interaction.interface_indices_2 &&
      interaction.interface_indices_2
        .map(
          res =>
            '(' +
            topologyManager.absolute2sourceResidue(res).nglSelection +
            ')',
        )
        .join(' or ');
    // Get also the number of the interacting agents
    const agent1 = interaction.agent_1;
    const agent2 = interaction.agent_2;

    const components = [];
    selected.forEach((frame, index) => {
      const representations = [];
      // Set the overall representations
      // In case there is no interaction selected this would be opaque
      // In case there is an interaction selected this would be transparent (just a reference)
      defaultRepresentations.forEach(representation => {
        const newRepresentation = { ...representation };
        newRepresentation.name =
          'Frame ' + frame + ' - ' + newRepresentation.name;
        newRepresentation.color = index === 0 ? 'red' : 'blue';
        if (selectedInteraction > 0) {
          newRepresentation.name += ' reference';
          newRepresentation.opacity = 0.1;
        }
        representations.push(newRepresentation);
      });
      // Set both interfaces representations, each with different colors
      if (selectedInteraction > 0) {
        const interface1Representation = {
          name: 'Frame ' + frame + ' - ' + agent1 + ' interface',
          color: index === 0 ? 'orange' : 'purple',
          selection: interactionInterface1,
          type: 'licorice',
        };
        const interface2Representation = {
          name: 'Frame ' + frame + ' - ' + agent2 + ' interface',
          color: index === 0 ? 'yellow' : 'green',
          selection: interactionInterface2,
          type: 'licorice',
        };
        representations.push(
          interface1Representation,
          interface2Representation,
        );
      }

      components.push({
        frame: frame,
        representations: representations,
      });
    });

    return { components, agent1, agent2 };
  }, [
    selected,
    topologyManager,
    interactions,
    selectedInteraction,
    defaultRepresentations,
  ]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

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
          />
          {selected && (
            <div>
              {components.map((component, c) => (
                <Chip
                  key={c}
                  label={'Frame ' + component.frame}
                  style={{
                    backgroundColor: c === 0 ? 'red' : 'blue',
                    margin: '0.2em',
                  }}
                />
              ))}
              {selectedInteraction > 0 &&
                components.map((component, c) =>
                  [agent1, agent2].map((agent, a) => (
                    <Chip
                      key={a}
                      label={'Frame ' + component.frame + ' - ' + agent}
                      style={{
                        backgroundColor:
                          a === 0
                            ? c === 0
                              ? 'orange'
                              : 'purple'
                            : c === 0
                            ? 'yellow'
                            : 'green',
                        margin: '0.2em',
                      }}
                    />
                  )),
                )}
            </div>
          )}
        </CardContent>
      </Card>
      <Card className={style.margined} id="heatmap">
        <CardContent>
          <Heatmap
            inputData={{
              data: rmsds,
              xLabels: AxesValues,
              yLabels: AxesValues,
            }}
            onTooltip={({ value, xAxisValue, yAxisValue }) =>
              xAxisValue +
              ' - ' +
              yAxisValue +
              '\n' +
              Math.round(value * 100) / 100 +
              ' Å'
            }
            onClick={({ xAxisValue, yAxisValue }) =>
              setSelected([xAxisValue, yAxisValue])
            }
            legendTitle={'RMSD (Å)'}
            maxColor={'red'}
            minColor={'blue'}
            xTitle={'Frames'}
            yTitle={'Frames'}
          />
        </CardContent>
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          selected
            ? {
                accession: accession,
                components: components,
                selRef: selected,
              }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelected(previous => {
            if (viewer.selRef === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelected(previous => {
            if (viewer.selRef === previous) return null;
            else return previous;
          })
        }
      />
    </>
  );
};

export default RmsdPairwise;
