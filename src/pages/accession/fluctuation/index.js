import React, { lazy, Suspense, useState, useContext } from 'react';

import { CardContent, Typography } from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx } from '../../../contexts';

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

const FluctuationAnalysis = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);

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

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <Info
          reference={'fluctuation-statistics'}
          tooltip={
            <>
              Statistics table including fluctuation data label, mean and
              standard deviation. Values are in namometers.
            </>
          }
        />
        <CardContent>
          <StatisticsTable y={payload.y} />
        </CardContent>
      </Card>
      <Card className={style.card}>
        <Info
          reference={'fluctuation-graph'}
          tooltip={
            <>
              This graph represents the fluctuation of each atom. Data is
              displayed (more opaque lines) alongside corresponding mean value
              (light horizontal line) and mean ± 1 standard deviation (lighter
              horizontal bands)
              <br />
              <br />
              The horizontal edge stands for the atoms numeration.
              <br />
              The vertical edge stands for the flucutation in nanometers.
              <br />
              <br />
              The graph is{' '}
              <span style={{ color: 'lightGreen' }}>interactive</span>. Use the
              mouse to move along data by holding the click button and dragging
              left or right. Use the mouse wheel to zoom in a specific region.
              <span style={{ color: 'lightGreen' }}> Click any point </span>
              on the graph to open an interactive window displaying the
              trajectory with the corresponding atom highlighted.
            </>
          }
        />
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
            showPrecisionSlider={false}
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
