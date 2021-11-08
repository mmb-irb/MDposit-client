import React, { Suspense, useContext, useState, useMemo } from 'react';

import { CardContent, Typography } from '@material-ui/core';

import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import D3HeatmapGrid from '../../../components/d3-heatmap-grid';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import ChainsLegend from '../../../components/chains-legend';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx, PdbCtx, ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import {
  getAtom,
  getAtomResidue,
  absolute2modelResidue,
} from '../../../utils/topology-manager';

import InteractionSelector from '../../../components/interaction-selector';

import style from './style.module.css';

const Hbonds = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);
  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);
  const interactions = metadata.INTERACTIONS;

  // The interaction to be displayed
  const [selectedInteraction, setSelectedInteraction] = useState(0);

  // The hydrogen bond bar which the mouse has clicked
  const [selectedHB, setSelectedHB] = useState(null);

  // Set the API url for the heatmap data
  const url = `${BASE_PATH_PROJECTS}${accession}/analyses/hbonds/`;

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(url);

  // Set the filtered data which will be displayed
  const filteredData = useMemo(() => {
    // Return here if there is no payload or topology
    if (!payload || !pdbData || !pdbData.file) return;

    // The newest format has 4 fields: acceptors, donors, hydrogens and hbonds
    // The hbonds includes arrays of true and false per frame
    const interaction = interactions[selectedInteraction];

    // Get the data whose name matches the interaction name
    const data = payload.data.find(dataset => {
      return dataset.name === interaction.name;
    });
    if (!data)
      return `Dataset for the interaction "${interaction.name}" not found`;

    // If data is empty it means no hydrogen bonds where found for this interaction
    if (!data.hbonds[0])
      return 'No hydrogen bonds where found for this interaction';

    const filteredData = {
      hbonds: [],
      acceptorAtomIndex: [],
      donorAtomIndex: [],
      hydrogenAtomIndex: [],
      ylabels: [],
    };

    // Get the step
    // DANI: Esto no es del todo correcto pero hace que los números de frames siempre cuadren
    // DANI: Lo correcto sería hacer el hydrogen bonds con todas las frames y que el step fuese 1
    // DANI: Osea quitar todo el código del step
    // DANI: Esto es un apaño temporal porque algunos hydrogen bonds son de trayectorias reducidas
    // DANI: Esto se debe a que con la trayectoria completa excedían el límite de 16Mb
    // DANI: Lo correcto es implementar un nuevo sistema de carga de análisis sin límites
    const dataLength = data.hbonds[0].length;
    const step = Math.floor(metadata.SNAPSHOTS / (dataLength - 1));
    // Calculate the frames labels
    const xAxisValues = Array(dataLength)
      .fill(undefined)
      .map((v, i) => i * step);
    filteredData.xlabels = xAxisValues;

    // Find out the percent of frames where the bond is done along the trajectory for each bond
    const percents = data.hbonds.map(hb => {
      const totalFrames = hb.length;
      const hbFrames = hb.filter(value => value).length;
      return (hbFrames / totalFrames) * 100;
    });

    // Get the orderer index of 'hbonds' values greater than 1%
    const orderedIndexes = Array.from(Array(percents.length).keys());
    orderedIndexes.sort((a, b) => {
      return percents[b] - percents[a];
    });

    // Discard values lower than 1%
    const indexes = orderedIndexes.filter(i => percents[i] > 1);

    for (const hb of indexes) {
      // Push the selected bond to the filteredData object
      const hbonds = data.hbonds[hb];
      filteredData.hbonds.push(hbonds);
      const acceptor = data.acceptors[hb];
      filteredData.acceptorAtomIndex.push(acceptor);
      const donor = data.donors[hb];
      filteredData.donorAtomIndex.push(donor);
      const hydrogen = data.hydrogens[hb];
      filteredData.hydrogenAtomIndex.push(hydrogen);

      // Set a human readable label for this bond
      const acceptorName = getAtom(acceptor, pdbData.file).name;
      const donorName = getAtom(donor, pdbData.file).name;
      const acceptorResidueIndex = getAtomResidue(acceptor, pdbData.file).index;
      const donorResidueIndex = getAtomResidue(donor, pdbData.file).index;
      const hydrogenName = getAtom(hydrogen, pdbData.file).name;

      const acceptorResidue = absolute2modelResidue(
        acceptorResidueIndex,
        pdbData.file,
        metadata,
      );
      const donorResidue = absolute2modelResidue(
        donorResidueIndex,
        pdbData.file,
        metadata,
      );
      filteredData.ylabels.push(
        acceptorResidue.ngl +
          '.' +
          acceptorName +
          ' - ' +
          donorResidue.ngl +
          '.' +
          donorName +
          ' (' +
          hydrogenName +
          ')',
      );
    }

    // If data is empty it means no hydrogen bonds where found for this interaction
    if (!filteredData.hbonds[0])
      return 'No hydrogen bonds stable enough where found for this interaction';

    return filteredData;
  }, [payload, pdbData, metadata, interactions, selectedInteraction]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!pdbData.file) return <Loading />;

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card>
        <CardContent className={style.horizontal}>
          <Typography variant="h6">Interaction:</Typography>
          <InteractionSelector
            interactions={interactions}
            selectedInteraction={selectedInteraction}
            setSelectedInteraction={setSelectedInteraction}
          />
        </CardContent>
      </Card>
      {typeof filteredData === 'string' && (
        <Card>
          <CardContent>
            <Typography variant="h6">{filteredData}</Typography>
          </CardContent>
        </Card>
      )}
      {typeof filteredData === 'object' && (
        <Card className={style.margined}>
          <CardContent>
            <ChainsLegend />
            <div className={style.heatmap}>
              <D3HeatmapGrid
                data={filteredData.hbonds}
                xAxisValues={filteredData.xlabels}
                yAxisValues={filteredData.ylabels}
                xAxisLabel={'Frames'}
                yAxisLabel={'Hydrogen bonds'}
                onTooltip={d => d.y}
                onClick={d => {
                  const index = filteredData.ylabels.indexOf(d.y);
                  // Convert the clicked bar index to the corresponding atom indexes
                  if (index < 0) return;
                  const acceptor = filteredData.acceptorAtomIndex[index];
                  const donor = filteredData.donorAtomIndex[index];
                  const hydrogen = filteredData.hydrogenAtomIndex[index];
                  setSelectedHB({
                    index,
                    selectedAtoms: [acceptor, donor],
                    selectedDistances: [[acceptor, donor]],
                    selectedAngles: [[acceptor, hydrogen, donor]],
                  });
                }}
                verticalPadding={0.2}
                colorPlan={['#f0f0f0', 'blue']}
              />
            </div>
          </CardContent>
        </Card>
      )}
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          selectedHB
            ? {
                accession: accession,
                selectedAtoms: selectedHB.selectedAtoms,
                selectedDistances: selectedHB.selectedDistances,
                selectedAngles: selectedHB.selectedAngles,
              }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelectedHB(previous => {
            if (previous && previous.selectedAtoms === viewer.selectedAtoms)
              return null;
            else return previous;
          })
        }
        onClose={viewer => {
          setSelectedHB(previous => {
            if (previous && previous.selectedAtoms === viewer.selectedAtoms)
              return null;
            else return previous;
          });
        }}
      />
    </Suspense>
  );
};

export default Hbonds;
