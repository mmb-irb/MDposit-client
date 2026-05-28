import React, { lazy, Suspense, useState, useContext, useRef, useEffect, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';

import { CardContent } from '@mui/material';

import Card from '../../../components/animated-card';
const Graph = lazy(() => import(/* webpackChunkName: 'graph' */ '../../../components/graph'));
import ViewerWithControls from '../../../components/viewer-with-controls';
import Loading from '../../../components/loading';
import useAPI from '../../../hooks/use-api';
import { ProjectCtx } from '../../../contexts';
import { BASE_PATH_PROJECTS } from '../../../utils/constants';
import { getMean } from '../../../utils/statistics';
import {
  buildChannelMeshFromFrame,
  CHANNEL_COLOR_OPTIONS,
  getChannelSamplingValues,
  getChannelPropertyValues,
} from './channel-mesh';
import style from './style.module.css';

const PROFILE_SERIES = [
  { key: 'radiusMean', label: 'Radius', color: 'red', propertyName: 'avg_radius' },
  {
    key: 'plHydrophobicityMean',
    label: 'Pore Lining Hydrophobicity',
    color: 'orange',
    propertyName: 'avg_pl_hydrophobicity',
  },
  {
    key: 'pfHydrophobicityMean',
    label: 'Pore Facing Hydrophobicity',
    color: '#e7d336',
    propertyName: 'avg_pf_hydrophobicity',
  },
];

const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const Channels = () => {
  const { accessionAndMdNumber, topology, metadata } = useContext(ProjectCtx);
  const [nglRef, isNglVisible] = useInView(useInViewOptions);
  const viewerRef = useRef(null);
  const [colorProperty, setColorProperty] = useState('avg_radius');
  const [channelsMeshPayload, setChannelsMeshPayload] = useState(null);
  const [selectedFrame, setSelectedFrame] = useState(0);

  // Get the default representations
  const defaultRepresentations = topology && topology.defaultRepresentations;
  const [representations, setRepresentations] = useState(null);
  const maximumSnapshots = metadata.mdFrames;

  // Send a request to the API with the url of the specific analysis
  const {
    loading: channelsLoading,
    payload: channelsPayload,
    error: channelsError,
  } = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/channels/`);

  useEffect(() => {
    if (channelsLoading || channelsError || !channelsPayload || !topology) return;
    const streamFrames = channelsPayload.data?.stream || [];
    const meshByFrame = streamFrames.reduce((accumulator, frame, frameIndex) => {
      accumulator[frameIndex] = buildChannelMeshFromFrame(frame, {
        colorProperty,
      });
      return accumulator;
    }, {});

    // Store the mesh data for all frames in state
    setChannelsMeshPayload({
      n_frames: streamFrames.length,
      step: Math.ceil(maximumSnapshots / streamFrames.length),
      data: meshByFrame,
    });

    // Make pore linning residues representation
    const poreLiningIndices = (channelsPayload.data.pore_residues.pore_lining || []).reduce(
      (indices, value, residueIndex) => {
        if (value > 0.5) indices.push(residueIndex);
        return indices;
      },
      [],
    );
    let poreResentations = null;
    if (poreLiningIndices.length === 0) return;
    const { rangedSelection: poreSelection } = topology.residueIndices2Ngl(poreLiningIndices);
    const poreLiningRepresentation = {
      name: 'Pore lining residues',
      type: 'ball+stick',
      color: 'orange',
      selection: poreSelection,
      reference: 'pore-lining',
    };
    poreResentations = [poreLiningRepresentation];
    const poreFacingIndices = (channelsPayload.data.pore_residues.pore_facing || []).reduce(
      (indices, value, residueIndex) => {
        if (value > 0.5) indices.push(residueIndex);
        return indices;
      },
      [],
    );
    if (poreFacingIndices.length !== 0) {
      const { rangedSelection: poreFacingSelection } = topology.residueIndices2Ngl(poreFacingIndices);
      const poreFacingRepresentation = {
        name: 'Pore facing residues',
        type: 'ball+stick',
        color: 'yellow',
        selection: poreFacingSelection,
        reference: 'pore-facing',
      };
        poreResentations.push(poreFacingRepresentation);
    }

    setRepresentations(prev => {
      const remainingRepresentations = (prev || []).filter(rep => rep.reference !== 'pore-lining' && rep.reference !== 'pore-facing');
      return [...remainingRepresentations, ...poreResentations];
    });


  }, [channelsLoading, channelsError, channelsPayload, colorProperty, topology]);

    // Initialize representations
  useEffect(() => {
    if (!defaultRepresentations || defaultRepresentations.length === 0) return;
      setRepresentations(prev => {
        defaultRepresentations.forEach(rep => {
                if (rep.name.toLowerCase().includes('protein')){
                    rep.opacity = 0.6;
                    }
                if (rep.name.toLowerCase().includes('lipids'))
                    rep.opacity = 0.05;
            });
        const poreLiningRepresentation = prev && prev.find(rep => rep.reference === 'pore-lining' );
        const poreFacingRepresentation = prev && prev.find(rep => rep.reference === 'pore-facing' );
        return poreLiningRepresentation && poreFacingRepresentation
          ? [...defaultRepresentations, poreLiningRepresentation, poreFacingRepresentation]
          : [...defaultRepresentations];
      });
  }, [defaultRepresentations]);

  useEffect(() => {
    if (!viewerRef.current || !channelsMeshPayload || !channelsMeshPayload.data || !isNglVisible) return;
    const frameData = channelsMeshPayload.data[selectedFrame];
    if (!frameData) return;
    viewerRef.current.drawMesh(frameData.position, frameData.colors, 'channel', frameData.normals);
  }, [channelsMeshPayload, isNglVisible, selectedFrame]);

  const frameOptions = channelsMeshPayload
    ? Array.from({ length: channelsMeshPayload.n_frames }, (_, index) => ({
      index,
      sourceFrame: index * channelsMeshPayload.step,
    }))
    : [];
  const requestedFrame = channelsMeshPayload
    ? selectedFrame * channelsMeshPayload.step
    : 1;

  const profileGraphData = useMemo(() => {
    const frame = channelsPayload?.data?.stream?.[selectedFrame];
    const xAxisValues = getChannelSamplingValues(frame);
    if (!frame || xAxisValues.length === 0) {
      return null;
    }

    const yData = PROFILE_SERIES.reduce((accumulator, series) => {
      const values = getChannelPropertyValues(frame, xAxisValues, series.propertyName);
      // Skip if no values, or all values are zero
      if (!Array.isArray(values) || values.length === 0 || values.every(value => value === 0)) {
        return accumulator;
      }

      accumulator[series.label] = {
        data: values,
        average: getMean(values),
        color: series.color,
      };
      return accumulator;
    }, {});

    if (Object.keys(yData).length === 0) {
      return null;
    }

    const step = xAxisValues.length > 1 ? Math.abs(xAxisValues[1] - xAxisValues[0]) : 1;
    // Round xAxis values to 2 decimal places for tooltip display
    const roundedXAxisValues = xAxisValues.map(value => Number(value).toFixed(2));
    return {
      xAxisValues: roundedXAxisValues,
      xTooltip: value => `${roundedXAxisValues[value]}`,
      step,
      yData,
    };
  }, [channelsPayload, selectedFrame]);

  if (channelsLoading) return <Loading />;
  if (channelsError) return channelsError.toString();
  if (!channelsPayload) return 'Something bad happened with Channels analysis';
  return (
    <Suspense fallback={<Loading />}>
      <div className={style.analysisRow}>
        <Card className={`${style.nglcard} ${style.halfCard}`} ref={nglRef}>
          <div className={style.controls}>
            <label className={style.controlLabel}>
              Property
              <select
                className={style.controlSelect}
                value={colorProperty}
                onChange={event => setColorProperty(event.target.value)}
              >
                {CHANNEL_COLOR_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={style.controlLabel}>
              Frame
              <select
                className={style.controlSelect}
                value={selectedFrame}
                onChange={event => setSelectedFrame(Number(event.target.value))}
              >
                {frameOptions.map(frame => (
                  <option key={frame.index} value={frame.index}>
                    {frame.sourceFrame + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {isNglVisible ? (
            <ViewerWithControls
              className={style.container}
              representationsState={[representations, setRepresentations]}
              ref={viewerRef}
              rotateX={true}
              requestedFrame={requestedFrame}
            />
          ) : (
            <div style={{ height: '50vh' }} />
          )}
        </Card>
        {profileGraphData && (
          <Card className={`${style.card} ${style.halfCard} ${style.graphcard}`}>
            <CardContent>
              <Graph
                title={'Channel profiles'}
                legendClassName={style.legendCompact}
                yData={profileGraphData.yData}
                // step={profileGraphData.step}
                xAxisValues={profileGraphData.xAxisValues}
                xAxisLabel={'Channel coordinate'}
                xTooltip={profileGraphData.xTooltip}
                yAxisLabel={'Profile value'}
                selfLegend={true}
                zeroLine={true}
                margin={{ top: 10, right: 10, bottom: 30, left: 10 }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </Suspense>
  );
};

export default Channels;
