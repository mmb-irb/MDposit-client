import React, { Suspense, useContext, useState, useMemo } from 'react';

import { CardContent, Typography } from '@material-ui/core';

import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import D3HeatmapGrid from '../../../components/d3-heatmap-grid';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Info from '../../../components/info';
import ChainsLegend from '../../../components/chains-legend';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx, PdbCtx, ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import {
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

    // If data is empty it means no hydrgoen bonds where found for this interaction
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

      // Set a human readable lable for this bond
      const acceptorResidueIndex = getAtomResidue(acceptor).index;
      const donorResidueIndex = getAtomResidue(donor).index;

      const acceptorResidue = absolute2modelResidue(
        acceptorResidueIndex,
        pdbData.file,
      );
      const donorResidue = absolute2modelResidue(
        donorResidueIndex,
        pdbData.file,
      );
      filteredData.ylabels.push(
        acceptorResidue.ngl +
          '.' +
          acceptor +
          ' - ' +
          donorResidue.ngl +
          '.' +
          donor,
      );
    }

    // If data is empty it means no hydrgoen bonds where found for this interaction
    if (!filteredData.hbonds[0])
      return 'No hydrogen bonds stable enough where found for this interaction';

    return filteredData;
  }, [payload, pdbData, interactions, selectedInteraction, metadata.SNAPSHOTS]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!pdbData.file) return <Loading />;

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card>
        <CardContent>
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
          <Info
            reference={'hbonds-graph'}
            tooltip={
              <>
                This is the hydrogen bonds analysis representation.
                <br />
                <br />
                All pairs of hydrogen bridging atoms are listed in order of
                probability. Left edge labels describe the acceptor and donor
                atoms respectively. Chain names are listed in the legend above.
                The horizontal bars stand for the percent of frames along the
                trajectory in which the specified pair of atoms may form an
                hydrogen bond. Two atoms are considered to form an hydrogen bond
                when the distance between them is inferior to 3 Ångstroms and
                the 'acceptor atom - hydrogen - donor atom' angle is superior to
                15 degrees.
                <br />
                <br />
                <span style={{ color: 'lightGreen' }}> Click any bar </span>
                in the graph to open an interactive window displaying the
                trajectory with the corresponding highlighted atoms and the
                distance between them.
              </>
            }
          />
          <CardContent>
            <ChainsLegend />
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
              minColor={'#f0f0f0'}
            />
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
            if (viewer.selectedAtoms === previous.selectedAtoms) return null;
            else return previous;
          })
        }
        onClose={viewer => {
          setSelectedHB(previous => {
            if (viewer.selectedAtoms === previous.selectedAtoms) return null;
            else return previous;
          });
        }}
      />
    </Suspense>
  );
};

export default Hbonds;
