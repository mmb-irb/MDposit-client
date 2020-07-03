import React, { Suspense, useContext, useState } from 'react';

import { CardContent } from '@material-ui/core';

import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
import HorizontalBars from '../../../components/horizontal-bars';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Info from '../../../components/info';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx, ProjectCtx, PdbCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

const Hbonds = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the chains
  const { chains } = useContext(ProjectCtx);
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

  const ylabels = [];

  for (const hb in payload.hbonds)
    ylabels.push(
      payload.restype1[hb] +
        ':' +
        payload.resnum1[hb] +
        '(' +
        payload.atom1[hb] +
        ')' +
        ' - ' +
        payload.restype2[hb] +
        ':' +
        payload.resnum2[hb] +
        '(' +
        payload.atom2[hb] +
        ')',
    );

  // Set the chains to be represented in the NGL viewer
  const chainsNGL = [];
  for (const c in chains) {
    chainsNGL.push({
      name: 'Chain ' + chains[c],
      selection: ':' + chains[c],
    });
  }

  // Get first atom number from resiude number
  const residue2atom = (residue, atomType) => {
    const topology = pdbData.file;
    const nResidue = topology.residueStore.resno.indexOf(residue);
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
    return atomNumber;
  };

  /*
  let atomHoverion = [];
  for (const h in hovered) {
    atomHoverion.push(residue2atom(payload.resnum1[h]));
    atomHoverion.push(residue2atom(payload.resnum2[h]));
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
            data={payload.hbonds}
            ylabels={ylabels}
            height={20 * payload.hbonds.length}
            xMax={100}
            //hovered={hovered}
            //onHover={index => setHovered(index)}
            selected={selected}
            onClick={index => {
              const atomSelection = [
                residue2atom(payload.resnum1[index], payload.atom1[index]),
                residue2atom(payload.resnum2[index], payload.atom2[index]),
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
                representations: chainsNGL,
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
