import React, { Suspense, useContext, useState } from 'react';

import { CardContent } from '@material-ui/core';

import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import HorizontalBars from '../../../components/horizontal-bars';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Info from '../../../components/info';

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
  //const [hovered, setHovered] = useState(null);
  // The bar which has been clicked
  const [selected, setSelected] = useState(null);

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

  // Get the orderer index of 'payload.hbonds' values greater than 1%
  const orderedIndexes = Array.from(Array(payload.hbonds.length).keys());
  orderedIndexes.sort((a, b) => {
    return payload.hbonds[b] - payload.hbonds[a];
  });
  const indexes = orderedIndexes.filter(i => payload.hbonds[i] > 1);

  // Use the indexes array to get a new filtered and ordered data set
  const data = {
    hbonds: [],
    atom1: [],
    resnum1: [],
    atom2: [],
    resnum2: [],
  };
  const ylabels = [];

  if (newFormat) {
    payload.atom1 = [];
    payload.resnum1 = [];
    payload.atom2 = [];
    payload.resnum2 = [];
    for (const hb in payload.hbonds) {
      const atom1 = getAtom(payload.acceptorAtomIndex[hb]);
      const residue1 = absolute2sourceResidue(atom1.residue);
      payload.atom1.push(atom1.name);
      payload.resnum1.push(residue1.numeration);
      const atom2 = getAtom(payload.donorAtomIndex[hb]);
      const residue2 = absolute2sourceResidue(atom2.residue);
      payload.atom2.push(atom2.name);
      payload.resnum2.push(residue2.numeration);
    }
  }

  for (const hb of indexes) {
    data.hbonds.push(payload.hbonds[hb]);
    data.atom1.push(payload.atom1[hb]);
    data.resnum1.push(payload.resnum1[hb]);
    data.atom2.push(payload.atom2[hb]);
    data.resnum2.push(payload.resnum2[hb]);
    const numeration1 = complexNumerationParser(payload.resnum1[hb]);
    const numeration2 = complexNumerationParser(payload.resnum2[hb]);
    const res1 = source2modelResidue(numeration1, pdbData.file);
    const res2 = source2modelResidue(numeration2, pdbData.file);
    ylabels.push(
      res1.tag +
        '[' +
        payload.atom1[hb] +
        '] - ' +
        res2.tag +
        '[' +
        payload.atom2[hb] +
        ']',
    );
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

  /*
  let atomHoverion = [];
  for (const h in hovered) {
    atomHoverion.push(getAtomIndex(payload.resnum1[h]));
    atomHoverion.push(getAtomIndex(payload.resnum2[h]));
  }
  */
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
              The horizontal bars stand for the percent of frames along the
              trajectory in which the distance between each pair of atoms is
              inferior to 3 angstroms.
              <br />
              <br />
              <span style={{ color: 'lightGreen' }}> Click any bar </span>
              in the graph to open an interactive window displaying the
              trajectory with the corresponding highlighted atoms.
            </>
          }
        />
        <CardContent>
          <HorizontalBars
            data={data.hbonds}
            ylabels={ylabels}
            height={20 * data.hbonds.length}
            xMax={100}
            //hovered={hovered}
            //onHover={index => setHovered(index)}
            selected={selected}
            onClick={index => {
              const atomSelection = newFormat
                ? [
                    payload.acceptorAtomIndex[index],
                    payload.donorAtomIndex[index],
                  ]
                : [
                    getAtomIndex(data.resnum1[index], data.atom1[index]),
                    getAtomIndex(data.resnum2[index], data.atom2[index]),
                  ];
              // DANI: Esto no tiene sentido
              //console.log(selected);
              setSelected(atomSelection);
              /*
              if (selected && selected.includes(index)){
                const i = selected.indexOf(index);
                const deselected = selected.splice(i,1);
                setSelected(deselected);
              }
              else{
                setSelected((selected && [...selected, index]) || [index]);
              }
              */
            }}
          />
        </CardContent>
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          selected && selected.length > 0
            ? {
                accession: accession,
                selected: selected,
                //hovered: atomHoverion,
              }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelected(previous => {
            if (viewer.selected === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelected(previous => {
            if (viewer.selected === previous) return null;
            else return previous;
          })
        }
      />
    </Suspense>
  );
};

export default Hbonds;
