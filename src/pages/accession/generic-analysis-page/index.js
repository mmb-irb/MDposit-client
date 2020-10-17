import React, { lazy, Suspense, useState, useContext } from 'react';

import { CardContent, Typography } from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx, ProjectCtx } from '../../../contexts';

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
  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);

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

  const dataLength = payload.y['rmsd'].data.length;
  const xAxesStep = (metadata.LENGTH / (dataLength - 1)) * 1000;

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
            step={xAxesStep}
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
