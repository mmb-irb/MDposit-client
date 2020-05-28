import React, { Suspense, useContext, useState } from 'react';

import { Card, CardContent } from '@material-ui/core';

import Loading from '../../../components/loading';
import HorizontalBars from '../../../components/horizontal-bars';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';

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
  const [hovered, setHovered] = useState(null);
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
  const residue2atom = residue => {
    let atom = pdbData.file.residueStore.atomOffset[residue] + 1;
    return atom;
  };

  let atomSelection = [];
  if (selected) {
    atomSelection.push(residue2atom(payload.resnum1[selected]));
    atomSelection.push(residue2atom(payload.resnum2[selected]));
  }

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.margined}>
        <CardContent>
          <HorizontalBars
            data={payload.hbonds}
            ylabels={ylabels}
            height={20 * payload.hbonds.length}
            xMax={100}
            hovered={hovered}
            setHovered={setHovered}
            setSelected={setSelected}
          />
        </CardContent>
      </Card>
      {atomSelection.length > 0 && (
        <NGLViewerSpawner
          accession={accession}
          analysis={'rmsd'}
          selected={atomSelection}
          chains={chainsNGL}
        />
      )}
    </Suspense>
  );
};

export default Hbonds;
