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
  forceX,
  forceY,
  color,
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

// The expected input data (graphData) is:
// {
//    nodes: [
//      { },
//      ...
//    ]
//    links: [
//      { },
//      ...
//    ]
// }

const Graph = forwardRef(({
  // Data containing both nodes and links
  graphData,
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
  if (!graphData) graphData = dataPlaceholder;

  // Referenced document element where d3 is rendered
  const containerRef = useRef(null);
  // Referenced function which allows to update the cart without having to remake it
  const drawRef = useRef(noop);
  const updateSelectedNodeValueRef = useRef(noop);

  // ----------------------------------------------------------------------------------------

  const previousValues = useRef({
    data: dataPlaceholder,
    onSelectNode,
  });

  // This useEffect must be run only once
  // The graph content is updated through the 'drawRef' referenced function
  useEffect(() => {
    // Set the graph mian handler
    const graph = select(containerRef.current).append('svg');
    const defs = graph.append('svg:defs');

    // Initiate the forces handler
    // This runs the logic which sets the positions of nodes
    const simulation = forceSimulation();
    let isSimulationSetup = false;

    // This ref allows to update the graph without having to remake the whole graph
    drawRef.current = ({
      data = previousValues.current.data,
      images = previousValues.current.images,
      selectedNodeValue = previousValues.current.selectedNodeValue,
      onSelectNode = previousValues.current.onSelectNode,
    } = {}) => {
      // Change the graph size according to the container size
      const { clientWidth: width, clientHeight: height } = containerRef.current;
      graph.attr('width', width).attr('height', height);

      // --------------------------------------------------------

      const { nodes: dataNodes, links: dataLinks } = data;

      // Initialize the links
      const links = graph
        .selectAll("line")
        .data(dataLinks)
        .enter()
        .append("line")
          .attr("stroke-width", d => d.width)
          .style("stroke", "#aaa")

      // Set node images
      const nodeImages = defs
        .selectAll("image")
        .data(dataNodes)
        .enter()
        .append('pattern')
          .attr('id', d => 'img' + d.id)
          .attr('width',  d => d.radius * 2)
          .attr('height', d => d.radius * 2)
          .attr("patternUnits", "userSpaceOnUse")
      nodeImages
        .append("image")
          .attr('xlink:href', (d,i) => (images && images[i]) || imagePlaceholder)
          .attr('width',  d => d.radius * 2)
          .attr('height', d => d.radius * 2)

      // Set node circles to be filled with images
      const nodes = graph
        .selectAll("circle")
        .data(dataNodes)
        .enter()
        .append("circle")
          .attr("r", d => d.radius)
          .style("fill", "#fff")
          .style("fill", d => `url(#img${d.id})`)
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
          .on("click", onSelectNode);

      // This function is run at each iteration of the force algorithm, updating the nodes position.
      const ticked = () => {
        links
          .attr("x1", d => d.source.x)
          .attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x)
          .attr("y2", d => d.target.y);

        nodes
          .attr("cx", d => d.x)
          .attr("cy", d => d.y);

        nodeImages
          .attr("x", d => d.x + d.radius)
          .attr("y", d => d.y + d.radius);
      };

      // Set forces to be applied in the network
      // To see more info about forces watch this: https://www.d3indepth.com/force-layout/
      simulation.nodes(dataNodes)
        // This force provides links between nodes
        .force("link", forceLink()
          .strength(0.1)
          .id(d => d.id)
          .links(dataLinks)
        )
        // This adds repulsion (negative force) between nodes
        .force("charge", forceManyBody().strength(d => -(400 + (d.radius * 2))))
        // This force attracts nodes to the center of the graph rectangle while addapting to its shape
        .force("x", forceX(width / 2).strength(100 / width))
        .force("y", forceY(height / 2).strength(100 / height))
        // This line is essential to reset the force logic after it has ended in further renders
        .alpha(0.5).restart();
      // Ininitiate the force logic only in the first render
      // WARNING: If this is called more than once then the logic can not be re
      if (!isSimulationSetup) {
        // If intead of on 'tick' this is called on 'end' then nodes are shown when stopped
        // However until nodes are placed you see nothing, and it takes time, so it is better this way
        simulation.on("tick", ticked);          
        isSimulationSetup = true;
      }

      updateSelectedNodeValueRef.current = ({
        selectedNodeValue,
      } = {}) => {
        nodes
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
      // --------------------------------------------------------

      // Save current values for further reference
      previousValues.current.data = data;
      previousValues.current.images = images;
      previousValues.current.selectedNodeValue = selectedNodeValue;
      previousValues.current.onSelectNode = onSelectNode;
    };

    window.addEventListener('resize', drawRef.current);

    return () => window.removeEventListener('resize', drawRef.current);
  }, []); // DANI: eslint ahora se queja, peor antes aquí había esto: // eslint-disable-line react-hooks/exhaustive-deps
  // Maybe might need to double-check that and remove the exception

  // Handle when some parameter change requires a whole re-draw of the graph
  useEffect(() => {
    drawRef.current({
      data: graphData,
      images,
      onSelectNode
    });
  }, [
    graphData,
    images,
    onSelectNode
  ]);

  // Handle when the selected node value is changes
  useEffect(() => {
    updateSelectedNodeValueRef.current({selectedNodeValue});
  }, [selectedNodeValue]);

  return (
    <div className={className ? className : style.default}>
      <div className={style.flexible}>
        <div className={style['graph-container']} ref={containerRef} />
      </div>
    </div>
  );
});

export default Graph;
