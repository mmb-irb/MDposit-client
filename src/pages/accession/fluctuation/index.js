import React, { lazy, Suspense, useState, useContext } from 'react';

import { CardContent, Typography } from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx } from '../../../contexts';
import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

const StatisticsTable = lazy(() =>
  import(
    /* webpackChunkName: 'statistics-table' */ '../../../components/statistics-table'
  ),
);
const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

const FluctuationAnalysis = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project metadata and chains
  const { metadata, chains } = useContext(ProjectCtx);

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/fluctuation/`,
  );

  // React hooks
  // Set when the mouse is over the graph
  const [hovered, setHovered] = useState(null);
  // Set when one point in the graph is selected
  const [selected, setSelected] = useState(new Set());

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
  if (metadata.MEMBRANE !== 'No')
    chainsNGL.push({
      selection: '(not polymer or hetero) and not (water or ion)',
      name: metadata.MEMBRANE,
      defaultDrawingMethod: 'licorice',
      defaultOpacity: 0.5,
    });

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <CardContent>
          <Typography variant="h6">Statistics</Typography>
          <StatisticsTable y={payload.y} />
        </CardContent>
      </Card>
      <Card className={style.card}>
        <CardContent>
          <Typography variant="h6" />
          <Graph
            y={payload.y}
            start={payload.start || 0}
            step={payload.step}
            xLabel={'Atom'}
            xUnit={'atom'}
            yLabel={'Fluctuation (nm)'}
            type={'dash'}
            startsAtOne={true}
            onHover={setHovered}
            hovered={hovered}
            onSelect={setSelected}
            selected={selected}
          />
        </CardContent>
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          selected && selected.size
            ? {
                accession: accession,
                hovered: hovered,
                selected: selected,
                representations: chainsNGL,
              }
            : null
        }
        nailing={false}
        // If the closed viewer is the current viewer then reset the 'selected'
        onClose={viewer =>
          setSelected(previous => {
            if (viewer.selected === previous) return new Set();
            else return previous;
          })
        }
      />
    </Suspense>
  );
};

export default FluctuationAnalysis;
