import React, { useContext, useState, useMemo, lazy, Suspense } from 'react';
import cn from 'classnames';

import { CardContent, Typography } from '@mui/material';

import Card from '../../../components/animated-card';
import ViewerSpawner from '../../../components/viewer-spawner';
import EigenvalueGraph from '../../../components/eigenvalue-graph';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import plainTextExplanation from './plain-text-explanation';

import style from './style.module.css';

const ViewerWithControls = lazy(() => import(
  /* webpackChunkName: 'viewer-with-controls' */ '../../../components/viewer-with-controls'
));
const Projections = lazy(() => import(
  /* webpackChunkName: 'projections' */ '../../../components/projections'
));

const projectionPlaceholder = (
  <div className={cn(style.placeholder, style.projection)} />
);
const nglPlaceholder = (
  <div className={cn(style.placeholder, style['viewer-with-controls'])} />
);

const PCA = () => {
  // Get the current project metadata
  const { accessionAndMdNumber, metadata, files } = useContext(ProjectCtx);

  // Load the main data from the API
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/pca/`,
  );
  const data = payload && payload.data;

  const [projections, setProjections] = useState([]);
  const [requestedFrame, setRequestedFrame] = useState(null);

  // Get the expalined variance of every eigenvector and the total explained variance
  const [explanation, totalEigenvalue] = useMemo(() => {
    setRequestedFrame(null);
    if (!data) return [];
    const eigenvalues = data.eigenvalues;
    if (!eigenvalues.length) return [];
    const totalEigenvalue = eigenvalues.reduce((acc, curr) => acc + curr, 0);
    const explanation =
      projections.reduce(
        (acc, projection) => acc + eigenvalues[projection],
        0,
      ) / totalEigenvalue;
    return [explanation, totalEigenvalue];
  }, [data, projections]);

  // Set the component to be passed to the NGL
  const [representations, components] = useMemo(() => {
    if (!data || !files) return [undefined, undefined];
    // Only backbon atoms will be shown so they are better represented in spacefill
    const representations = [
      {
        name: 'PC projection',
        type: 'spacefill',
      },
    ];

    // Get the API URL to the requested projection trajectory
    let trajectoryURLs;
    if (projections[0] !== undefined) {
      const projectionNumber = ('0' + (projections[0] + 1)).slice(-2);
      const projectionURL = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/files/pca_trajectory_${projectionNumber}.bin`;
      trajectoryURLs = [ projectionURL ];
    }

    // Get the topology URL
    // It has to be the main topology but with a specific selection of atoms
    const topologyURL = `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/files/structure`;

    // Set the NGL component
    const components = [
      {
        topologyURL: topologyURL,
        // WARNING: NGL does not support ranged syntax with atom indices (e.g. @0-2,13-15)
        atomSelection: '@' + data.atoms.join(','),
        trajectoryURLs: trajectoryURLs,
      },
    ];

    return [representations, components];
  }, [data, files, projections, accessionAndMdNumber]);

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
            eigenvalues={data.eigenvalues}
            totalEigenvalue={totalEigenvalue}
            projectionsData={data.projections}
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
          {/* When only 1 eigenvector is selected use the regula ngl viewer */}
          {projections.length === 1 && (
            <Suspense fallback={nglPlaceholder}>
              <CardContent className={style['ngl-card']}>
                <ViewerWithControls
                  className={style['viewer-with-controls']}
                  projection={projections[0]}
                  framesSelect={false}
                  // Projections are backbone trajectories, same as the average.pdb topology
                  startingRepresentations={representations}
                  startingComponents={components}
                  bounce={true}
                />
              </CardContent>
            </Suspense>
          )}
          {/* When only 2 eigenvectors are selected use the projections graph */}
          {projections.length === 2 && (
            <Suspense fallback={projectionPlaceholder}>
              <CardContent>
                <Projections
                  framestep={data.framestep}
                  projectionsData={data.projections}
                  projections={projections}
                  datumRange={data.eigenvalues.length}
                  totalFrames={metadata.mdFrames}
                  setRequestedFrame={setRequestedFrame}
                />
              </CardContent>
            </Suspense>
          )}
          {/* When more than 2 frames are selected display nothing but the plain text explanation*/}
        </div>
      </Card>
      <ViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={Number.isFinite(requestedFrame)
          ? { requestedFrame: requestedFrame }
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
