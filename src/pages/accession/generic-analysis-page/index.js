import React, { lazy, Suspense, useState, useContext } from 'react';

import { CardContent, Typography } from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx } from '../../../contexts';
import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import Info from '../../../components/info';

import style from './style.module.css';

const StatisticsTable = lazy(() =>
  import(
    /* webpackChunkName: 'statistics-table' */ '../../../components/statistics-table'
  ),
);
const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

const Analysis = ({
  analysis,
  defaultPrecision,
  xLabel,
  xScaleFactor,
  yLabel,
  tableInfo,
  tableInfoRef,
  graphInfo,
  graphInfoRef,
  selfLegend = false,
}) => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project metadata and chains
  const { metadata, chains } = useContext(ProjectCtx);

  // Send a request to the API with the url of the specific analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/${analysis}/`,
  );

  // React hooks
  // Set when one point in the graph is selected
  const [selected, setSelected] = useState(null);

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
        {tableInfo && <Info reference={tableInfoRef} tooltip={tableInfo} />}
        <CardContent>
          <StatisticsTable y={payload.y} />
        </CardContent>
      </Card>
      <Card className={style.card}>
        {graphInfo && <Info reference={graphInfoRef} tooltip={graphInfo} />}
        <CardContent>
          <Typography variant="h6" />
          <Graph
            y={payload.y}
            start={payload.start || 0}
            step={payload.step}
            defaultPrecision={defaultPrecision}
            xLabel={xLabel}
            xScaleFactor={xScaleFactor}
            yLabel={yLabel}
            onSelect={setSelected}
            selected={selected}
            selfLegend={selfLegend}
          />
        </CardContent>
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          typeof selected === 'number'
            ? {
                accession: accession,
                requestedFrame: selected,
                representations: chainsNGL,
              }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelected(previous => {
            if (viewer.requestedFrame === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelected(previous => {
            if (viewer.requestedFrame === previous) return null;
            else return previous;
          })
        }
      />
    </Suspense>
  );
};

export default Analysis;
