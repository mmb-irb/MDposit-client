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
import { CardContent, Slider, Typography } from '@mui/material';
import Card from '../../../components/animated-card';
import Loading from '../../../components/loading';
// Analysis selector
import Selector from '../../../components/selector';
// Viewer pop-up windows
import ViewerSpawner from '../../../components/viewer-spawner';

const MarkovGraph = lazy(() =>
  import(/* webpackChunkName: 'graph-msm' */ '../../../components/graph-msm'),
);

// Set the maximum number of nodes
// Note that the hard limit of nodes is the number of values in data (now 20)
const defaultNodeNumber = 14;
// Set the maximum number of nodes
// Note that the hard limit of links is the possible combinations of pairs of nodes
const defaultLinksNumber = 20;

// Set the maximum node area in the graph, which is the area of the node with the highest population
// Note that the rest of node areas are proportional, so there is no need to set the minimum node area
const maxNodeArea = 10000;
// Set the maximum and minimum link widths in the graph
// Note that both are to be defined since width values are interpolated
const maxLinkWidth = 10;
const minLinkWidth = 1;

const Clusters = () => {

  // Get the current project metadata
  const { accessionAndMdNumber, files } = useContext(ProjectCtx);

  // Set when one point in the graph is selected
  const [selectedFrame, setSelectedFrame] = useState(null);

  // Set the number of nodes to be displayed
  const [nodesLimit, setNodesLimit] = useState(defaultNodeNumber);

  // Set the number of nodes to be displayed
  const [linksLimit, setLinksLimit] = useState(defaultLinksNumber);

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
    const screenshotFilenames = files.filter(filename => filename.includes(screenshotHeaderNames));
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
  const { graphData, availableLinks, clusterIndices } = useMemo(() => {
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
    const totalFrames = filteredClusters.reduce((acc, curr) => acc + curr.frames.length, 0);
    const populations = filteredClusters.map(cluster => cluster.frames.length / totalFrames);
    const clusterIndices = filteredClusters.map(cluster => cluster.index);
    // Set the populations cutoff according to the maximum populations value to remove nodes
    const maximumPopulation = populations[0];
    // Set nodes: objects containing both the frame and the population
    const nodes = [];
    populations.forEach((population, i) => {
      // Set the area of the current node
      const area = population * maxNodeArea / maximumPopulation;
      // Calculate the radius from the area
      const radius = Math.sqrt(area / Math.PI);
      // Set the node and add it to the list
      const node = {
        id: i,
        radius: radius,
        value: mainFrames[i],
        // Set the text to be displayed as a tooltip when the node is hovered
        // Populations is a percent in a 0 to 1 format, so we multipley by an extra 100 to get the actual percent
        text: `Population: ${Math.round(population * 10000) / 100} %\nFrame: ${mainFrames[i]}`,
      };
      nodes.push(node);
    });
    // Set the transitions between clusters as the links
    const links = [];
    // Find transitions between available nodes
    const availableTransitions = clustersData.transitions.filter(
      transition => clusterIndices.includes(transition.from) && clusterIndices.includes(transition.to));
    // Save the number of available links with the given available nodes
    const availableLinks = availableTransitions.length;
    // Sort transitions depending on their counts
    const transitionSortingFunction = (transitionA, transitionB) => transitionB.count - transitionA.count;
    const sortedTransitions = availableTransitions.sort(transitionSortingFunction);
    // Find the maximum and minimum transition counts
    const allCounts = sortedTransitions.map(transition => transition.count);
    const maxCount = allCounts[0];
    const minCount = allCounts[allCounts.length - 1];
    // Calculate the normalizer for the interpolation process
    const normalizer = maxCount === minCount
      ? 1 // If there is only one possible width then set it to the maximum width
      : (maxLinkWidth - minLinkWidth) / (minCount - maxCount);
    // Process as many links as requested by the user
    // Note that, with the current implementation, transitions between  pairs of nodes are merged
    // So we may have less links than transitions
    sortedTransitions.forEach((transition, i) => {
      if (i >= linksLimit) return;
      // Translate cluster indices to node indices
      const source = clusterIndices.indexOf(transition.from);
      if (source === -1) throw new Error('Not found source cluster index');
      const target = clusterIndices.indexOf(transition.to);
      if (target === -1) throw new Error('Not found target cluster index');
      // Set the width from the number of transitions count
      // Interpolate the current transitions count to obtain the corresponding width
      const width = maxLinkWidth - (transition.count - maxCount) * normalizer;
      // Check if we already have the opposite link
      const oppositeLink = links.find(link => link.source === target && link.target === source);
      // If so, merge their width
      if (oppositeLink) {
        // DANI: Esto es muy cutre y rompe incluso la interpolación, pero al ser temporal no merece la pena hacerlo mejor
        oppositeLink.width += width;
      }
      // Otherwise create new link
      else {
        const link = { source: source, target: target, width: width };
        links.push(link);
      }
    });
    // Return both nodes and links inside an object
    const graphData = { nodes: nodes, links: links };
    return { graphData, availableLinks, clusterIndices };
  }, [clustersData, nodesLimit, linksLimit]);

  // Set the displayed screenshots in the right order
  const displayedScreenshots = useMemo(() => {
    if (!clusterIndices || !screenshots) return;
    return clusterIndices.map(index => screenshots[index]);
  }, [clusterIndices, screenshots]);

  const handleNodeSelect = useCallback(node => {
    setSelectedFrame(node.value);
  }, [setSelectedFrame]);

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
      <Selector
        label={'Clusters analysis'}
        options={availableAnalyses}
        selection={selectedAnalysis}
        setter={setSelectedAnalysis}
      />
      <Card>
        <div className={clustersAnalysis.loading ? style.disabled : style.enabled}>
          <MarkovGraph
            data={graphData}
            images={displayedScreenshots}
            selectedNodeValue={selectedFrame}
            onSelectNode={handleNodeSelect}
            className={style.graph}
          />
          <CardContent>
            <div className={style.horizontal}>
              <Typography variant="h7" className={style.wide25}>{'Number of nodes: '}</Typography>
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
              <Typography variant="h7" className={style.wide25}>{'Number of links: '}</Typography>
              <Slider
                title="Change the RMSD cutoff"
                value={linksLimit}
                aria-labelledby="continuous-slider"
                onChange={(_, value) => { setLinksLimit(value) }}
                min={0}
                max={availableLinks}
                valueLabelDisplay="auto"
                className={style.wide75}
              />
            </div>
          </CardContent>
        </div>
      </Card>
      <ViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={selectedFrame
          ? { requestedFrame: selectedFrame }
          : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelectedFrame(previous => {
            if (viewer.requestedFrame === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelectedFrame(previous => {
            if (viewer.requestedFrame === previous) return null;
            else return previous;
          })
        }
      />
    </>
  );
};

export default Clusters;
