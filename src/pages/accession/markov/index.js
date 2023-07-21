import React, { lazy, useContext, useState, useMemo, useCallback } from 'react';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';

import style from './style.module.css';

import useAPI from '../../../hooks/use-api';
import useBatchAPI from '../../../hooks/use-batch-api';
import { ProjectCtx } from '../../../contexts';
import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import Loading from '../../../components/loading';

const MarkovGraph = lazy(() =>
  import(/* webpackChunkName: 'graph-msm' */ '../../../components/graph-msm'),
);

// Set the meaningless populations cutoff as a percent of the maximum population
const populationsFoldCutoff = 0.1;
// Set the maximum RMSD cutoff as a percent of the minimum RMSD
const rmsdFoldCutoff = 1.5;

// Set the maximum number of nodes
// Note that the hard limit of nodes is the number of values in data (now 20)
const nodesLimit = 10;

// Set the maximum node area in the graph, which is the area of the node with the highest population
// Note that the rest of node areas are proportional, so there is no need to set the minimum node area
const maxNodeArea = 2500;
// Set the maximum and minimum link widths in the graph
// Note that both are to be defined since width values are interpolated
const maxLinkWidth = 10;
const minLinkWidth = 1;

const Markov = () => {

  // Get the current project metadata
  const { accession, files } = useContext(ProjectCtx);

  // Set when one point in the graph is selected
  const [selectedFrame, setSelectedFrame] = useState(null);

  // Send a request to the API with the url of the analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}${accession}/analyses/markov/`,
  );

  // Download all markov screenshots
  // First set the URLs for the API
  const markov_screenshots_urls = useMemo(() => {
    // Find markov screenshot filenames
    const filenames = files.map(file => file.filename);
    const markov_screenshot_filenames = filenames.filter(filename => filename.includes('markov_screenshot'));
    // Sort them according to their numeration so they match
    return markov_screenshot_filenames.map(
      markov_screenshot_filename => `${BASE_PATH_PROJECTS}${accession}/files/${markov_screenshot_filename}`
    );
  }, [files]);
  // Now perform the API calls
  const markov_screenshots_responses = useBatchAPI(markov_screenshots_urls);
  const markov_screenshot_loading = markov_screenshots_responses.some(response => response.loading);
  // Parse the screenshot images
  const markov_screenshots = useMemo(() => {
    if (markov_screenshot_loading) return;
    return markov_screenshots_responses.map(response => {
      if (!response) return null;
      if (!response.payload) return null;
      return 'data:image/png;base64,' + Buffer.from(response.payload, 'binary').toString('base64');
    });
  }, [markov_screenshots_responses, markov_screenshot_loading]);

  // Set the nodes and links to be represented in the Markov graph
  // For every node, set its area according to its population value and then calculate its radius
  // For every link, set is thickness according to the RMSD between the two frames it is connecting
  const graphData = useMemo(() => {
    if (!payload) return;
    // Set the populations cutoff according to the maximum populations value to remove nodes
    // Maximum populations value is the first populations value since they are sorted
    const maximumPopulation = payload.populations[0];
    const minimumPopulationCutoff = maximumPopulation * populationsFoldCutoff;
    // Set nodes: objects containing both the frame and the population
    const nodes = [];
    payload.populations.forEach((population, i) => {
      // If we have already appended as many nodes as admited then stop here
      if (i >= nodesLimit) return;
      // If the population doest not reach the minimum cutoff the skip it
      if (population < minimumPopulationCutoff) return;
      // Set the area of the current node
      const area = population * maxNodeArea / maximumPopulation;
      // Calculate the radius from the area
      const radius = Math.sqrt(area / Math.PI);
      // Set the node and add it to the list
      const node = { id: i, radius: radius, value: payload.frames[i] };
      nodes.push(node);
    });
    // Count the number of final nodes, to know which RMSD links are to be discarded
    const node_count = nodes.length;
    // Set the RMSD cutoff according to the minimum RMSD to remove links
    // Find the minimum non-zero RMSD value
    const minimumRmsd = payload.rmsd_matrix.reduce((current_value, new_row) => {
      return Math.min(current_value, new_row.reduce((local_current_value, new_value) => {
        return new_value === 0 ? local_current_value : Math.min(local_current_value, new_value);
      }, Infinity))
    }, Infinity);
    // Set the maximum RMSD cutoff to discard a link
    const maximumRmsdCutoff = minimumRmsd * rmsdFoldCutoff;
    // Calculate the normalizer for the interpolation process
    const normalizer = (maxLinkWidth - minLinkWidth) / (maximumRmsdCutoff - minimumRmsd);
    // Set links, objects containing the two nodes to be connected and the width if the link
    const links = [];
    payload.rmsd_matrix.forEach((rmsd_row, i) => {
      // The node for this link is missing
      if (i >= node_count) return;
      rmsd_row.forEach((rmsd, j) => {
        // The node for this link is missing
        if (j >= node_count) return;
        // If i > j the link has been set already
        // If i = j the RMSD is 0
        if (i >= j) return;
        // Check the cuttoff
        if (rmsd > maximumRmsdCutoff) return;
        // Interpolate the current rmsd to obtain the corresponding width
        const width = maxLinkWidth - (rmsd - minimumRmsd) * normalizer;
        // Set a new link and add it to the list
        // Note that there is actually not 'source' and 'target', but these are the d3 expected names
        // Width score is inverse to RMSD: the lowest the RMSD, the widthest the link must be
        const link = { source: i, target: j, width: width };
        links.push(link);
      });
    });
    // Return both nodes and links inside an object
    return {
      nodes: nodes,
      links: links,
    };
  }, [payload]);

  const handleNodeSelect = useCallback(node => {
    setSelectedFrame(node.value);
  }, [setSelectedFrame]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened';
  // Render loading message according to screenshot downloads
  if (markov_screenshot_loading) return <Loading />;

  return (
    <>
      <Card>
        <MarkovGraph
          graphData={graphData}
          images={markov_screenshots}
          selectedNodeValue={selectedFrame}
          onSelectNode={handleNodeSelect}
          className={style.graph}
        />
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={selectedFrame
          ? {
              accession: accession,
              requestedFrame: selectedFrame,
              // This is used only as a tag for the onNail and onClose functions below
              // It has no effect on the viewer
              xSelection: selectedFrame,
            }
          : null
        }
        // If the nailed/closed viewer is the current viewer then reset the 'selected'
        onNail={viewer =>
          setSelectedFrame(previous => {
            if (viewer.xSelection === previous) return null;
            else return previous;
          })
        }
        onClose={viewer =>
          setSelectedFrame(previous => {
            if (viewer.xSelection === previous) return null;
            else return previous;
          })
        }
      />
    </>
  );
};

export default Markov;
