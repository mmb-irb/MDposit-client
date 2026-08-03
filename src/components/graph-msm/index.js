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
  selected: "green",
  link: "#aaa",
  hoveredLink: "#555"
}
const strokeWidths = {
  default: 2,
  hovered: 3,
  selected: 4
}

// Set how much opposite arrows are bent apart, as a fraction of the internode distance
const arrowBend = 0.08;
// Set the arrow head size, which is proportional to the arrow width but limited
const arrowHeadRatio = 2.2;
const minArrowHead = 5;
const maxArrowHead = 22;
// Set the gap left between an arrow head and the node it points to
const arrowHeadGap = 0.0;
// Set the arrow opacity limits, which are proportional to the arrow width
const minArrowOpacity = 0.25;
const maxArrowOpacity = 1;
// Set the opacity for arrows not connected to the hovered node
const fadedArrowOpacity = 0.06;
// Set how far apart linked nodes are kept: a ratio of their radii plus a margin
const linkDistanceRatio = 1.5;
const linkDistanceMargin = 30;

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
//        width: 3,
//        // Optional width per direction, which makes the link be drawn as two bent arrows
//        // The 'source width' belongs to the arrow leaving the source node and vice versa
//        sourceWidth: 2,
//        targetWidth: 1,
//        // Optional tooltip per arrow
//        sourceText: 'Transitions 0 -> 1: 12',
//        targetText: 'Transitions 1 -> 0: 6'
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

    // Set the functions used to fade every arrow but the ones connected to the hovered node
    // Note that selections are queried every time, so they always find the current elements
    const isArrowConnected = (arrow, node) => {
      // Link nodes may be node indices instead of node objects until forces are initiated
      const linkNodeId = linkNode => linkNode.id === undefined ? linkNode : linkNode.id;
      return linkNodeId(arrow.link.source) === node.id || linkNodeId(arrow.link.target) === node.id;
    };
    const focusNodeArrows = node => {
      const focusedOpacity = arrow => isArrowConnected(arrow, node) ? maxArrowOpacity : fadedArrowOpacity;
      linksParent.selectAll("path").style("stroke-opacity", focusedOpacity);
      defs.selectAll("marker").select("path").style("fill-opacity", focusedOpacity);
    };
    const resetArrowsFocus = () => {
      linksParent.selectAll("path").style("stroke-opacity", arrow => arrow.opacity);
      defs.selectAll("marker").select("path").style("fill-opacity", arrow => arrow.opacity);
    };

    // Set a function to restyle a single arrow
    // Note that the head is a definition apart, so it does not inherit the arrow styles
    const styleArrow = (arrowElement, arrow, color, opacity) => {
      select(arrowElement)
        .style("stroke", color)
        .style("stroke-opacity", opacity);
      // Undirectional arrows have no head at all
      if (!arrow.head) return;
      defs.select(`#${arrow.head}`).select("path")
        .style("fill", color)
        .style("fill-opacity", opacity);
    };

    // --------------------------------------------------------------------------------------------------

    // Set the updating functions
    // These functions are called by specific useEffects declared below when an specific input changes

    // Set a function to update data changes
    updateDataRef.current = ({ data }) => {
      // Get data nodes and links
      let { nodes: dataNodes, links: dataLinks } = data;

      // Set the links ------------------------------------------------------------------------------------

      // Copy input data instead to prevent further mutation
      dataLinks = dataLinks.map(d => Object.assign({}, d));

      // Set the arrows to be drawn from the links
      // Bidirectional links become two arrows, bent apart so they do not overlap each other
      // Links with no directional widths become a single straight line
      const dataArrows = [];
      dataLinks.forEach((link, l) => {
        const bidirectional = link.sourceWidth !== undefined || link.targetWidth !== undefined;
        if (!bidirectional) {
          dataArrows.push({ link: link, width: link.width, reverse: false, bend: 0, head: null });
          return;
        }
        // The 'source arrow' leaves the source node and the 'target arrow' the other way around
        [false, true].forEach(reverse => {
          const width = (reverse ? link.targetWidth : link.sourceWidth) || 0;
          // A direction with no width has no data at all, so it gets no arrow
          if (width === 0) return;
          dataArrows.push({
            link: link,
            width: width,
            reverse: reverse,
            bend: arrowBend,
            // Set the id of the marker holding the head, unique for every arrow
            head: `arrow-head-${l}-${reverse ? 'target' : 'source'}`,
            headWidth: Math.min(Math.max(width * arrowHeadRatio, minArrowHead), maxArrowHead),
            text: reverse ? link.targetText : link.sourceText,
          });
        });
      });

      // Set the opacity of every arrow according to its width, so thin arrows do not clutter the graph
      const arrowWidths = dataArrows.map(arrow => arrow.width);
      const minArrowWidth = Math.min(...arrowWidths);
      const maxArrowWidth = Math.max(...arrowWidths);
      dataArrows.forEach(arrow => {
        arrow.opacity = minArrowWidth === maxArrowWidth
          ? maxArrowOpacity
          : minArrowOpacity + (arrow.width - minArrowWidth) *
            (maxArrowOpacity - minArrowOpacity) / (maxArrowWidth - minArrowWidth);
      });

      // Set the arrow heads ------------------------------------------------------------------------------

      // Get the current arrow head markers
      let arrowHeads = defs.selectAll("marker");

      // Load new data in the arrow head markers
      const newArrowHeadsData = arrowHeads.data(dataArrows.filter(arrow => arrow.head));

      // Remove arrow head markers which are no longer necessary according to new data
      newArrowHeadsData.exit().remove();

      // Add new arrow head markers which are now necessary according to new data
      newArrowHeadsData.enter().append("marker")
        // Make the head follow the direction of its arrow
        .attr("orient", "auto")
        // Set the head size in absolute units, since the automatic scaling has no limits
        .attr("markerUnits", "userSpaceOnUse")
        .append("path");

      // Get all definitive arrow head markers now that we have removed/added some of them
      arrowHeads = defs.selectAll("marker");

      // Update definitive arrow head markers according to new data
      // Note that heads are anchored in their tip, so they are drawn behind the arrow end
      arrowHeads
        .attr("id", arrow => arrow.head)
        .attr("viewBox", arrow => `0 0 ${arrow.headWidth} ${arrow.headWidth}`)
        .attr("markerWidth", arrow => arrow.headWidth)
        .attr("markerHeight", arrow => arrow.headWidth)
        .attr("refX", arrow => arrow.headWidth)
        .attr("refY", arrow => arrow.headWidth / 2);
      arrowHeads.select("path")
        .attr("d", arrow => `M0,0 L${arrow.headWidth},${arrow.headWidth / 2} L0,${arrow.headWidth} Z`)
        // Set styles here, and not on enter, to restore heads left highlighted by a hover
        .style("fill", colors.link)
        .style("fill-opacity", arrow => arrow.opacity);

      // Set the arrows -----------------------------------------------------------------------------------

      // Get the current arrow paths
      let arrowPaths = linksParent.selectAll("path");

      // Load new data in the arrow paths
      const newArrowPathsData = arrowPaths.data(dataArrows);

      // Remove arrow paths which are no longer necessary according to new data
      newArrowPathsData.exit().remove();

      // Add new arrow paths which are now necessary according to new data
      newArrowPathsData.enter().append("path")
        .style("fill", "none")
        .style("stroke", colors.link)
        // Set the tooltip holder here, and not on update, or old texts would remain
        .append("svg:title");

      // Get all definitive arrow paths now that we have removed/added some of them
      arrowPaths = linksParent.selectAll("path");

      // Update definitive arrow paths according to new data
      arrowPaths
        .attr("stroke-width", arrow => arrow.width)
        .attr("marker-end", arrow => arrow.head ? `url(#${arrow.head})` : null)
        .style("stroke", colors.link)
        .style("stroke-opacity", arrow => arrow.opacity)
        // Make the hovered arrow stand out, so even the faintest may be inspected
        // WARNING: Here you need to use 'function' instead of an arrow function or 'this' does not work
        .on("mouseover", function(arrow) {
          styleArrow(this, arrow, colors.hoveredLink, maxArrowOpacity);
        })
        .on("mouseout", function(arrow) {
          styleArrow(this, arrow, colors.link, arrow.opacity);
        });
      arrowPaths.select("title").text(arrow => arrow.text || '');

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
        // Set the tooltip holder here, and not on update, or old texts would remain
        .append("svg:title");

      // Get all definitive node circles now that we have removed/added some node circles
      nodeCircles = nodesParent.selectAll("circle");

      // Update definitive node circles according to new data
      nodeCircles
        .attr("r", d => d.radius)
        .style("stroke", d => selectedNodeValue === d.value ? colors.selected : colors.default)
        .style("stroke-width", d => selectedNodeValue === d.value ? strokeWidths.selected : strokeWidths.default)
        .style("cursor", onSelectNode && "pointer")
        // WARNING: Here you need to use 'function' instead of an arrow function or 'this' does not work
        .on("mouseover", function(node) {
          select(this)
          .style("stroke", colors.hovered)
          .style("stroke-width", strokeWidths.hovered);
          focusNodeArrows(node);
        })
        .on("mouseout", function() {
          select(this)
          .style("stroke", d => selectedNodeValue === d.value ? colors.selected : colors.default)
          .style("stroke-width", d => selectedNodeValue === d.value ? strokeWidths.selected : strokeWidths.default)
          resetArrowsFocus();
        })
        .on("click", onSelectNode);

      // Update the node hover texts according to new data
      nodeCircles.select("title").text(d => d.text);

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
          // Keep linked nodes apart according to their sizes, so arrows have room
          .distance(d => (d.source.radius + d.target.radius) * linkDistanceRatio + linkDistanceMargin)
          .id(d => d.id)
          .links(dataLinks)
        )
        // This adds repulsion (negative force) between nodes
        .force("charge", forceManyBody().strength(d => d.radius * -40))
        // Make sure there is a minimum margin between nodes so links are not eclipsed
        .force('collision', forceCollide().radius(d => d.radius * 1.5))
        // Link the position updating function to the forces
        // It is important to run this line only in the first render
        .on("tick", () => {
          // Set the curve of every arrow
          dataArrows.forEach(arrow => {
            // Get the nodes the arrow goes from and to
            const from = arrow.reverse ? arrow.link.target : arrow.link.source;
            const to = arrow.reverse ? arrow.link.source : arrow.link.target;
            const distanceX = to.x - from.x;
            const distanceY = to.y - from.y;
            const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY) || 1;
            // Set the curve control point, displaced perpendicularly to bend the arrow
            // Note that the displacement is always to the same side of the arrow direction
            // Thus opposite arrows are bent to opposite sides
            const bend = distance * arrow.bend;
            const controlX = (from.x + to.x) / 2 - (distanceY / distance) * bend;
            const controlY = (from.y + to.y) / 2 + (distanceX / distance) * bend;
            // Set both arrow ends in the node borders, following the curve instead of the straight line
            const startDistance = Math.sqrt((controlX - from.x) ** 2 + (controlY - from.y) ** 2) || 1;
            const startX = from.x + (controlX - from.x) / startDistance * from.radius;
            const startY = from.y + (controlY - from.y) / startDistance * from.radius;
            const endDistance = Math.sqrt((to.x - controlX) ** 2 + (to.y - controlY) ** 2) || 1;
            const endMargin = to.radius + arrowHeadGap;
            const endX = to.x - (to.x - controlX) / endDistance * endMargin;
            const endY = to.y - (to.y - controlY) / endDistance * endMargin;
            arrow.path = `M${startX},${startY} Q${controlX},${controlY} ${endX},${endY}`;
          });
          arrowPaths.attr("d", arrow => arrow.path);
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
        .on("mouseover", function(node) {
          select(this)
          .style("stroke", colors.hovered)
          .style("stroke-width", strokeWidths.hovered);
          focusNodeArrows(node);
        })
        .on("mouseout", function() {
          select(this)
          .style("stroke", d => selectedNodeValue === d.value ? colors.selected : colors.default)
          .style("stroke-width", d => selectedNodeValue === d.value ? strokeWidths.selected : strokeWidths.default)
          resetArrowsFocus();
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
