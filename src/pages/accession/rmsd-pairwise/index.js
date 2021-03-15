import React, { useContext, useState, useMemo } from 'react';

import { CardContent, Typography } from '@material-ui/core';

import useAPI from '../../../hooks/use-api';

import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';

import { AccessionCtx, ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

import InteractionSelector from '../../../components/interaction-selector';
import Heatmap from '../../../components/heatmap';

import { complexNumerationParser } from '../../../utils/topology-manager';

const RmsdPairwise = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);

  // The selected frames
  const [selected, setSelected] = useState(null);

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // Set the API url for the heatmap data
  const url = `${BASE_PATH_PROJECTS}${accession}/analyses/rmsd-pairwise/`;

  const { loading, payload, error } = useAPI(url);

  const interactions = useMemo(() => {
    // Return if the payload is not ready
    if (!metadata) return;
    if (!metadata.INTERACTIONS) return [{ name: 'Overall' }];
    const metadataInteractions = metadata.INTERACTIONS;
    // Label all metadata interactions with the 'interface residues' ending
    metadataInteractions.forEach(interaction => {
      interaction.label = interaction.name + ' (interface residues)';
    });
    const interactions = [{ name: 'Overall' }, ...metadataInteractions];
    return interactions;
  }, [metadata]);

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
  const components = useMemo(() => {
    if (!selected) return;

    // Get the selected interaction
    const interaction = interactions[selectedInteraction];
    // Get the interaction interface, if it exists, in NGL format
    // The default interaction (Overall) has no interface
    const interactionInterface =
      interaction.interface_1 &&
      interaction.interface_2 &&
      [...interaction.interface_1, ...interaction.interface_2]
        .map(res => '(' + complexNumerationParser(res).nglSelection + ')')
        .join(' or ');

    const components = [];
    if (interactionInterface) {
      selected.forEach((frame, index) => {
        components.push({
          frame: frame,
          representations: [
            {
              name: 'Frame ' + frame + ' interaction interface',
              color: index === 0 ? 'red' : 'blue',
              selection: interactionInterface,
              type: 'licorice',
            },
            {
              name: 'Frame ' + frame + ' reference',
              color: index === 0 ? 'red' : 'blue',
              opacity: 0.1,
            },
          ],
        });
      });
    } else {
      selected.forEach((frame, index) => {
        components.push({
          frame: frame,
          representations: [
            {
              name: 'Frame ' + frame,
              color: index === 0 ? 'red' : 'blue',
            },
          ],
        });
      });
    }
    return components;
  }, [selected, interactions, selectedInteraction]);

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
            onClick={(x, y) => setSelected([x, y])}
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
