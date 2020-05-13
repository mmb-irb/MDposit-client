import React, { useContext, useState, useMemo, lazy, Suspense } from 'react';
import cn from 'classnames';

import { CardContent, Typography } from '@material-ui/core';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';
import EigenvalueGraph from '../../../components/eigenvalue-graph';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { AccessionCtx } from '../../../contexts';
import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import plainTextExplanation from './plain-text-explanation';
import processStats from './process-stats';

import style from './style.module.css';

const NGLViewerWithControls = lazy(() =>
  import(
    /* webpackChunkName: 'ngl-viewer-with-controls' */ '../../../components/ngl-viewer-with-controls'
  ),
);
const Projections = lazy(() =>
  import(
    /* webpackChunkName: 'projections' */ '../../../components/projections'
  ),
);

const projectionPlaceholder = (
  <div className={cn(style.placeholder, style.projection)} />
);
const nglPlaceholder = (
  <div className={cn(style.placeholder, style['ngl-viewer-with-controls'])} />
);

const PCA = () => {
  // Get the accession
  const accession = useContext(AccessionCtx);
  // Get the current project metadata and chains
  const { chains } = useContext(ProjectCtx);
  // Load the main data from the API
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/pca/`,
  );

  const [projections, setProjections] = useState([]);
  const [requestedFrame, setRequestedFrame] = useState(null);

  const [explanation, totalEigenvalue] = useMemo(() => {
    setRequestedFrame(null);
    return processStats(payload, projections);
  }, [payload, projections]);

  if (loading) {
    return <Loading />;
  }
  if (error) {
    return error.toString();
  }

  let projectionURL;
  if (projections[0] !== undefined)
    // It may be 0
    projectionURL = `${BASE_PATH_PROJECTS}${accession}/files/trajectory.pca-${projections[0] +
      1}.bin`;

  // Set the chains to be represented in the NGL viewer
  const chainsNGL = [];
  for (const chain of chains) {
    chainsNGL.push({
      name: 'Chain ' + chain,
      selection: ':' + chain,
    });
  }

  return (
    <>
      <Card className={style.card}>
        <CardContent>
          <Typography variant="h6">PCA eigenvalues</Typography>
          {/* Bars graph which allows to select a specific projection */}
          <EigenvalueGraph
            data={payload.y}
            totalEigenvalue={totalEigenvalue}
            projections={projections}
            setProjections={setProjections}
          />
        </CardContent>
      </Card>
      <Card className={style.card}>
        <CardContent>
          <Typography variant="h6">PCA projections</Typography>
          {/* Show a brief explanation about selected projection and their explained variance accounting */}
          <p>{plainTextExplanation(projections, explanation)}</p>
          {/* When only 1 frame is selected use the regula ngl viewer */}
          {projections.length === 1 && (
            <Suspense fallback={nglPlaceholder}>
              <NGLViewerWithControls
                accession={accession}
                className={style['ngl-viewer-with-controls']}
                projection={projections[0]}
                framesSelect={false}
                trajectoryURL={projectionURL}
                chains={chainsNGL}
              />
            </Suspense>
          )}
          {/* When only 2 frames are selected use the projections graph */}
          {projections.length === 2 && (
            <Suspense fallback={projectionPlaceholder}>
              <Projections
                step={payload.step}
                data={payload.y}
                projections={projections}
                setRequestedFrame={setRequestedFrame}
              />
            </Suspense>
          )}
          {/* When more than 2 frames are selected display nothing but the plain text explanation*/}
        </CardContent>
      </Card>
      {Number.isFinite(requestedFrame) && (
        // This small viewer is displayed when the user clicks in some point of the Projections graph
        <NGLViewerSpawner
          accession={accession}
          requestedFrame={requestedFrame}
          chains={chainsNGL}
        />
      )}
    </>
  );
};

export default PCA;
