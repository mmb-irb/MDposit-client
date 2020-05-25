import React, { Suspense, useContext } from 'react';

import { Typography } from '@material-ui/core';

import Loading from '../../../components/loading';

import { AccessionCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import Heatmap from '../../../components/heatmap';

import style from './style.module.css';

const RmsdPairwise = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);

  // Set the API url for the heatmap data
  const completeUrl = `${BASE_PATH_PROJECTS}${accession}/analyses/rmsd-pairwise/`;

  // Set the API url for the heatmap data
  const interfaceUrl = `${BASE_PATH_PROJECTS}${accession}/analyses/rmsd-pairwise-interface/`;

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Typography variant="h5" className={style.margined}>
        RMSD pairwise
      </Typography>
      <Heatmap url={completeUrl} legendTitle={'RMSD (Å)'} legendLength={7} />
      <Typography variant="h5" className={style.margined}>
        Interface RMSD pairwise
      </Typography>
      <Heatmap url={interfaceUrl} legendTitle={'RMSD (Å)'} legendLength={3} />
    </Suspense>
  );
};

export default RmsdPairwise;
