import React, { lazy, useContext, useState, useMemo, useCallback, useRef, useEffect } from 'react';
// CSS style
import style from './style.module.css';
// Hooks to request the API
import useAPI from '../../../hooks/use-api';
import useBatchAPI from '../../../hooks/use-batch-api';
// Project context
import { ProjectCtx } from '../../../contexts';
// Constants
import { BASE_PATH_PROJECTS } from '../../../utils/constants';
// Visual assets
import { CardContent, Slider, Switch, Typography } from '@mui/material';
import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
// Analysis selector
import Selector from '../../../components/selector';
// Viewer pop-up windows
import ViewerSpawner from '../../../components/viewer-spawner';
import Version from 'src/utils/version';

const MarkovGraph = lazy(() =>
  import(/* webpackChunkName: 'graph-msm' */ '../../../components/graph-msm'),
);

// Set the maximum number of nodes
// Note that the hard limit of nodes is the number of values in data (now 20)
const defaultNodeNumber = 14;
// Set the maximum number of transitions, each one drawn as an arrow
// Note that the hard limit is the number of transitions between the displayed clusters
// Note also that it is kept low to avoid a cluttered graph, but the user may raise it
const defaultLinksNumber = 10;

// Set the maximum node area in the graph, which is the area of the node with the highest population
const maxNodeArea = 10000;
// Set the minimum node area, so the least populated clusters are still visible/clickable
const minNodeArea = 1000;
// Set the maximum and minimum link widths in the graph
// Note that both are to be defined since width values are interpolated
const maxLinkWidth = 10;
const minLinkWidth = 2;
// Set the width for a direction with no transitions
// Note that a 0 width means this direction gets no arrow
const zeroLinkWidth = 0;

// Translate a (0-indexed, contiguous) frames group into the API frames query format: e.g. '5:9:1'
const framesToQuery = frames => `${frames[0] + 1}:${frames[frames.length - 1] + 1}:1`;

// Pad a (consecutive) frame group with one extra frame on each side
// e.g. [4,5,6] => [3,4,5,6,7]
const padFrameGroup = frameGroup => {
  const first = frameGroup[0];
  const last = frameGroup[frameGroup.length - 1];
  return [ Math.max(first - 1, 0), ...frameGroup, last + 1 ];
};

