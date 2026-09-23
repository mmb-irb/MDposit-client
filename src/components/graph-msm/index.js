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

// Set a function to calculate the control point which bends a curve between two points
// Note that the point is displaced always to the same side of the start to end direction
// Thus curves between the same two points, but in opposite directions, are bent to opposite sides
const bentControlPoint = (startX, startY, endX, endY, bendFraction) => {
  const chordX = endX - startX;
  const chordY = endY - startY;
  const chord = Math.sqrt(chordX * chordX + chordY * chordY) || 1;
  const bend = chord * bendFraction;
  return [
    (startX + endX) / 2 - (chordY / chord) * bend,
    (startY + endY) / 2 + (chordX / chord) * bend,
  ];
};

// Set display colors
const colors = {
  default: "black",
  hovered: "blue",
  selected: "green",
  link: "#aaa",
  hoveredLink: "#333"
}
const strokeWidths = {
  default: 2,
  hovered: 3,
  selected: 4
}

// Set how much opposite arrows are bent apart, as a fraction of the internode distance
const arrowBend = 0.1;
// Set the arrow head size, which is proportional to the arrow width but limited
const arrowHeadRatio = 2.2;
const minArrowHead = 5;
const maxArrowHead = 22;
// Set the gap left between an arrow head and the node it points to
const arrowHeadGap = 0.0;
// Set how far apart opposite arrows are displaced in the node borders, added to half their widths
const arrowSideStep = 1;
// Set the arrow opacity limits, which are proportional to the arrow width
const minArrowOpacity = 0.6;
const maxArrowOpacity = 1;
// Set the arrow greys, so the widest arrows are also the darkest ones
const minArrowGrey = 170;
const maxArrowGrey = 100;
// Set the opacity for arrows not connected to the hovered node
const fadedArrowOpacity = 0.06;
// Set how far apart linked nodes are kept: a ratio of their radii plus a margin
const linkDistanceRatio = 1.5;
const linkDistanceMargin = 15;
// Set how loops (self-referencing arrows, i.e. excursions which leave and return to the same cluster) are drawn
// They leave and return to two distinct points on top of the node, spread apart by this half-angle (radians)
const loopHalfAngle = 0.35;
// How far the loop's control points reach out from the node, in absolute pixels
// Note this is independent of the node's own radius, so loops look the same size on every cluster
const loopBaseReach = 45;
// The loop's reach is also floored to this many times its own head size, so a wide arrow (which
// gets a bigger head) always has enough room and its head never overlaps the curve underneath it
const loopHeadReachRatio = 3;
// Set the margin left between the nodes cloud and the graph borders
const viewportMargin = 50;
// Set how much the nodes cloud may be zoomed in to fill the graph
const maxViewportScale = 2;

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
//        targetText: 'Transitions 1 -> 0: 6',
//        // Optional list of frames per direction, which makes the arrow clickable (see 'onSelectArrow')
//        sourceFrames: [ 3, 4, 8 ],
//        targetFrames: [ 15, 16 ]
//      },
//      ...
//      // A link whose 'source' and 'target' are the same node is drawn as a loop (e.g. an excursion)
//      // It is a single, undirected arrow: no 'sourceWidth'/'targetWidth' split, just plain fields
//      {
//        source: 2,
//        target: 2,
//        width: 3,
//        text: 'Excursions from 2: 5',
//        frames: [ 40, 41, 42 ]
//      }
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
  // Triggers for when the user selects an arrow (i.e. a transition direction)
  onSelectArrow,
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
  const updateOnSelectArrowRef = useRef(noop);
  const updateSizeRef = useRef(noop);

  // ----------------------------------------------------------------------------------------
  // This useEffect must be run only once
  // The graph content is updated through the referenced functions
  useEffect(() => {
    // Set the graph main handlers
    const graph = select(containerRef.current).append('svg');
    const defs = graph.append('svg:defs');

    // Set a 'g' element holding everything which is drawn, so it may be scaled to fit the graph
    const viewport = graph.append("g");

    // Set two 'g' elements for nodes and links to be attached to them instead of to the graph element itself
    // Then declare links before nodes to ensure nodes will be drawn over links in the 'z' dimension and not the opposite
    const linksParent = viewport.append("g")
    const nodesParent = viewport.append("g")

    // Initiate the forces handler
    // This runs the logic which sets the nodes positions
    const simulation = forceSimulation();

    // Set the graph size, which is kept updated by the size updating function below
    let graphWidth = 0;
    let graphHeight = 0;

    // Set a function to scale the nodes cloud so it fills the graph instead of leaving white space around
    const fitViewport = nodes => {
      if (!nodes.length || !graphWidth || !graphHeight) return;
      // Find the boundaries of the nodes cloud, node radii included
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      nodes.forEach(node => {
        minX = Math.min(minX, node.x - node.radius);
        maxX = Math.max(maxX, node.x + node.radius);
        minY = Math.min(minY, node.y - node.radius);
        maxY = Math.max(maxY, node.y + node.radius);
      });
      // Set the scale which makes the cloud fill the graph, but never zooming in beyond the limit
      const scale = Math.min(
        (graphWidth - viewportMargin * 2) / (maxX - minX),
        (graphHeight - viewportMargin * 2) / (maxY - minY),
        maxViewportScale,
      );
      // Displace the scaled cloud to the graph center
      const x = graphWidth / 2 - (minX + maxX) / 2 * scale;
      const y = graphHeight / 2 - (minY + maxY) / 2 * scale;
      viewport.attr("transform", `translate(${x},${y}) scale(${scale})`);
    };

    // --------------------------------------------------------------------------------------------------

    // Set the functions used to fade every arrow but the ones connected to the hovered node
    // Note that selections are queried every time, so they always find the current elements
    const isArrowConnected = (arrow, node) => {
      // Link nodes may be node indices instead of node objects until forces are initiated
      const linkNodeId = linkNode => linkNode.id === undefined ? linkNode : linkNode.id;
      return linkNodeId(arrow.link.source) === node.id || linkNodeId(arrow.link.target) === node.id;
    };
    // Note that the opacity is set in the whole arrow element, heads included
    // Otherwise a head would stack over the end of its own shaft and thus look darker
    const focusNodeArrows = node => {
      linksParent.selectAll("path")
        .style("opacity", arrow => isArrowConnected(arrow, node) ? maxArrowOpacity : fadedArrowOpacity);
    };
    const resetArrowsFocus = () => {
      linksParent.selectAll("path").style("opacity", arrow => arrow.opacity);
    };

    // Set a function to restyle a single arrow
    // Note that the head is a definition apart, so it does not inherit the arrow color
    const styleArrow = (arrowElement, arrow, color, opacity) => {
      select(arrowElement)
        .style("stroke", color)
        .style("opacity", opacity);
      // Undirectional arrows have no head at all
      if (!arrow.head) return;
      defs.select(`#${arrow.head}`).select("path").style("fill", color);
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
      // A link whose source and target are the same node (i.e. an excursion) becomes a loop
      const dataArrows = [];
      dataLinks.forEach((link, l) => {
        const isLoop = link.source === link.target;
        if (isLoop) {
          dataArrows.push({
            link: link,
            width: link.width,
            isLoop: true,
            head: `arrow-head-${l}-loop`,
            headSize: Math.min(Math.max(link.width * arrowHeadRatio, minArrowHead), maxArrowHead),
            text: link.text,
            frames: link.frames,
          });
          return;
        }
        const bidirectional = link.sourceWidth !== undefined || link.targetWidth !== undefined;
        if (!bidirectional) {
          dataArrows.push({ link: link, width: link.width, reverse: false, bend: 0, head: null, headSize: 0 });
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
            // Note that the head is as long as it is wide
            headSize: Math.min(Math.max(width * arrowHeadRatio, minArrowHead), maxArrowHead),
            text: reverse ? link.targetText : link.sourceText,
            // Frames belonging to this direction of the transition, if the input data provides them
            frames: reverse ? link.targetFrames : link.sourceFrames,
          });
        });
      });

      // Set the opacity and the color of every arrow according to its width
      // This way thin arrows do not clutter the graph while wide arrows stand out
      const arrowWidths = dataArrows.map(arrow => arrow.width);
      const minArrowWidth = Math.min(...arrowWidths);
      const maxArrowWidth = Math.max(...arrowWidths);
      dataArrows.forEach(arrow => {
        const ratio = minArrowWidth === maxArrowWidth
          ? 1
          : (arrow.width - minArrowWidth) / (maxArrowWidth - minArrowWidth);
        arrow.opacity = minArrowOpacity + ratio * (maxArrowOpacity - minArrowOpacity);
        const grey = Math.round(minArrowGrey + ratio * (maxArrowGrey - minArrowGrey));
        arrow.color = `rgb(${grey},${grey},${grey})`;
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
      // Note that heads are anchored in their base, so they are drawn beyond the arrow end
      // Otherwise the tip of the head would be buried inside the shaft, which is wider than the tip
      arrowHeads
        .attr("id", arrow => arrow.head)
        .attr("viewBox", arrow => `0 0 ${arrow.headSize} ${arrow.headSize}`)
        .attr("markerWidth", arrow => arrow.headSize)
        .attr("markerHeight", arrow => arrow.headSize)
        .attr("refX", 0)
        .attr("refY", arrow => arrow.headSize / 2);
      arrowHeads.select("path")
        .attr("d", arrow => `M0,0 L${arrow.headSize},${arrow.headSize / 2} L0,${arrow.headSize} Z`)
        // Set the color here, and not on enter, to restore heads left highlighted by a hover
        .style("fill", arrow => arrow.color);

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
        // Make the shaft end round, so it reaches under the head base and leaves no seam between them
        .style("stroke-linecap", "round")
        // Set the tooltip holder here, and not on update, or old texts would remain
        .append("svg:title");

      // Get all definitive arrow paths now that we have removed/added some of them
      arrowPaths = linksParent.selectAll("path");

      // Update definitive arrow paths according to new data
      arrowPaths
        .attr("stroke-width", arrow => arrow.width)
        .attr("marker-end", arrow => arrow.head ? `url(#${arrow.head})` : null)
        .style("stroke", arrow => arrow.color)
        .style("opacity", arrow => arrow.opacity)
        // Only arrows carrying frames are clickable, since there is nothing to load otherwise
        .style("cursor", arrow => onSelectArrow && arrow.frames && arrow.frames.length ? "pointer" : null)
        // Make the hovered arrow stand out, so even the faintest may be inspected
        // WARNING: Here you need to use 'function' instead of an arrow function or 'this' does not work
        .on("mouseover", function(arrow) {
          styleArrow(this, arrow, colors.hoveredLink, maxArrowOpacity);
        })
        .on("mouseout", function(arrow) {
          styleArrow(this, arrow, arrow.color, arrow.opacity);
        })
        .on("click", arrow => {
          if (onSelectArrow && arrow.frames && arrow.frames.length) onSelectArrow(arrow);
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

      // Index nodes by id, so loops (whose link is never resolved by forceLink, see below) can find
      // the actual, live node object to read its current position and radius from during ticks
      const nodeById = new Map(dataNodes.map(node => [node.id, node]));

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

      // Loops must be excluded from the link force: forceLink cannot resolve a meaningful distance
      // between a node and itself, and feeding it self-links makes positions collapse to NaN
      const forceLinks = dataLinks.filter(link => link.source !== link.target);

      simulation
        .nodes(dataNodes)
        // This force provides links between nodes
        .force("link", forceLink()
          .strength(d => d.width * 0.01)
          // Keep linked nodes apart according to their sizes, so arrows have room
          .distance(d => (d.source.radius + d.target.radius) * linkDistanceRatio + linkDistanceMargin)
          .id(d => d.id)
          .links(forceLinks)
        )
        // This adds repulsion (negative force) between nodes
        .force("charge", forceManyBody().strength(d => d.radius * -40))
        // Make sure there is a minimum margin between nodes so links are not eclipsed
        .force('collision', forceCollide().radius(d => d.radius * 1.5))
        // Link the position updating function to the forces
        // It is important to run this line only in the first render
        .on("tick", () => {
          // Compute the nodes' centroid, so loops can be pointed outward from the middle of the
          // graph instead of always upward: the center tends to be crowded with transitions, while
          // the outer area is mostly empty, so loops overlap less if they bulge out into it
          let centroidX = 0, centroidY = 0;
          dataNodes.forEach(node => { centroidX += node.x; centroidY += node.y; });
          centroidX /= dataNodes.length || 1;
          centroidY /= dataNodes.length || 1;
          // Set the curve of every arrow
          dataArrows.forEach(arrow => {
            // Loops are drawn as a bulge attached to the outward side of their own node, not between
            // two nodes. Note that the loop's link is never resolved by forceLink (it is excluded
            // from it, see above), so its 'source'/'target' are still the raw node id and must be
            // looked up
            if (arrow.isLoop) {
              const node = nodeById.get(arrow.link.source);
              // Point the loop away from the graph's centroid, or upward if the node sits right on it
              const baseAngle = (node.x === centroidX && node.y === centroidY)
                ? -Math.PI / 2
                : Math.atan2(node.y - centroidY, node.x - centroidX);
              // The loop leaves and returns to two distinct points on the node's outward side, not
              // the very same spot, so it reads as "leaves the cluster and comes back" rather than a stub
              const startAngle = baseAngle - loopHalfAngle;
              const endAngle = baseAngle + loopHalfAngle;
              const startX = node.x + node.radius * Math.cos(startAngle);
              const startY = node.y + node.radius * Math.sin(startAngle);
              const rawEndX = node.x + node.radius * Math.cos(endAngle);
              const rawEndY = node.y + node.radius * Math.sin(endAngle);
              // Control points reach out along the very same angles as the start/end points (not
              // swept sideways), so the curve bulges directly away from the node, forming a round loop
              // 'loopBaseReach' is how far beyond the node's own border they reach, not an absolute
              // distance from its center, or the loop would curl back inside a big enough node
              // Also reach out further for wide arrows, so a big head always has room and never
              // overlaps the curve it is drawn on top of
              const loopReach = Math.max(node.radius + loopBaseReach, arrow.headSize * loopHeadReachRatio);
              const control1X = node.x + loopReach * Math.cos(startAngle);
              const control1Y = node.y + loopReach * Math.sin(startAngle);
              const control2X = node.x + loopReach * Math.cos(endAngle);
              const control2Y = node.y + loopReach * Math.sin(endAngle);
              // Pull the end back along the incoming tangent, leaving room for the head to be drawn
              // beyond it, so the head's tip lands exactly on the node border
              const tangentX = rawEndX - control2X;
              const tangentY = rawEndY - control2Y;
              const tangent = Math.sqrt(tangentX * tangentX + tangentY * tangentY) || 1;
              const endX = rawEndX - (tangentX / tangent) * arrow.headSize;
              const endY = rawEndY - (tangentY / tangent) * arrow.headSize;
              arrow.path =
                `M${startX},${startY} C${control1X},${control1Y} ${control2X},${control2Y} ${endX},${endY}`;
              return;
            }
            // Get the nodes the arrow goes from and to
            const from = arrow.reverse ? arrow.link.target : arrow.link.source;
            const to = arrow.reverse ? arrow.link.source : arrow.link.target;
            const distanceX = to.x - from.x;
            const distanceY = to.y - from.y;
            const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY) || 1;
            const directionX = distanceX / distance;
            const directionY = distanceY / distance;
            // Set the side the arrow is bent to, which is the opposite one for the opposite arrow
            const sideX = -directionY;
            const sideY = directionX;
            // Displace both arrow ends to that side, so opposite arrows do not overlap near the nodes
            // Note that displacements are limited, since small nodes have little room in their borders
            const startStep = Math.min(arrow.width / 2 + arrowSideStep, from.radius / 2);
            const endStep = Math.min(arrow.width / 2 + arrowSideStep, to.radius / 2);
            // Set where the shaft starts and where the head tip must land: both node borders
            // Note that displaced ends are brought back to the borders by normalizing their directions
            const startVectorX = directionX * from.radius + sideX * startStep;
            const startVectorY = directionY * from.radius + sideY * startStep;
            const startVector = Math.sqrt(startVectorX * startVectorX + startVectorY * startVectorY) || 1;
            const startX = from.x + (startVectorX / startVector) * from.radius;
            const startY = from.y + (startVectorY / startVector) * from.radius;
            const tipVectorX = -directionX * to.radius + sideX * endStep;
            const tipVectorY = -directionY * to.radius + sideY * endStep;
            const tipVector = Math.sqrt(tipVectorX * tipVectorX + tipVectorY * tipVectorY) || 1;
            const tipX = to.x + (tipVectorX / tipVector) * (to.radius + arrowHeadGap);
            const tipY = to.y + (tipVectorY / tipVector) * (to.radius + arrowHeadGap);
            // Leave room for the head, which is drawn beyond the shaft end
            // Note that the room is limited when the two nodes are close, or the arrow would be reversed
            const room = distance - from.radius - to.radius - arrowHeadGap;
            const headRoom = Math.max(Math.min(arrow.headSize, room * 0.6), 0);
            // Set where the shaft ends and the control point which bends the curve
            // Note that the head follows the shaft direction, which depends on the shaft end itself
            // Thus both are refined a few times so the head ends up pointing to the node border
            let endX = tipX;
            let endY = tipY;
            let control = [ tipX, tipY ];
            for (let refinement = 0; refinement < 3; refinement++) {
              control = bentControlPoint(startX, startY, endX, endY, arrow.bend);
              const headX = endX - control[0];
              const headY = endY - control[1];
              const head = Math.sqrt(headX * headX + headY * headY) || 1;
              endX = tipX - (headX / head) * headRoom;
              endY = tipY - (headY / head) * headRoom;
            }
            control = bentControlPoint(startX, startY, endX, endY, arrow.bend);
            arrow.path = `M${startX},${startY} Q${control[0]},${control[1]} ${endX},${endY}`;
          });
          arrowPaths.attr("d", arrow => arrow.path);
          nodeCircles
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
          nodeImagePatterns
            .attr("x", d => d.x + d.radius)
            .attr("y", d => d.y + d.radius);
          fitViewport(dataNodes);
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

    // Set a function to update when onSelectArrow changes
    updateOnSelectArrowRef.current = ({ onSelectArrow }) => {
      linksParent.selectAll("path")
        .style("cursor", arrow => onSelectArrow && arrow.frames && arrow.frames.length ? "pointer" : null)
        .on("click", arrow => {
          if (onSelectArrow && arrow.frames && arrow.frames.length) onSelectArrow(arrow);
        });
    }

    // This ref allows to update the graph without having to remake the whole graph
    updateSizeRef.current = () => {
      // Change the graph size according to the container size
      const { clientWidth: width, clientHeight: height } = containerRef.current;
      graph.attr('width', width).attr('height', height);
      // Save the new size, since the fitting function depends on it
      graphWidth = width;
      graphHeight = height;
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

  // Handle when the on selected arrow changes
  useEffect(() => {
    updateOnSelectArrowRef.current({onSelectArrow});
  }, [onSelectArrow]);

  return (
    <div className={className ? className : style.default}>
      <div className={style.flexible}>
        <div className={style['graph-container']} ref={containerRef} />
      </div>
    </div>
  );
});

export default MarkovGraph;
