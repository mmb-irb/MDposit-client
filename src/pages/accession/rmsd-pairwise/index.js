import React, { Suspense, useContext, useState } from 'react';

import { Typography } from '@material-ui/core';

import Loading from '../../../components/loading';

import { AccessionCtx, ProjectCtx, PdbCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import Heatmap from '../../../components/heatmap';

import style from './style.module.css';

const RmsdPairwise = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project chains
  const { chains } = useContext(ProjectCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);

  // Set the API url for the heatmap data
  const completeUrl = `${BASE_PATH_PROJECTS}${accession}/analyses/rmsd-pairwise/`;

  // Set the API url for the heatmap data
  const interfaceUrl = `${BASE_PATH_PROJECTS}${accession}/analyses/rmsd-pairwise-interface/`;

  // Get first atom number from resiude number
  const residue2atom = residue => {
    // get a list with the atom count of each resiude in order
    const atomCounts = pdbData.file.residueStore.atomCount;
    let atom = 1;
    for (let r = 0; r < residue; r++) atom += atomCounts[r];
    return atom;
  };

  // Set the chains to be represented in the NGL viewer
  const chainsNGL = [];
  for (const chain of chains) {
    chainsNGL.push({
      name: 'Chain ' + chain,
      selection: ':' + chain,
    });
  }

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Typography variant="h5" className={style.margined}>
        RMSD pairwise
      </Typography>
      <Heatmap url={completeUrl} legendTitle={'RMSD (nm)'} legendLength={7} />
      <Typography variant="h5" className={style.margined}>
        Interface RMSD pairwise
      </Typography>
      <Heatmap url={interfaceUrl} legendTitle={'RMSD (nm)'} legendLength={3} />
    </Suspense>
  );
};

export default RmsdPairwise;