const Clusters = () => {

  // Get the current project metadata
  const { accessionAndMdNumber, files } = useContext(ProjectCtx);

  // Set when one point in the graph is selected
  const [selectedFrame, setSelectedFrame] = useState(null);

  // Set when a transition arrow in the graph is selected
  const [selectedTransitionFrames, setSelectedTransitionFrames] = useState(null);

  // Set the number of nodes to be displayed
  const [nodesLimit, setNodesLimit] = useState(defaultNodeNumber);

  // Set the number of nodes to be displayed
  const [linksLimit, setLinksLimit] = useState(defaultLinksNumber);

  // Set whether excursion loops are shown in the graph, visible by default
  const [showExcursions, setShowExcursions] = useState(true);

  // Set the selected clusters analysis
  // By default we will set the overall structure, which should be always found
  const [selectedAnalysis, setSelectedAnalysis] = useState('Overall');

  // Request a summary of the available clusters analyses to the API
  const clustersSummary = useAPI(`${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/clusters`);
  // Memoize the available analyses for the selector
  const availableAnalyses = useMemo(() => clustersSummary && clustersSummary.payload &&
    clustersSummary.payload.map(analysis => analysis.name), [clustersSummary]);

  // Find the selected analysis name
  const selectedAnalysisName = useMemo(() => {
    // Wait until we have the clusters summary available
    if (!clustersSummary.payload) return;
    // Find the name of the selected analysis according to the summary
    const analysis = clustersSummary.payload.find(analysis => analysis.name === selectedAnalysis);
    if (!analysis) throw new Error(`Analysis ${selectedAnalysis} is not found in the summary`);
    // Finally return the analysis name
    return analysis.analysis;
  }, [selectedAnalysis, clustersSummary.payload]);

  // Request the selected analysis data to the API
  const selectedAnalysisURL = selectedAnalysisName
  ? `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/${selectedAnalysisName}`
  : null;
  const clustersAnalysis = useAPI(selectedAnalysisURL);

  // Conserve a backed up cluster data
  // If the current analysis is changed keep the old results as we wait for the new payload
  // Thus all already rendered elements can use old data and the rerender is way more smooth
  // IMPORTANT: Payload values are used widely among rendered components
  // IMPORTANT: For this reason there is no render if there is no payload
  // IMPORTANT: If this is not done there is a brief render which displays nothing
  // IMPORTANT: Then the data update looks almost like a refresh
  const clustersDataRef = useRef(clustersAnalysis.payload);
  // Save cluster data only when the payload available
  useMemo(() => {
    // If the payload is ready then set it as the reference
    if (!clustersAnalysis.payload) return;
    clustersDataRef.current = clustersAnalysis.payload;
  }, [clustersAnalysis.payload]);
  // Get the current reference value
  const clustersData = clustersDataRef.current;

  // Download all cluster screenshots
  // First set the URLs for the API
  const screenshotsUrls = useMemo(() => {
    // Wait until we know the selected analysis name
    if (!selectedAnalysisName) return [];
    // Find screenshot filenamese
    const selectedAnalysisFilename = selectedAnalysisName.replace('-', '_');
    const screenshotHeaderNames = `${selectedAnalysisFilename}_screenshot_`;
    // WARNING: The sort may seem redundant, but if there was any reupload then images may be disordered
    const screenshotFilenames = files.filter(filename => filename.includes(screenshotHeaderNames)).sort();
    // Sort them according to their numeration so they match
    return screenshotFilenames.map(
      filename => `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/files/${filename}`
    );
  }, [files, selectedAnalysisName]);

  // Now perform the API calls
  const screenshotsResponses = useBatchAPI(screenshotsUrls);
  const screenshotLoading = screenshotsResponses.some(response => response.loading);

  // Conserve backed up screenshots
  // Same reason as explained above in clustersDataRef
  const screenshotsRef = useRef(null);
  // Parse and save the screenshot images
  useMemo(() => {
    if (screenshotLoading) return;
    screenshotsRef.current = screenshotsResponses.map(response => {
      if (!response) return null;
      if (!response.payload) return null;
      return 'data:image/png;base64,' + Buffer.from(response.payload, 'binary').toString('base64');
    });
  }, [screenshotsResponses, screenshotLoading]);
  // Get the current reference screenshots
  const screenshots = screenshotsRef.current;

  // Set the nodes and links to be represented in the Markov graph
  // For every node, set its area according to its population value and then calculate its radius
  // For every link, set is thickness according to the RMSD between the two frames it is connecting
  const { graphData, availableTransitionsNumber, representedPercent, clusterIndices, version, step, hasExcursions } = useMemo(() => {
    if (!clustersData) return {};
    // Add the index to every cluster in the original data
    // This allos us to sorth them without loosing track of cluster indices, which are used in transitions
    clustersData.clusters.forEach((cluster, i) => { cluster.index = i });
    // Sort clusters by number of frames
    // Set a new list to avoid mutating the original
    const nodeSortingFunction = (clusterA, clusterB) => clusterB.frames.length - clusterA.frames.length;
    const sortedClusters = [ ...clustersData.clusters ].sort(nodeSortingFunction);
    // Get as many clusters as the nodes limit starting by the most populated
    const filteredClusters = sortedClusters.slice(0, nodesLimit);
    // Mine data from the sorted clusters
    const mainFrames = filteredClusters.map(cluster => cluster.main)
    const clusterSizes = filteredClusters.map(cluster => cluster.frames.length);
    const totalFrames = clusterSizes.reduce((acc, curr) => acc + curr, 0);
    const populations = clusterSizes.map(size => size / totalFrames);
    const clusterIndices = filteredClusters.map(cluster => cluster.index);
    // Set the populations cutoff according to the maximum populations value to remove nodes
    const maximumPopulation = populations[0];
    // Set nodes: objects containing both the frame and the population
    const nodes = [];
    populations.forEach((population, i) => {
      // Set the area of the current node, floored so low-population clusters stay visible
      const area = Math.max(population * maxNodeArea / maximumPopulation, minNodeArea);
      // Calculate the radius from the area
      const radius = Math.sqrt(area / Math.PI);
      // Set the node and add it to the list
      const node = {
        id: i,
        radius: radius,
        value: mainFrames[i],
        // Set the text to be displayed as a tooltip when the node is hovered
        // Populations is a percent in a 0 to 1 format, so we multipley by an extra 100 to get the actual percent
        text: `Cluster: ${i}\nPopulation: ${Math.round(population * 10000) / 100} %\nFrame: ${mainFrames[i]}`,
      };
      nodes.push(node);
    });
    // Set the transitions between clusters as the links
    // Discard self transitions, since they are not drawable, and count the rest
    // Note that this total includes clusters which are not displayed, thus it does not depend on the limits
    const drawableTransitions = clustersData.transitions.filter(
      transition => transition.from !== transition.to);
    const totalTransitionsCount = drawableTransitions.reduce((acc, curr) => acc + curr.count, 0);
    // Find transitions between available nodes
    const availableTransitions = drawableTransitions.filter(transition =>
      clusterIndices.includes(transition.from) && clusterIndices.includes(transition.to));
    // Translate cluster indices to node indices, keeping also the size of the connected clusters
    const nodeTransitions = availableTransitions.map(transition => {
      const from = clusterIndices.indexOf(transition.from);
      if (from === -1) throw new Error('Not found source cluster index');
      const to = clusterIndices.indexOf(transition.to);
      if (to === -1) throw new Error('Not found target cluster index');
      return {
        from: from,
        to: to,
        count: transition.count,
        size: clusterSizes[from] + clusterSizes[to],
        // Only the first frame group is used, padded with one frame on each side
        frames: transition.frames && transition.frames.length
          ? padFrameGroup(transition.frames[0])
          : undefined,
      };
    });
    // Save the number of available transitions with the given available nodes
    const availableTransitionsNumber = nodeTransitions.length;
    // Set excursions (frames leaving a cluster and coming back to it) as loops, one per cluster
    const availableExcursions = (clustersData.excursions || []).filter(excursion =>
      clusterIndices.includes(excursion.cluster));
    const nodeExcursions = availableExcursions.map(excursion => ({
      node: clusterIndices.indexOf(excursion.cluster),
      // Only the first frame group is used, padded with one frame on each side
      frames: excursion.frames && excursion.frames.length
        ? padFrameGroup(excursion.frames[0])
        : undefined,
    }));
    // Merge excursions belonging to the same cluster into a single loop
    // Only the first excursion's frames are kept, so a click always loads a single contiguous range
    const loopsMap = new Map();
    nodeExcursions.forEach(excursion => {
      let loop = loopsMap.get(excursion.node);
      if (!loop) {
        loop = { node: excursion.node, count: 0, frames: excursion.frames };
        loopsMap.set(excursion.node, loop);
      }
      loop.count += 1;
    });
    const loops = [ ...loopsMap.values() ];
    // Find the maximum and minimum counts among all available transitions and excursion loops
    // Note that they do not depend on the links limit, thus widths do not change when using the slider
    // Loops share this same scale with transitions, so both are drawn with comparably meaningful widths
    const allCounts = [ ...nodeTransitions, ...loops ].map(item => item.count);
    const maxCount = Math.max(...allCounts);
    const minCount = Math.min(...allCounts);
    // Set a function to interpolate a transitions/excursions count to its corresponding width
    const countToWidth = count => {
      // A direction with no transitions gets no arrow
      if (count === 0) return zeroLinkWidth;
      // If there is only one possible width then set it to the maximum width
      if (maxCount === minCount) return maxLinkWidth;
      return minLinkWidth + (count - minCount) * (maxLinkWidth - minLinkWidth) / (maxCount - minCount);
    };
    // Keep as many transitions as requested by the user, the most transited ones first
    // Note that the size of the connected clusters is used as a tie breaker
    const transitionSortingFunction = (transitionA, transitionB) =>
      (transitionB.count - transitionA.count) || (transitionB.size - transitionA.size);
    const displayedTransitions = nodeTransitions.sort(transitionSortingFunction).slice(0, linksLimit);
    // Calculate the percent of the overall transitions which is represented by the displayed arrows
    const displayedTransitionsCount = displayedTransitions.reduce((acc, curr) => acc + curr.count, 0);
    const representedPercent = totalTransitionsCount === 0
      ? 0
      : Math.round(displayedTransitionsCount * 1000 / totalTransitionsCount) / 10;
    // Merge both transitions between a pair of nodes in a single link, but keeping their counts apart
    // Then the link is drawn as two arrows, each one as wide as the transitions in its direction
    const linksMap = new Map();
    displayedTransitions.forEach(transition => {
      // Set the link nodes in a direction independent way, so both directions fall in the same link
      const source = Math.min(transition.from, transition.to);
      const target = Math.max(transition.from, transition.to);
      // Get the already existing link between these nodes or set a new one
      const key = `${source}-${target}`;
      let link = linksMap.get(key);
      if (!link) {
        link = { source: source, target: target, sourceCount: 0, targetCount: 0, sourceFrames: [], targetFrames: [] };
        linksMap.set(key, link);
      }
      // Add the counts to the direction they belong to
      // Note that the 'source count' is the number of transitions leaving the source node
      if (transition.from === source) {
        link.sourceCount += transition.count;
        if (transition.frames) link.sourceFrames.push(...transition.frames);
      } else {
        link.targetCount += transition.count;
        if (transition.frames) link.targetFrames.push(...transition.frames);
      }
    });
    const links = [ ...linksMap.values() ];
    // Set the width and the tooltip of both arrows of every displayed link
    links.forEach(link => {
      link.sourceWidth = countToWidth(link.sourceCount);
      link.targetWidth = countToWidth(link.targetCount);
      // Set the overall width, which is used to calculate the link force strength
      link.width = link.sourceWidth + link.targetWidth;
      link.sourceText = `Transitions ${link.source} → ${link.target}: ${link.sourceCount}`;
      link.targetText = `Transitions ${link.target} → ${link.source}: ${link.targetCount}`;
      // Drop empty frame lists so arrows with no frames data are not rendered as clickable
      if (link.sourceFrames.length === 0) link.sourceFrames = undefined;
      if (link.targetFrames.length === 0) link.targetFrames = undefined;
    });
    // Push excursion loops as links too, sharing the very same count-to-width scale as transitions
    if (showExcursions) loops.forEach(loop => {
      links.push({
        source: loop.node,
        target: loop.node,
        width: countToWidth(loop.count),
        text: `Excursions from ${loop.node}: ${loop.count}`,
        frames: loop.frames,
      });
    });
    // Mine also the step and analysis version from the cluster data
    const version = new Version(clustersData.version);
    const step = clustersData.step;
    // Return both nodes and links inside an object
    const graphData = { nodes: nodes, links: links };
    return {
      graphData, availableTransitionsNumber, representedPercent, clusterIndices, version, step,
      // Older analysis versions have no excursions data at all, so there is nothing to toggle
      hasExcursions: loops.length > 0,
    };
  }, [clustersData, nodesLimit, linksLimit, showExcursions]);

  // Set the displayed screenshots in the right order
  const displayedScreenshots = useMemo(() => {
    if (!clusterIndices || !screenshots) return;
    return clusterIndices.map(index => screenshots[index]);
  }, [clusterIndices, screenshots]);

  const liveViewerRef = useRef(null);

  const handleNodeSelect = useCallback(node => {
    // DANI: En las primeras versiones de este análisis la frame de los nodos están mal
    // DANI: Es la frame de la trayectoria reducida, no de la completa
    // DANI: De manera que se arregla multiplicandola por el step
    const newFrame = version.equals('0.0') ? node.value * step : node.value;
    // If the live viewer was showing a transition trajectory then close it so a fresh one mounts
    if (liveViewerRef.current && liveViewerRef.current.frames) liveViewerRef.current.close();
    setSelectedTransitionFrames(null);
    setSelectedFrame(newFrame);
  }, [setSelectedFrame, version, step]);

  // Set when a transition arrow is clicked: load its frames in the viewer as a trajectory
  const handleArrowSelect = useCallback(arrow => {
    // Always close the live viewer: its 'startingComponents' would otherwise never be updated,
    // be it because it was showing a single frame or a different transition altogether
    if (liveViewerRef.current) liveViewerRef.current.close();
    setSelectedFrame(null);
    setSelectedTransitionFrames(arrow.frames);
  }, [setSelectedFrame]);

  // Build the viewer request for the currently selected node or transition arrow, if any
  const newViewer = useMemo(() => {
    if (selectedTransitionFrames) return {
      frames: selectedTransitionFrames,
      startingComponents: [
        { trajectoryURLs: [ `/trajectory?frames=${framesToQuery(selectedTransitionFrames)}` ] },
      ],
      framesSelect: false,
    };
    // Provide 'startingComponents' explicitly here too (mirroring what ViewerWithControls would
    // fill in by default), instead of leaving it undefined: that implicit default-filling path is
    // the one that goes blank after a remount, while an explicit 'startingComponents' reliably works
    if (selectedFrame !== null) return {
      requestedFrame: selectedFrame,
      startingComponents: [ { trajectoryURLs: [ '/trajectory' ] } ],
    };
    return null;
  }, [selectedFrame, selectedTransitionFrames]);

  // Keep track of the currently live (not nailed) viewer object, once ViewerSpawner has attached
  // its 'close'/'nail' handlers to it, so it can be closed programmatically from above
  // This is needed because ViewerWithControls only reacts to a changed 'startingComponents' prop
  // by remounting: it never re-reads it once mounted. So switching in/out of a transition's
  // trajectory (which uses 'startingComponents') requires closing the live viewer first, which
  // frees up its id and forces ViewerSpawner to mount a brand new one for the new selection
  useEffect(() => {
    liveViewerRef.current = newViewer;
  }, [newViewer]);

  // Render loading or error messages according with the API response as we wait for data
  if (!clustersData) {
    if (clustersAnalysis.loading) return <Loading />;
    if (clustersAnalysis.error) return clustersAnalysis.error.toString();
    return 'Something bad happened';
  }

  // Render loading message according to screenshot downloads
  if (!displayedScreenshots) return <Loading />;

  return (
    <>
      <Card>
        <div className={clustersAnalysis.loading ? style.disabled : style.enabled}>
          {/* The selector floats over the graph, which has plenty of empty space in its corners */}
          <div className={style['graph-holder']}>
            <MarkovGraph
              data={graphData}
              images={displayedScreenshots}
              selectedNodeValue={selectedFrame}
              onSelectNode={handleNodeSelect}
              onSelectArrow={handleArrowSelect}
              className={style.graph}
            />
            <div className={style['floating-selector']}>
              <Selector
                options={availableAnalyses}
                selection={selectedAnalysis}
                setter={setSelectedAnalysis}
              />
            </div>
          </div>
          <CardContent>
            <div className={style.horizontal}>
              <Typography variant="h7" className={style.wide30}>{'Number of nodes: '}</Typography>
              <Slider
                title="Change number of nodes"
                value={nodesLimit}
                aria-labelledby="continuous-slider"
                onChange={(_, value) => { setNodesLimit(value) }}
                min={2}
                max={clustersData.clusters.length}
                valueLabelDisplay="auto"
                className={style.wide75}
              />
            </div>
            <div className={style.horizontal}>
              <Typography variant="h7" className={style.wide30}>{'Number of transitions: '}</Typography>
              <Slider
                title="Change the number of transitions"
                value={linksLimit}
                aria-labelledby="continuous-slider"
                onChange={(_, value) => { setLinksLimit(value) }}
                min={0}
                max={availableTransitionsNumber}
                valueLabelDisplay="auto"
                className={style.wide75}
              />
            </div>
            {hasExcursions && <div className={style.horizontal}>
              <Typography variant="h7" className={style.wide30}>{'Show excursions: '}</Typography>
              <Switch
                title="Show/hide excursion loops"
                checked={showExcursions}
                onChange={(_, checked) => { setShowExcursions(checked) }}
              />
            </div>}
            <div className={style.horizontal}>
              <Typography variant="h7" className={style.wide30}>{'Represented transitions: '}</Typography>
              <Typography
                variant="h7"
                title="Percent of the overall transitions which is represented by the displayed arrows"
              >
                {`${representedPercent} %`}
              </Typography>
            </div>
          </CardContent>
        </div>
      </Card>
      <ViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={newViewer}
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer => {
          if (viewer.frames) setSelectedTransitionFrames(previous => viewer.frames === previous ? null : previous);
          else setSelectedFrame(previous => viewer.requestedFrame === previous ? null : previous);
        }}
        onClose={viewer => {
          if (viewer.frames) setSelectedTransitionFrames(previous => viewer.frames === previous ? null : previous);
          else setSelectedFrame(previous => viewer.requestedFrame === previous ? null : previous);
        }}
      />
    </>
  );
};

export default Clusters;
