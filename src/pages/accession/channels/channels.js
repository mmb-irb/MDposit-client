import React, { lazy, Suspense, useState, useContext, useMemo, useRef, useEffect, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';

import Card from '../../../components/animated-card';
import ViewerWithControls from '../../../components/viewer-with-controls';
import Loading from '../../../components/loading';
import useAPI from '../../../hooks/use-api';
import { ProjectCtx } from '../../../contexts';
import { BASE_PATH_PROJECTS } from '../../../utils/constants';
import style from './style.module.css';

const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const findClosestNumberOneLiner = (arr, target) => {
  return arr.sort((a, b) => 
    Math.abs(a - target) - Math.abs(b - target)
  )[0];
};

const Channels = () => {
  const { accessionAndMdNumber, topology } = useContext(ProjectCtx);
  const [nglRef, isNglVisible] = useInView(useInViewOptions);
  const viewerRef = useRef(null);
  const lastFrameRef = useRef(null);

  // Get the default representations
  const defaultRepresentations = topology && topology.defaultRepresentations;
  const [representations, setRepresentations] = useState(null);

  // Send a request to the API with the url of the specific analysis
  const {
    loading: channelsLoading,
    payload: channelsPayload,
    error: channelsError,
  } = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/channels/`);

    // Initialize representations
  useEffect(() => {
    if (!defaultRepresentations || defaultRepresentations.length === 0) return;
    setRepresentations([...defaultRepresentations]);
  }, [defaultRepresentations]);

  // Add channel mesh visualization
  const handleProgress = useCallback((progress) => {
    if (!viewerRef.current || !channelsPayload || !channelsPayload.data) return;

    let frame = Math.floor(progress * (channelsPayload.n_frames - 1));
    frame = findClosestNumberOneLiner(Object.keys(channelsPayload.data), frame);

    if (lastFrameRef.current === frame) return;
    lastFrameRef.current = frame;

    const { position, color_offset } = channelsPayload.data[frame];
    viewerRef.current.drawMesh(position, color_offset, "channel");
  }, [channelsPayload]);

  if (channelsLoading) return <Loading />;
  if (channelsError) return channelsError.toString();
  if (!channelsPayload) return 'Something bad happened with Channels analysis';

  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.nglcard} ref={nglRef}>
        {isNglVisible ? (
          <ViewerWithControls
            className={style.container}
            representationsState={[representations, setRepresentations]}
            ref={viewerRef}
            rotateX={true}
            onProgress={handleProgress}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
    </Suspense>
  );
};

export default Channels;
