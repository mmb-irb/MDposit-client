import React, { Suspense, useContext, useState } from 'react';

import { TextField, Typography } from '@material-ui/core';

import Loading from '../../../components/loading';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';

import { AccessionCtx, ProjectCtx, PdbCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import Heatmap from '../../../components/heatmap';

import style from './style.module.css';

const DistPerres = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project chains
  const { chains } = useContext(ProjectCtx);
  // Get the current topology, including the residue names
  const pdbData = useContext(PdbCtx);

  const [searchResidues, setSearchResidues] = useState(
    '1-30,60-65,303-315,330-339,365-375,669,683,700-722,739-745,750-771',
  );

  // The selected heatmap cell [x,y]
  const [selected, setSelected] = useState(null);

  // Set the API url for the heatmap data
  const urlMean = `${BASE_PATH_PROJECTS}${accession}/analyses/dist-perres-mean/`;

  // Set the API url for the heatmap data
  const urlStdv = `${BASE_PATH_PROJECTS}${accession}/analyses/dist-perres-stdv/`;

  // Get first atom number from resiude number
  const residue2atom = residue => {
    let atom = pdbData.file.residueStore.atomOffset[residue] + 1;
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
      <Suspense fallback={<Loading />}>
        <Typography variant="h5" className={style.margined}>
          Residues selection
        </Typography>
        <TextField
          id="outlined-basic"
          value={searchResidues}
          variant="outlined"
          onChange={event => setSearchResidues(event.target.value)}
          className={style.widest}
        />
      </Suspense>
      <Suspense fallback={<Loading />}>
        <Typography variant="h5" className={style.margined}>
          Residues distance averages
        </Typography>
        <Heatmap
          url={urlMean}
          searchResidues={searchResidues}
          onClick={(x, y) => setSelected([residue2atom(x), residue2atom(y)])}
          legendTitle={'Distance average (Å)'}
          // Invert colors here, since minimum values belong to closer residues
          maxValueColor={{ r: 0, g: 0, b: 255 }}
          minValueColor={{ r: 255, g: 0, b: 0 }}
        />
      </Suspense>
      <Suspense fallback={<Loading />}>
        <Typography variant="h5" className={style.margined}>
          Residues distance standard deviations
        </Typography>
        <Heatmap
          url={urlStdv}
          searchResidues={searchResidues}
          onClick={(x, y) => setSelected([residue2atom(x), residue2atom(y)])}
          legendTitle={'Distance standard deviation (Å)'}
          legendLength={8}
        />
      </Suspense>
      {selected && (
        <NGLViewerSpawner
          accession={accession}
          selected={selected}
          chains={chainsNGL}
        />
      )}
    </Suspense>
  );
};

export default DistPerres;
