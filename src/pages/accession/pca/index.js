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
import Info from '../../../components/info';

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
  // Get the current project chains
  const { metadata, chains, files } = useContext(ProjectCtx);

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
  const [nglChains, nglComponent] = useMemo(() => {
    if (!payload || !files) return [undefined, undefined];

    // Set the chains to be represented in the NGL viewer
    const chainsNGL = chains.map(chain => {
      return {
        name: 'Chain ' + chain,
        selection: ':' + chain,
      };
    });

    // Get the API URL to the requested projection trajectory
    let projectionURL;
    if (projections[0] !== undefined)
      // It may be 0
      projectionURL = `${BASE_PATH_PROJECTS}${accession}/files/trajectory.pca-${projections[0] +
        1}.bin`;

    // Use the backbone if possible
    const hasBackbone = files.some(f => f.filename === 'md.backbone.pdb');

    // Set the NGL component
    const componentNGL = [
      {
        topologyURL: hasBackbone
          ? `${BASE_PATH_PROJECTS}${accession}/files/md.backbone.pdb`
          : `${BASE_PATH_PROJECTS}${accession}/files/average.pdb`,
        trajectoryURL: projectionURL,
        representations: chainsNGL,
      },
    ];

    return [chainsNGL, componentNGL];
  }, [payload, chains, files, projections, accession]);

  if (loading) {
    return <Loading />;
  }
  if (error) {
    return error.toString();
  }

  return (
    <>
      <Card className={style.card}>
        <Info
          reference={'pca-eigen-graph'}
          tooltip={
            <>
              This is the eigenvalues graph.
              <br />
              <br />
              The blue bars stand for the eigenvalue, according to the left
              edge, and the explained variance, according to the right edge, of
              any PCA projection. The yellow line stands for the accounting
              explained variance, according to the right edge.
              <br />
              <br />
              The graph is{' '}
              <span style={{ color: 'lightGreen' }}>interactive</span>. Hover
              any bar with the mouse to show the exact eigenvalue and explained
              variance values.
              <span style={{ color: 'lightGreen' }}>
                {' '}
                Click one or more bars{' '}
              </span>
              to select or deselect them. The exact eigenvalue and explained
              variance values of each selected bar will be permanently shown
              below the graph. Also, the accounting explained variance of all
              selected bars is displayed further below. In addition, if only one
              bar is selected then an NGL viewer will appear with the
              corresponding pca projection trajectory or eigen vector. If two
              bars are selected then the PCA projections are compared.
            </>
          }
        />
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
        {projections.length === 1 && (
          <Info
            reference={'pca-projection'}
            tooltip={
              <>
                This is the projection {projections[0] + 1} representation.
                <br />
                <br />
                This component is an{' '}
                <a
                  href="/help#/help#ngl-viewer"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  NGL viewer
                </a>{' '}
                . It allows to represent a trajectory dinamically and
                interactively.
                <br />
                Use the mouse inside the NGL window to move, rotate or zoom the
                camera. You can get topology data of any atom by placing the
                mouse over it. Also some controls ara available under the NGL
                viewer in order to change the camera view, trajectory speed,
                protein representation colors, etc. Place the mouse over any
                button to show a summary title.
                <br />
                <br />
                Note that this is not the whole structure, but only the
                backbone. PCA analysis is performed only with backbone atoms for
                performance reasons.
              </>
            }
          />
        )}
        {projections.length === 2 && (
          <Info
            reference={'pca-projections-graph'}
            tooltip={
              <>
                This is the PCA analysis comparing projections{' '}
                {projections[0] + 1} and {projections[1] + 1}.
                <br />
                <br />
                The color stands for the trajectory time.
                <br />
                <br />
                <span style={{ color: 'lightGreen' }}> Click any point </span>
              </>
            }
          />
        )}
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
                // Projections are backbone trajectories, same as the average.pdb topology
                components={nglComponent}
              />
            </Suspense>
          )}
          {/* When only 2 frames are selected use the projections graph */}
          {projections.length === 2 && (
            <Suspense fallback={projectionPlaceholder}>
              <Projections
                //step={payload.step / metadata.FREQUENCY} // The payload.step is meant to be in picoseconds
                step={payload.step}
                data={payload.y}
                projections={projections}
                totalFrames={metadata.frameCount}
                setRequestedFrame={setRequestedFrame}
              />
            </Suspense>
          )}
          {/* When more than 2 frames are selected display nothing but the plain text explanation*/}
        </CardContent>
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={
          Number.isFinite(requestedFrame)
            ? {
                accession: accession,
                requestedFrame: requestedFrame,
                representations: nglChains,
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
