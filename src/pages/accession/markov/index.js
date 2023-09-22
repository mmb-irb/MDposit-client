import React, { lazy, useContext, useState, useMemo, useCallback } from 'react';

import Card from '../../../components/animated-card';
import NGLViewerSpawner from '../../../components/ngl-viewer-in-dnd';

import style from './style.module.css';

import useAPI from '../../../hooks/use-api';
import useBatchAPI from '../../../hooks/use-batch-api';
import { ProjectCtx } from '../../../contexts';
import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import Loading from '../../../components/loading';
import { CardContent, Slider, Typography } from '@mui/material';

const MarkovGraph = lazy(() =>
  import(/* webpackChunkName: 'graph-msm' */ '../../../components/graph-msm'),
);

// Set the maximum number of nodes
// Note that the hard limit of nodes is the number of values in data (now 20)
const defaultNodeNumber = 14;
// Set the maximum number of nodes
// Note that the hard limit of links is the possible combinations of pairs of nodes
const defaultLinksNumber = 20;

// Alternative - RMSD cutoff
//const rmsdFoldCutoff = 1.6;

// Set the maximum node area in the graph, which is the area of the node with the highest population
// Note that the rest of node areas are proportional, so there is no need to set the minimum node area
const maxNodeArea = 10000;
// Set the maximum and minimum link widths in the graph
// Note that both are to be defined since width values are interpolated
const maxLinkWidth = 10;
const minLinkWidth = 1;

const Markov = () => {

  // Get the current project metadata
  const { accession, accessionAndMdNumber, files } = useContext(ProjectCtx);

  // Set when one point in the graph is selected
  const [selectedFrame, setSelectedFrame] = useState(null);

  // Set the number of nodes to be displayed
  const [nodesLimit, setNodesLimit] = useState(defaultNodeNumber);

  // Set the number of nodes to be displayed
  const [linksLimit, setLinksLimit] = useState(defaultLinksNumber);

  // Send a request to the API with the url of the analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/markov/`,
  );

  // Download all markov screenshots
  // First set the URLs for the API
  const markov_screenshots_urls = useMemo(() => {
    // Find markov screenshot filenames
    const markov_screenshot_filenames = files.filter(filename => filename.includes('markov_screenshot'));
    // Sort them according to their numeration so they match
    return markov_screenshot_filenames.map(
      markov_screenshot_filename => `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/files/${markov_screenshot_filename}`
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
  const { graphData, availableLinks } = useMemo(() => {
    if (!payload) return {};
    // Set the populations cutoff according to the maximum populations value to remove nodes
    // Maximum populations value is the first populations value since they are sorted
    const maximumPopulation = payload.populations[0];
    // Set nodes: objects containing both the frame and the population
    const nodes = [];
    payload.populations.forEach((population, i) => {
      // If we have already appended as many nodes as admited then stop here
      if (i >= nodesLimit) return;
      // Set the area of the current node
      const area = population * maxNodeArea / maximumPopulation;
      // Calculate the radius from the area
      const radius = Math.sqrt(area / Math.PI);
      // Set the node and add it to the list
      const node = {
        id: i,
        radius: radius,
        value: payload.frames[i],
        // Set the text to be displayed as a tooltip when the node is hovered
        // Populations is a percent in a 0 to 1 format, so we multipley by an extra 100 to get the actual percent
        text: `Population: ${Math.round(population * 10000) / 100} %\nFrame: ${payload.frames[i]}`
      };
      nodes.push(node);
    });
    // Count the number of final nodes, to know which RMSD links are to be discarded
    const nodeCount = nodes.length;
    // First of all get all link RMSDs, avoiding repetitions and 0 values
    const rmsdValues = []
    payload.rmsd_matrix.forEach((rmsd_row, i) => {
      // The node for this link is missing
      if (i >= nodeCount) return;
      rmsd_row.forEach((rmsd, j) => {
        // The node for this link is missing
        if (j >= nodeCount) return;
        // If i > j the link has been set already
        // If i = j the RMSD is 0
        if (i >= j) return;
        rmsdValues.push(rmsd);
      });
    });
    // Count the number of possible links according to the number of nodes
    const availableLinks = rmsdValues.length;
    // Set links, objects containing the two nodes to be connected and the width if the link
    const links = [];
    if (linksLimit > 0) {
      // Sort RMSD values to get the maximum and minimum values
      const sortedRmsds = rmsdValues.sort();
      // Set the minimum and maximum RMSD values
      const minimumRmsd = sortedRmsds[0];
      const maximumRmsdCutoff = linksLimit < availableLinks
        ? sortedRmsds[linksLimit - 1]
        : sortedRmsds[availableLinks - 1];
      // Calculate the normalizer for the interpolation process
      const normalizer = maximumRmsdCutoff === minimumRmsd
        ? 1 // If there is only one link then set it to the maximum width
        : (maxLinkWidth - minLinkWidth) / (maximumRmsdCutoff - minimumRmsd);
      // Set link objects
      payload.rmsd_matrix.forEach((rmsd_row, i) => {
        // The node for this link is missing
        if (i >= nodeCount) return;
        rmsd_row.forEach((rmsd, j) => {
          // The node for this link is missing
          if (j >= nodeCount) return;
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
    }
    // // Set the RMSD cutoff according to the minimum RMSD to remove links
    // // Find the minimum non-zero RMSD value
    // const minimumRmsd = payload.rmsd_matrix.reduce((current_value, new_row) => {
    //   return Math.min(current_value, new_row.reduce((local_current_value, new_value) => {
    //     return new_value === 0 ? local_current_value : Math.min(local_current_value, new_value);
    //   }, Infinity))
    // }, Infinity);
    // // Set the maximum RMSD cutoff to discard a link
    // const maximumRmsdCutoff = minimumRmsd * rmsdFoldCutoff;
    // // Calculate the normalizer for the interpolation process
    // const normalizer = (maxLinkWidth - minLinkWidth) / (maximumRmsdCutoff - minimumRmsd);
    // // Set links, objects containing the two nodes to be connected and the width if the link
    // const links = [];
    // payload.rmsd_matrix.forEach((rmsd_row, i) => {
    //   // The node for this link is missing
    //   if (i >= nodeCount) return;
    //   rmsd_row.forEach((rmsd, j) => {
    //     // The node for this link is missing
    //     if (j >= nodeCount) return;
    //     // If i > j the link has been set already
    //     // If i = j the RMSD is 0
    //     if (i >= j) return;
    //     // Check the cuttoff
    //     if (rmsd > maximumRmsdCutoff) return;
    //     // Interpolate the current rmsd to obtain the corresponding width
    //     const width = maxLinkWidth - (rmsd - minimumRmsd) * normalizer;
    //     // Set a new link and add it to the list
    //     // Note that there is actually not 'source' and 'target', but these are the d3 expected names
    //     // Width score is inverse to RMSD: the lowest the RMSD, the widthest the link must be
    //     const link = { source: i, target: j, width: width };
    //     links.push(link);
    //   });
    // });
    // Return both nodes and links inside an object
    const graphData = { nodes: nodes, links: links };
    return { graphData, availableLinks };
  }, [payload, nodesLimit, linksLimit]);

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
          data={graphData}
          images={markov_screenshots}
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
              max={payload.populations.length}
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
      </Card>
      <NGLViewerSpawner
        // Set the new viewer or null if there is not a proper "selected" value
        newViewer={selectedFrame
          ? {
              accession: accession,
              requestedFrame: selectedFrame,
            }
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

export default Markov;
