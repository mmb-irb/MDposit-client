import React, { Suspense, useContext, useState } from 'react';

import { Card, CardContent, Tabs, Tab } from '@material-ui/core';

import useAPI from '../../../hooks/use-api';

import Loading from '../../../components/loading';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';

import { AccessionCtx, ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import Heatmap from '../../../components/heatmap';

import style from './style.module.css';

//import HorizontalBars from '../../../components/horizontal-bars';

const RmsdPairwise = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project chains and metadata
  const { metadata, chains } = useContext(ProjectCtx);

  // The selected heatmap cell [x,y]
  const [selected, setSelected] = useState(null);

  // The graphic to be displayed ('all' or 'interface')
  const [display, setDisplay] = useState('all');

  // Set the API url for the heatmap data
  const url = `${BASE_PATH_PROJECTS}${accession}/analyses/rmsd-pairwise/`;

  const { loading, payload, error } = useAPI(url);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';

  // Set the chains to be represented in the NGL viewer
  const chainsNGL = [];
  for (const chain of chains) {
    chainsNGL.push({
      name: 'Chain ' + chain,
      selection: ':' + chain,
    });
  }

  // handles when the tabs are switched
  const handleTabs = (event, newValue) => {
    setDisplay(newValue);
  };

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Suspense fallback={<Loading />}>
        <Card className={style.margined}>
          <CardContent>
            <Tabs
              value={display}
              variant="fullWidth"
              indicatorColor="secondary"
              textColor="secondary"
              onChange={handleTabs}
              className={style['margined-bottom']}
            >
              <Tab
                value={'all'}
                label="RMSD pairwise"
                //className={style['disabled-tab']}
              />
              <Tab value={'interface'} label="Interface RMSD pairwise" />
            </Tabs>
            {/* For more than one resiude in the 'y' */}
            <Heatmap
              inputData={{
                data: payload[display],
                xLabels: payload.xLabels,
                yLabels: payload.yLabels,
              }}
              //onClick={(x, y) => setSelected([x, y])}
              legendTitle={'RMSD (Å)'}
            />
          </CardContent>
        </Card>
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

export default RmsdPairwise;
