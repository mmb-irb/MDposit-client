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
  // Get the current project metadata
  const { metadata, files } = useContext(ProjectCtx);

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

  // Set the component to be passed to the NGL
  const [representations, component] = useMemo(() => {
    if (!payload || !files) return [undefined, undefined];

    // Set the chains to be represented in the NGL viewer
    /*
    const representations = chains
      ? chains.map(chain => {
          return {
            name: 'Chain ' + chain + ' backbone',
            selection: ':' + chain,
          };
        })
      : [{ name: 'Backbone' }];
    */
    // DANI: Muchos 'pca.average.pdb' no tienen chains
    // DANI: El NGL las asigna automáticamente y no cuadran
    // DANI: Hasta que esto esté arreglado nos olbidamos de las chains
    const representations = [{ name: 'Backbone', type: 'spacefill' }];

    // Get the API URL to the requested projection trajectory
    let projectionURL;
    if (projections[0] !== undefined)
      // It may be 0
      projectionURL = `${BASE_PATH_PROJECTS}${accession}/files/trajectory.pca-${projections[0] +
        1}.bin`;

    // In order to represent the pca projection use a specific structure with only backbone atoms
    const pcaStructureFilename = 'pca.average.pdb';
    // If none of the 'pcaStructureFilenames' is available then throw an error
    if (!pcaStructureFilename)
      throw new Error('No available backbone structure');

    // Set the NGL component
    const component = [
      {
        topologyURL: `${BASE_PATH_PROJECTS}${accession}/files/${pcaStructureFilename}`,
        trajectoryURLs: [projectionURL],
        representations: representations,
      },
    ];

    return [representations, component];
  }, [payload, files, projections, accession]);

  if (loading) {
    return <Loading />;
  }
  if (error) {
    return error.toString();
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
        <div>
          <CardContent>
            <Typography variant="h6">PCA projections</Typography>
            {/* Show a brief explanation about selected projection and their explained variance accounting */}
            <p>{plainTextExplanation(projections, explanation)}</p>
          </CardContent>
          {/* When only 1 frame is selected use the regula ngl viewer */}
          {projections.length === 1 && (
            <Suspense fallback={nglPlaceholder}>
              <CardContent className={style['ngl-card']}>
                <NGLViewerWithControls
                  accession={accession}
                  className={style['ngl-viewer-with-controls']}
                  projection={projections[0]}
                  framesSelect={false}
                  // Projections are backbone trajectories, same as the average.pdb topology
                  components={component}
                  bounce={true}
                />
              </CardContent>
            </Suspense>
          )}
          {/* When only 2 frames are selected use the projections graph */}
          {projections.length === 2 && (
            <Suspense fallback={projectionPlaceholder}>
              <CardContent>
                <Projections
                  //step={payload.step / metadata.FREQUENCY} // The payload.step is meant to be in picoseconds
                  step={payload.step}
                  data={payload.y}
                  projections={projections}
                  totalFrames={metadata.frameCount}
                  setRequestedFrame={setRequestedFrame}
                />
              </CardContent>
            </Suspense>
          )}
          {/* When more than 2 frames are selected display nothing but the plain text explanation*/}
        </div>
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          Number.isFinite(requestedFrame)
            ? {
                accession: accession,
                requestedFrame: requestedFrame,
                representations: representations,
              }
            : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setRequestedFrame(previous => {
            if (viewer.requestedFrame === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setRequestedFrame(previous => {
            if (viewer.requestedFrame === previous) return null;
            else return previous;
          })
        }
      />
    </>
  );
};

export default PCA;
