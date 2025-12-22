import React, { useContext, useState, useMemo, useRef } from 'react';

import { CardContent, Chip, Typography } from '@mui/material';

import useAPI from '../../../hooks/use-api';
import useRemfo from 'src/hooks/use-remfo';

import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import ViewerSpawner from '../../../components/viewer-spawner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

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
    topology,
    loading: isProjectLoading,
  } = useContext(ProjectCtx);

  // Set a ref to the ngl which allows access to the ngl viewer exposed methods
  const viewerRef = useRef(null);

  // Set the available interactions
  // Add the 'overall' option at the beginning, as a 'no interaction' option
  const interactions = useMemo(() => {
    if (!defaultInteractions) return [{ name: 'Overall' }];
    // Label all metadata interactions with the 'interface residues' ending
    defaultInteractions.forEach(interaction => {
      interaction.label = interaction.name + ' (interface residues)';
    });
    const interactions = [{ name: 'Overall' }, ...defaultInteractions];
    return interactions;
  }, [defaultInteractions]);

  // Send a request to the API with the url of the analyses index
  const analysesUrlBase = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses`;
  const indexUrl = `${analysesUrlBase}/rmsd-pairwise`;
  const { loading: isIndexLoading, payload: indexPayload, error: indexError } = useAPI(indexUrl);

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // The newest format has 4 fields: acceptors, donors, hydrogens and hbonds
  // The hbonds includes arrays of true and false per frame
  const interaction = interactions && interactions[selectedInteraction];

  // Get analysis data from the API
  // Set the target interaction name
  const { interactionName, analysisName, analysisNote } = useMemo(() => {
    // Wait for main data to be downloaded
    if (!interaction || !indexPayload) return {};
    // Check if the analysis is in the old or the new format
    const isOld = indexPayload.data !== undefined;
    // If so, there is no target analysis name, but the whole data is already in the payload
    if (isOld) return { interactionName: interaction.name };
    const targetEntry = indexPayload.find(entry => entry.name === interaction.name);
    return {
      interactionName: interaction.name,
      analysisName: targetEntry.analysis,
      // Notes are very exceptional, but some analyses may have
      analysisNote: targetEntry.note
    };
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

  // Process analysis data for the heatmap
  const { rmsds, AxesValues } = useMemo(() => {
    // Return if the dataset is not ready
    if (!dataset) return {};
    // Get the rmsds values
    const rmsds = dataset.rmsds;
    // Calculate the step
    // DANI: Esto no es del todo correcto pero hace que los números de frames siempre cuadren
    const dataLength = rmsds.length;
    const AxesStep = Math.floor(metadata.mdFrames / (dataLength - 1));
    // DANI: Esto es lo correcto
    // DANI: En algunos análisis antiguos las frames no cuadran y hay que rehacerlos
    //const xAxesStep = dataset.step;
    // Calculate the frames labels
    // These values are used for BOTH axes
    const AxesValues = Array(dataLength)
      .fill(undefined)
      .map((v, i) => i * AxesStep);
    return { rmsds, AxesValues };
  }, [dataset, metadata]);

  // The selected frames
  const [selectedFramePair, setSelectedFramePair] = useState(null);

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
        return selectedFramePair.map((frame, index) => ({
          name: `Frame ${index === 0 ? 'A' : 'B'}`,
          frame: frame
        }));
      }
      // If components already exists then just update them
      selectedFramePair.forEach((frame, index) => {
        const previousComponent = previousComponents[index];
        previousComponent.name = `Frame ${index === 0 ? 'A' : 'B'}`;
        previousComponent.frame = frame;
      });
      return [...previousComponents];
    });
  }, [selectedFramePair]);

  // Get the default representations
  const defaultRepresentations = topology && topology.defaultRepresentations;

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
          // Set the whole system representations
          // Copy every default representation but customize them for this analysis
          defaultRepresentations.forEach(representation => {
            const newRepresentation = { ...representation };
            newRepresentation.name = `${component.name} - ${representation.name}`;
            newRepresentation.color = REPRESENTATION_COLORS.base[index];
            newRepresentation.component = component.name;
            newRepresentation.reference = `${REPRESENTATION_REFERENCES.base[index]} - ${representation.name}`;
            // In case there is no interaction selected this would be opaque
            // In case there is an interaction selected this would be transparent (just a reference)
            if (currentInteraction) {
              newRepresentation.name += ' reference';
              newRepresentation.opacity = 0.1;
            }
            // Representations with a reducen opacity (i.e. PBC) are made even more transparent
            // This is donde since PBC regions do not count for the RMSD calculation
            if (representation.isPbc) {
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
              const selection = agent.interface && topology.residueIndices2Ngl(agent.interface);
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
              const selection = agent.interface && topology.residueIndices2Ngl(agent.interface);
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
    topology,
    interactions,
    selectedInteraction,
    defaultRepresentations,
  ]);

  // Check if anything is still beeing loaded
  const anyLoading = isIndexLoading || isAnalysisLoading || isProjectLoading;
  console.log(`index ${isIndexLoading}, analysis ${isAnalysisLoading}, project ${isProjectLoading}`);

  // Render loading or error messages according with the API response
  // Render loading or error messages according with the API response
  if (indexError) return indexError.toString();
  if (error) return error.toString();
  if (dataset && dataset.error) return dataset.error;
  if (!dataset) {
    if (anyLoading) return <Loading />;
    // If there are no interactions or topology
    if (!topology) return 'There is no topology';
    return 'Something bad happened with the analysis data';
  }

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
      {analysisNote && <Card className={style.margined}>
        <CardContent>
          <div style={{ fontWeight: 'bold' }}>
            <FontAwesomeIcon icon={faExclamationTriangle} size={'lg'} />
            {' ' + analysisNote}
          </div>
        </CardContent>
      </Card>}
      <div className={anyLoading ? style.disabled : style.enabled}>
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
      </div>
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
