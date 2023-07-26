import React, {
  useRef,
  useEffect,
  forwardRef,
} from 'react';
import { noop } from 'lodash-es';
import {
  select,
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
} from 'd3';

import style from './style.module.css';

import imagePlaceholder from '../../images/random_molecule.png';

const dataPlaceholder = { nodes: [], links: [] };

// Set display colors
const colors = {
  default: "black",
  hovered: "blue",
  selected: "green"
}
const strokeWidths = {
  default: 2,
  hovered: 3,
  selected: 4
}

// This graph has been done by adapting the example from https://d3-graph-gallery.com/graph/network_basic.html

// The expected input data is:
// {
//    nodes: [
//      {
//        // Index from 0 to n
//        id: 0,
//        // Circle radius to be drawn to represent this node
//        radius: 17,
//        // Value to be returned on select
//        value: 123
//      },
//      ...
//    ],
//    links: [
//      {
//        // One of the nodes
//        source: 0,
//        // The other node
//        target: 1,
//        // Line width to be drawn to represent this link
//        width: 3
//      },
//      ...
//    ]
// }

const MarkovGraph = forwardRef(({
  // Data containing both nodes and links
  data,
  // Images to be drawn over nodes
  images,
  // Set a list of currently selected node
  selectedNodeValue,
  // Triggers for when the user selects a nodes
  onSelectNode,
  // Force a classname for the overall component element
  className,
}, ref) => {
  // Set a fake dataset to allow the graph to work when no data is passed
  if (!data) data = dataPlaceholder;

  // Referenced document element where d3 is rendered
  const containerRef = useRef(null);
  // Referenced function which allows to update the cart without having to remake it
  const updateDataRef = useRef(noop);
  const updateImagesRef = useRef(noop);
  const updateSelectedNodeValueRef = useRef(noop);
  const updateOnSelectRef = useRef(noop);
  const updateSizeRef = useRef(noop);

  // ----------------------------------------------------------------------------------------

  // This useEffect must be run only once
  // The graph content is updated through the referenced functions
  useEffect(() => {
    // Set the graph main handlers
    const graph = select(containerRef.current).append('svg');
    const defs = graph.append('svg:defs');

    // Set two 'g' elements for nodes and links to be attached to them instead of to the graph element itself
    // Then declare links before nodes to ensure nodes will be drawn over links in the 'z' dimension and not the opposite
    const linksParent = graph.append("g")
    const nodesParent = graph.append("g")

    // Initiate the forces handler
    // This runs the logic which sets the nodes positions
    const simulation = forceSimulation();

    // --------------------------------------------------------------------------------------------------

    // Set the updating functions
    // These functions are called by specific useEffects declared below when an specific input changes

    // Set a function to update data changes
    updateDataRef.current = ({ data }) => {
      // Get data nodes and links
      let { nodes: dataNodes, links: dataLinks } = data;

      // Set the links ------------------------------------------------------------------------------------

      // Get the current link lines
      let linkLines = linksParent.selectAll("line");

      // Copy input data instead to prevent further mutation
      dataLinks = dataLinks.map(d => Object.assign({}, d));

      // Load new data in the link lines
      const newLinkLinesData = linkLines.data(dataLinks);

      // Remove link lines which are no longer necessary according to new data
      newLinkLinesData.exit().remove();

      // Add new link lines which are now necessary according to new data
      newLinkLinesData.enter().append("line")
        .style("stroke", "#aaa");

      // Get all definitive link lines now that we have removed/added some link lines
      linkLines = linksParent.selectAll("line");

      // Update definitive link lines according to new data
      linkLines
        .attr("stroke-width", d => d.width);

      // Set the nodes ------------------------------------------------------------------------------------

      // Get all the already existing node circles
      let nodeCircles = nodesParent.selectAll("circle");

      // Copy current data to recicle old node/link positions and velocities, so we do not start from 0 every time
      // This results in a softer transition by avoiding the jump of all nodes and links to their original positions
      // This was get from here https://observablehq.com/@d3/modifying-a-force-directed-graph
      const backup = new Map(nodeCircles.data().map(d => [d.id, d]));
      dataNodes = dataNodes.map(d => Object.assign(backup.get(d.id) || {}, d));

      // Load new nodes data in node circles
      const newNodeCirclesData = nodeCircles.data(dataNodes);

      // Remove node circles which are no longer necessary according to new data
      newNodeCirclesData.exit().remove();

      // Add new circles which are now necessary according to new data
      newNodeCirclesData.enter().append("circle")
        .style("fill", "#fff") // Default color, but they are re-painted with the image below

      // Get all definitive node circles now that we have removed/added some node circles
      nodeCircles = nodesParent.selectAll("circle");

      // Update definitive node circles according to new data
      nodeCircles
        .attr("r", d => d.radius)
        .style("stroke", d => selectedNodeValue === d.value ? colors.selected : colors.default)
        .style("stroke-width", d => selectedNodeValue === d.value ? strokeWidths.selected : strokeWidths.default)
        .style("cursor", onSelectNode && "pointer")
        // WARNING: Here you need to use 'function' instead of an arrow function or 'this' does not work
        .on("mouseover", function() {
          select(this)
          .style("stroke", colors.hovered)
          .style("stroke-width", strokeWidths.hovered);
        })
        .on("mouseout", function() {
          select(this)
          .style("stroke", d => selectedNodeValue === d.value ? colors.selected : colors.default)
          .style("stroke-width", d => selectedNodeValue === d.value ? strokeWidths.selected : strokeWidths.default)
        })
        .on("click", onSelectNode)
        .append("svg:title")
          .text(d => d.text);

      // Set node images ------------------------------------------------------------------------------------

      // Get the current node image patterns
      let nodeImagePatterns = defs.selectAll("pattern");

      // Load new data in the node image patterns
      const newNodeImagePatternData = nodeImagePatterns.data(dataNodes);

      // Remove node image patterns which are no longer necessary according to new data
      newNodeImagePatternData.exit().remove();

      // Add new node image patterns which are now necessary according to new data
      newNodeImagePatternData.enter().append('pattern')
        .attr("patternUnits", "userSpaceOnUse");

      // Get all definitive node image patterns now that we have removed/added some node image patterns
      nodeImagePatterns = defs.selectAll("pattern");

      // Update definitive node image patterns according to new data
      nodeImagePatterns
        .attr('id', d => 'img' + d.id)
        .attr('width',  d => d.radius * 2)
        .attr('height', d => d.radius * 2)
        // Cleanup previous possible images since they will be re-appended rigth away
        .selectAll("image").remove();

      const nodeImages = nodeImagePatterns.append("image")
        .attr('xlink:href', (d,i) => (images && images[i]) || imagePlaceholder)
        .attr('width',  d => d.radius * 2)
        .attr('height', d => d.radius * 2);

      // Set a function to update when input images change
      // DANI: No se ha provado
      updateImagesRef.current = ({ images }) => {
        nodeImages.attr('xlink:href', (d,i) => (images && images[i]) || imagePlaceholder);
      }

      // Now fill nodes with their corresponding images
      nodeCircles
        .style("fill", d => `url(#img${d.id})`)

      // Set the forces ------------------------------------------------------------------------------------

      // Note that there is an additional force which is not data-dependent, but size-dependent
      // This force is not set here but in the updateSizeRef function

      simulation
        .nodes(dataNodes)
        // This force provides links between nodes
        .force("link", forceLink()
          .strength(d => d.width * 0.01)
          .id(d => d.id)
          .links(dataLinks)
        )
        // This adds repulsion (negative force) between nodes
        .force("charge", forceManyBody().strength(d => d.radius * -20))
        // Make sure there is a minimum margin between nodes so links are not eclipsed
        .force('collision', forceCollide().radius(d => d.radius * 1.5))
        // Link the position updating function to the forces
        // It is important to run this line only in the first render
        .on("tick", () => {
          linkLines
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
          nodeCircles
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
          nodeImagePatterns
            .attr("x", d => d.x + d.radius)
            .attr("y", d => d.y + d.radius);
        });

      // Restart forces in case they were stopped already
      simulation.alpha(1).restart();
    }

    // Set a function to update the graph when the selected node value changes
    updateSelectedNodeValueRef.current = ({ selectedNodeValue }) => {
      nodesParent.selectAll("circle")
        .style("stroke", d => selectedNodeValue === d.value ? colors.selected : colors.default)
        .style("stroke-width", d => selectedNodeValue === d.value ? strokeWidths.selected : strokeWidths.default)
        .on("mouseover", function() {
          select(this)
          .style("stroke", colors.hovered)
          .style("stroke-width", strokeWidths.hovered);
        })
        .on("mouseout", function() {
          select(this)
          .style("stroke", d => selectedNodeValue === d.value ? colors.selected : colors.default)
          .style("stroke-width", d => selectedNodeValue === d.value ? strokeWidths.selected : strokeWidths.default)
        })
    }

    // Set a function to update when onSelectNode changes
    // DANI: No se ha provado
    updateOnSelectRef.current = ({ onSelectNode }) => {
      nodesParent.selectAll("circle")
        .style("cursor", onSelectNode && "pointer")
        .on("click", onSelectNode);
    }

    // This ref allows to update the graph without having to remake the whole graph
    updateSizeRef.current = () => {
      // Change the graph size according to the container size
      const { clientWidth: width, clientHeight: height } = containerRef.current;
      graph.attr('width', width).attr('height', height);
      // Update forces which depend on the graph size
      simulation
        .force("x", forceX(width / 2).strength(100 / width))
        .force("y", forceY(height / 2).strength(100 / height))
        .alpha(1).restart();
    };

    // Run the redraw logic fro the first time
    updateSizeRef.current();
    // Set the redraw logic to be run every time the graph container is resized
    window.addEventListener('resize', updateSizeRef.current);

    // Cleanup function
    return () => {
      graph.remove();
      simulation.stop();
      window.removeEventListener('resize', updateSizeRef.current);
    }
  }, []);

  // Handle when images change
  useEffect(() => {
    updateDataRef.current({data});
  }, [data]);

  // Handle when images change
  useEffect(() => {
    updateImagesRef.current({images});
  }, [images]);

  // Handle when the selected node value changes
  useEffect(() => {
    updateSelectedNodeValueRef.current({selectedNodeValue});
  }, [selectedNodeValue]);

  // Handle when the on selected node changes
  useEffect(() => {
    updateOnSelectRef.current({onSelectNode});
  }, [onSelectNode]);

  return (
    <div className={className ? className : style.default}>
      <div className={style.flexible}>
        <div className={style['graph-container']} ref={containerRef} />
      </div>
    </div>
  );
});

export default MarkovGraph;
