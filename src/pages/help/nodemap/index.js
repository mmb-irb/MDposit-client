import React, { useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from "react-simple-maps";

// Get the map
import map from './map.json';

// Auxiliar functions
import { caluclateAverage } from '../../../utils/auxiliar-functions';

// Use this to access the primary color according to the style palette
import { useTheme } from '@mui/material/styles';

// Set the distance cutoff to merge nodes together (in coordinate grades)
const NODE_DISTANCE_CUTOFF = 0.01;
// Set a function to calculate distance between 2 nodes
const getDistance = (firstLocation, secondLocation) => {
  const xDiff = firstLocation[0] - secondLocation[0];
  const yDiff = firstLocation[1] - secondLocation[1];
  return Math.sqrt( Math.pow(xDiff, 2) + Math.pow(yDiff, 2) );
};
// Set a function to calculate the mid point between n nodes
const getCentroid = (nodes) => {
  const xMean = caluclateAverage(nodes.map(node => node.location[0]));
  const yMean = caluclateAverage(nodes.map(node => node.location[1]));
  return [xMean, yMean];
};

const NodeMap = ({ nodeData, className }) => {
  // Get the paletter primary color
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  // Set node representations
  // Several nodes may be combined in a single representation to avoid overlaps
  // DANI: Esta lógica es muy simple, si hay muchos nodos habrá que replanteársela
  const { nodeGroups, center } = useMemo(() => {
    if (!nodeData) return { nodeGroups: [], center: [0, 0] };
    // Group nodes together by distance
    const _nodeGroups = [];
    // Iterate nodes
    for (const node of nodeData) {
      // Find a close group
      const closeGroup = _nodeGroups.find(group => getDistance(group.location, node.location) < NODE_DISTANCE_CUTOFF);
      // If we just found a close group then merge this node
      if (closeGroup) {
        closeGroup.nodes.push(node);
        closeGroup.location = getCentroid(closeGroup.nodes);
        continue;
      }
      // Otherwise set a new group for this node
      _nodeGroups.push({ nodes: [node], location: node.location });
    }
    // Calculate the center of all nodes
    const _center = getCentroid(nodeData);
    return { nodeGroups: _nodeGroups, center: _center };
  },[nodeData]);

  return (
    <ComposableMap
      projection="geoAzimuthalEqualArea"
      projectionConfig={{
        center: [center[1], center[0]],
        scale: 1300
      }}
      className={className}
    >
      <Geographies
        geography={map}
        fill="#D6D6DA"
        stroke="#FFFFFF"
        strokeWidth={0.5}
      >
        {({ geographies }) =>
          geographies.map((geo) => (
            <Geography key={geo.rsmKey} geography={geo} />
          ))
        }
      </Geographies>
      {nodeGroups && nodeGroups.map((group, g) => [
        // Add a marker in the map for every node
        <Marker key={g} coordinates={[group.location[1], group.location[0]]}>
          <circle r={8} fill={primary} />
        </Marker>,
        ...group.nodes.map((node, i) => (
          <Marker key={`${g}.${i}`} coordinates={[group.location[1], group.location[0] + 0.6 + i]}>
            <text fontSize={"large"} textAnchor="middle" fill={primary}>
              {node.name}
            </text>
          </Marker>            
        ))
      ])}
    </ComposableMap>
  );
};

export default NodeMap;
