import React, { useContext, useState, useMemo, useRef } from 'react';

import { CardContent, Chip, Typography } from '@mui/material';

import useAPI from '../../../hooks/use-api';

import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import ViewerSpawner from '../../../components/viewer-spawner';
import useDefaultRepresentations from '../../../components/ngl-viewer/use-default-representations';

import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

import InteractionSelector from '../../../components/interaction-selector';
import Heatmap from '../../../components/heatmap';

// Keep constant representation references to keep them between renders
const REPRESENTATION_REFERENCES = {
  base: ['First frame', 'Second frame'],
  interface: ['First frame interface', 'Second frame interface']
}

// Set the representation colors
const REPRESENTATION_COLORS = {
  base: ['red', 'blue'],
  interface: [
    ['orange', 'yellow'], // Agent 1
    ['purple', 'green'], // Agent 2
  ] 
}

const RmsdPairwise = () => {
  // Get the current project data
  const {
    accessionAndMdNumber,
    metadata,
    interactions: defaultInteractions,
    topology: topologyManager,
  } = useContext(ProjectCtx);

  // Set a ref to the ngl which allows access to the ngl viewer exposed methods
  const viewerRef = useRef(null);
  // Get the default representations
  const defaultRepresentations = useDefaultRepresentations();
  // The selected frames
  const [selectedFramePair, setSelectedFramePair] = useState(null);
  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);
  // Get analysis data from the API
  const url = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/rmsd-pairwise/`;
  const { loading, payload, error } = useAPI(url);
  // Set the available interactions
  const interactions = useMemo(() => {
    if (!defaultInteractions) return [{ name: 'Overall' }];
    // Label all metadata interactions with the 'interface residues' ending
    defaultInteractions.forEach(interaction => {
      interaction.label = interaction.name + ' (interface residues)';
    });
    const interactions = [{ name: 'Overall' }, ...defaultInteractions];
    return interactions;
  }, [defaultInteractions]);
  // Process analysis data for the heatmap
  const { rmsds, AxesValues } = useMemo(() => {
    // Return if the payload is not ready
    if (!payload) return {};
    // Get the selected interaction
    const interaction = interactions[selectedInteraction];
    // Get the data whose name matches the interaction name
    const data = payload.data.find(dataset => dataset.name === interaction.name);
    if (!data) throw new Error(`Dataset for interaction "${interaction.name}" not found`);
    // Get the rmsds values
    const rmsds = data.rmsds;
    // Calculate the step
    // DANI: Esto no es del todo correcto pero hace que los números de frames siempre cuadren
    const dataLength = rmsds.length;
    const AxesStep = Math.floor(metadata.mdFrames / (dataLength - 1));
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

  // Set the component state
  const [components, setComponents] = useState(null);

  // Set the components value
  useMemo(() => {
    // If there is no selected pair then set the components as null
    if (!selectedFramePair) return setComponents(null);
    // If a frame pair is selected then set the components or update them accordingly
    setComponents(previousComponents => {
      // If there are no previous components then set them from scratch
      if (previousComponents === null) {
        return selectedFramePair.map(frame => ({
          name: `Frame ${frame}`,
          frame: frame
        }));
      }
      // If components already exists then just update them
      selectedFramePair.forEach((frame, index) => {
        const previousComponent = previousComponents[index];
        previousComponent.name = `Frame ${frame}`;
        previousComponent.frame = frame;
      });
      return [...previousComponents];
    });
  }, [selectedFramePair]);

  // Set the component state
  const [representations, setRepresentations] = useState(null);

  // Set the viewer representations
  useMemo(() => {
    // If there are no components then clear the representations and stop here
    if (!components) return setRepresentations(null);
    // Get the selected interaction
    const interaction = interactions[selectedInteraction];
    // Get also the number of the interacting agents
    const agents = [
      { name: interaction.agent_1, interface: interaction.interface_indices_1 },
      { name: interaction.agent_2, interface: interaction.interface_indices_2 }
    ];
    // Setup every representation or update the already existing ones
    setRepresentations(previousRepresentations => {
      // Set a list to keep updated representations
      const newRepresentations = [];
      // Find out if there is a selected interaction
      const currentInteraction = selectedInteraction > 0;
      // Find out if there was a selected interaction in the previous representations
      const previousInteraction = !!(previousRepresentations && previousRepresentations.find(
        rep => rep.reference && rep.reference.includes(REPRESENTATION_REFERENCES.interface[0])));
      // Check if there was interactions in the previous
      // If there were no previous representations then set the default values
      if (previousRepresentations === null) {
        components.forEach((component, index) => {
          // Set the overall representations
          // In case there is no interaction selected this would be opaque
          // In case there is an interaction selected this would be transparent (just a reference)
          defaultRepresentations.forEach(representation => {
            const newRepresentation = { ...representation };
            newRepresentation.name = `${component.name} - ${representation.name}`;
            newRepresentation.color = REPRESENTATION_COLORS.base[index];
            newRepresentation.component = component.name;
            newRepresentation.reference = `${REPRESENTATION_REFERENCES.base[index]} - ${representation.name}`;
            if (currentInteraction) {
              newRepresentation.name += ' reference';
              newRepresentation.opacity = 0.1;
            }
            newRepresentations.push(newRepresentation);
          });
        });
      }
      // If representations already exist then update them
      else {
        components.forEach((component, index) => {
          // Iterate the default representations
          defaultRepresentations.forEach(representation => {
            // Find the previous corresponding representation
            const reference = `${REPRESENTATION_REFERENCES.base[index]} - ${representation.name}`;
            const previousRepresentation = previousRepresentations.find(rep => rep.reference === reference);
            if (!previousRepresentation) throw new Error(`No previous representation with reference ${reference}`);
            // Update the representation name and component
            const previousComponentName = previousRepresentation.name.split(' - ')[0];
            previousRepresentation.name = previousRepresentation.name.replace(previousComponentName, component.name);
            previousRepresentation.component = component.name;
            // Add or remove the 'reference' tail from the name and update the opacity
            // If we passed from no selected interaction to selected interaction
            if (currentInteraction && !previousInteraction) {
              previousRepresentation.name += ' reference';
              previousRepresentation.opacity = 0.1;
            }
            // If we passed from selected interaction to no selected interaction
            if (!currentInteraction && previousInteraction) {
              previousRepresentation.name = previousRepresentation.name.replace(' reference', '');
              previousRepresentation.opacity = 1;
            }
            newRepresentations.push(previousRepresentation);
          });
        });
      }
      // Set interfaces representations, each with different colors
      if (currentInteraction) {
        // If we did not have a selected interaction then setup representations with default values
        if (previousInteraction === false) {
          components.forEach((component, index) => {
            agents.forEach((agent, agentIndex) => {
              // Get the interaction interface, if it exists, in NGL format
              // The default interaction (Overall) has no interface
              const selection = agent.interface && topologyManager.residueIndices2Ngl(agent.interface);
              // Set the new representation
              newRepresentations.push({
                name: `${component.name} - ${agent.name} interface`,
                color: REPRESENTATION_COLORS.interface[index][agentIndex],
                selection: selection.rangedSelection,
                type: 'licorice',
                component: component.name,
                reference: `${REPRESENTATION_REFERENCES.interface[index]} - ${agent.name}`
              });
            });
          });
        }
        // Otherwise update the already existing representations
        else {
          components.forEach((component, index) => {
            agents.forEach(agent => {
              // Get the interaction interface, if it exists, in NGL format
              // The default interaction (Overall) has no interface
              const selection = agent.interface && topologyManager.residueIndices2Ngl(agent.interface);
              // Find the previous representation for interface 1
              const reference = `${REPRESENTATION_REFERENCES.interface[index]} - ${agent.name}`;
              const previousRepresentation = previousRepresentations.find(
                rep => rep.reference === reference
              );
              // Update its name, selection and component
              previousRepresentation.name = `${component.name} - ${agent.name} interface`;
              previousRepresentation.selection = selection.rangedSelection;
              previousRepresentation.component = component.name;
              newRepresentations.push(previousRepresentation);
            });
          });
        }
      }
      // Add previous custom representations (added by the user)
      previousRepresentations && previousRepresentations.filter(rep => rep.custom)
        .forEach(representation => {
          // Update the component to target the first component
          representation.component = components[0].name;
          newRepresentations.push(representation);
        });
      // Update the representations state
      return newRepresentations;
    });
  }, [
    components,
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
          {selectedFramePair && (
            <div>
              {components && components.map((component, c) => (
                <Chip key={c} label={'Frame ' + component.frame}
                  style={{
                    margin: '0.2em',
                    backgroundColor: c === 0 ? 'red' : 'blue',
                  }}
                />
              ))}
              {selectedInteraction > 0 && components && components.map((component, c) => {
                  // Get the interacting agents
                  const interaction = interactions[selectedInteraction];
                  const agents = [ interaction.agent_1, interaction.agent_2 ];
                  // Generate a chip for every agent
                  return agents.map((agent, a) => (
                    <Chip key={a} label={'Frame ' + component.frame + ' - ' + agent}
                      style={{
                        margin: '0.2em',
                        backgroundColor: a === 0
                          ? c === 0
                            ? 'orange'
                            : 'purple'
                          : c === 0
                            ? 'yellow'
                            : 'green',
                      }}
                    />
                  ));
                }
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
              `${xAxisValue} - ${yAxisValue}\n${Math.round(value * 100) / 100} Å`
            }
            onClick={({ xAxisValue, yAxisValue }) =>
              setSelectedFramePair([xAxisValue, yAxisValue])
            }
            legendTitle={'RMSD (Å)'}
            maxColor={'red'}
            minColor={'blue'}
            xTitle={'Frames'}
            yTitle={'Frames'}
          />
        </CardContent>
      </Card>
      <ViewerSpawner
        // Set a viewer if there is selected frames
        newViewer={components
          ? {
              componentsState: [components, setComponents],
              representationsState: [representations, setRepresentations],
              selRef: selectedFramePair,
              viewerRef: viewerRef
            }
          : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelectedFramePair(previous => {
            if (viewer.selRef === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelectedFramePair(previous => {
            if (viewer.selRef === previous) return null;
            else return previous;
          })
        }
      />
    </>
  );
};

export default RmsdPairwise;
