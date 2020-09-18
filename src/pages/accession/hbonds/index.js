import React, { Suspense, useContext, useState } from 'react';

import { CardContent } from '@material-ui/core';

import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import HorizontalBars from '../../../components/horizontal-bars';
import D3HeatmapGrid from '../../../components/d3-heatmap-grid';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Info from '../../../components/info';
import ChainsLegend from '../../../components/chains-legend';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx, PdbCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import {
  source2modelResidue,
  source2absoluteResidue,
  complexNumerationParser,
  getAtom,
  absolute2sourceResidue,
} from '../../../utils/topology-manager';

import style from './style.module.css';

const Hbonds = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);

  // The bar which the mouse is over
  const [hoveredHB, setHoveredHB] = useState(null);
  // The hydrogen bond bar which the mouse has clicked
  const [selectedHB, setSelectedHB] = useState(null);

  // Set the API url for the heatmap data
  const url = `${BASE_PATH_PROJECTS}${accession}/analyses/hbonds/`;

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(url);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  if (!pdbData.file) return <Loading />;

  // The new format has 4 fields: acceptorAtomIndex, donorAtomIndex, hydrogenAtomIndex and hbonds
  // The old format has 6 fields: atom1, resnum1, atom2, resnum2, link and hbonds
  const newFormat = !!payload.acceptorAtomIndex;
  // The framed format is the new format with arrays of 1s and 0s instead of a percent in 'hbonds'
  const framedFormat = !!payload.hbonds[0].length;

  const percents = framedFormat
    ? payload.hbonds.map(hb => {
        const totalFrames = hb.length;
        const hbFrames = hb.filter(value => value === 1).length;
        return (hbFrames / totalFrames) * 100;
      })
    : payload.hbonds;

  // Get the orderer index of 'payload.hbonds' values greater than 1%
  const orderedIndexes = Array.from(Array(percents.length).keys());
  orderedIndexes.sort((a, b) => {
    return percents[b] - percents[a];
  });

  const indexes = orderedIndexes.filter(i => percents[i] > 1);

  // Use the indexes array to get a new filtered and ordered data set
  const data = {
    hbonds: [],
    atom1: [],
    resnum1: [],
    atom2: [],
    resnum2: [],
    link: [],
    acceptorAtomIndex: [],
    donorAtomIndex: [],
    hydrogenAtomIndex: [],
  };
  const ylabels = [];

  if (newFormat) {
    payload.atom1 = [];
    payload.resnum1 = [];
    payload.atom2 = [];
    payload.resnum2 = [];
    payload.link = [];
    for (const hb in payload.hbonds) {
      const atom1 = getAtom(payload.acceptorAtomIndex[hb], pdbData.file);
      const residue1 = absolute2sourceResidue(atom1.residue);
      payload.atom1.push(atom1.name);
      payload.resnum1.push(residue1.numeration);
      const atom2 = getAtom(payload.donorAtomIndex[hb], pdbData.file);
      const residue2 = absolute2sourceResidue(atom2.residue);
      payload.atom2.push(atom2.name);
      payload.resnum2.push(residue2.numeration);
      const link = getAtom(payload.hydrogenAtomIndex[hb], pdbData.file);
      payload.link.push(link.name);
    }
  }

  for (const hb of indexes) {
    data.hbonds.push(payload.hbonds[hb]);
    data.atom1.push(payload.atom1[hb]);
    data.resnum1.push(payload.resnum1[hb]);
    data.atom2.push(payload.atom2[hb]);
    data.resnum2.push(payload.resnum2[hb]);
    data.link.push(payload.link[hb]);
    const numeration1 = complexNumerationParser(payload.resnum1[hb]);
    const numeration2 = complexNumerationParser(payload.resnum2[hb]);
    const res1 = source2modelResidue(numeration1, pdbData.file);
    const res2 = source2modelResidue(numeration2, pdbData.file);
    ylabels.push(
      res1.ngl +
        '.' +
        payload.atom1[hb] +
        ' - ' +
        res2.ngl +
        '.' +
        payload.atom2[hb],
    );
    if (newFormat) {
      data.acceptorAtomIndex.push(payload.acceptorAtomIndex[hb]);
      data.donorAtomIndex.push(payload.donorAtomIndex[hb]);
      data.hydrogenAtomIndex.push(payload.hydrogenAtomIndex[hb]);
    }
  }

  // Get atom number from resiude number and atom type
  const getAtomIndex = (numeration, atomType) => {
    const topology = pdbData.file;
    const pnum = complexNumerationParser(numeration);
    const nResidue = source2absoluteResidue(pnum, topology);
    const firstResidueAtom = topology.residueStore.atomOffset[nResidue];
    const residueSize = topology.residueStore.atomCount[nResidue];
    const residueAtomIndexes = [...Array(residueSize).keys()].map(
      i => i + firstResidueAtom,
    );
    const atomTypeIds = topology.atomStore.atomTypeId;
    const residueAtomTypes = residueAtomIndexes.map(
      i => topology.atomMap.get(atomTypeIds[i]).atomname,
    );
    const residueAtomNumber = residueAtomTypes.indexOf(atomType);
    const atomNumber = firstResidueAtom + residueAtomNumber;
    //console.log(residue + '(' + atomType + ') -> ' + atomNumber);
    return atomNumber;
  };

  //console.log(ylabels);

  // Render
  return (
    <Suspense fallback={<Loading />}>
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
              when the distance between them is inferior to 3 Ångstroms and the
              'acceptor atom - hydrogen - donor atom' angle is superior to 15
              degrees.
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
          {framedFormat ? (
            <D3HeatmapGrid
              data={data.hbonds}
              yLabels={ylabels}
              xTitle={'Frames'}
              yTitle={'Hydrogen bonds'}
              onTooltip={d => d.y}
              onClick={d => {
                const index = ylabels.indexOf(d.y);
                // Convert the clicked bar index to the corresponding atom indexes
                if (index < 0) return;
                const acceptor = newFormat
                  ? data.acceptorAtomIndex[index]
                  : getAtomIndex(data.resnum1[index], data.atom1[index]);
                const donor = newFormat
                  ? data.donorAtomIndex[index]
                  : getAtomIndex(data.resnum2[index], data.atom2[index]);
                const hydrogen = newFormat
                  ? data.hydrogenAtomIndex[index]
                  : getAtomIndex(data.resnum2[index], data.link[index]);
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
          ) : (
            <HorizontalBars
              data={data.hbonds}
              ylabels={ylabels}
              height={20 * data.hbonds.length}
              xMax={100}
              hoveredBar={hoveredHB}
              onHover={index => setHoveredHB(index)}
              selectedBar={selectedHB ? selectedHB.index : null}
              onClick={index => {
                // Convert the clicked bar index to the corresponding atom indexes
                if (index < 0) return;
                const acceptor = newFormat
                  ? data.acceptorAtomIndex[index]
                  : getAtomIndex(data.resnum1[index], data.atom1[index]);
                const donor = newFormat
                  ? data.donorAtomIndex[index]
                  : getAtomIndex(data.resnum2[index], data.atom2[index]);
                const hydrogen = newFormat
                  ? data.hydrogenAtomIndex[index]
                  : getAtomIndex(data.resnum2[index], data.link[index]);
                setSelectedHB({
                  index,
                  selectedAtoms: [acceptor, donor],
                  selectedDistances: [[acceptor, donor]],
                  selectedAngles: [[acceptor, hydrogen, donor]],
                });
              }}
            />
          )}
        </CardContent>
      </Card>
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
