import React, { useMemo } from "react";

// Visual assets
import { DataGrid } from '@mui/x-data-grid';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

// Hooks
import useBatchAPI from 'src/hooks/use-batch-api';

// Get the map
import map from '../nodemap/map.json';

// Estas dos librerías son dependencias de react-simple-maps
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';

// Flags
import ReactCountryFlag from "react-country-flag"

// Convert TopoJSON to GeoJSON
const geoJson = feature(map, map.objects.world); 
// Set a function to gt the country from a given coordinates
// DANI: Chapi made
const getCountryFromCoords = (lng, lat) => {
  for (const country of geoJson.features)
    if (geoContains(country, [lng, lat])) return country.id;
  return null; // Not found
}

// Set a function to return text within a hyperlink
const renderHref = (nodeName, nodeUrl) => <a href={nodeUrl} target="_blank" rel="noreferrer noopener">{nodeName}</a>;

// Set a function to return one symbol or another depending on a node status
const renderStatusSymbol = status => {
  if (status === 'active') return <CheckCircleIcon style={{ color: 'green', marginTop: '0.5em' }}/>;
  if (status === 'fallen') return <ErrorIcon style={{ color: 'red', marginTop: '0.5em' }}/>;
  throw new Error(`Not supported status ${status}`);
}

// Set a table displaying all avilable nodes and their status and response time
// Note that this component will only work with the global API
const NodeTable = ({ nodeData }) => {
  
    // If this is the global client then ping all nodes to check the response time
    const pingUrls = useMemo(() => {
        if (!nodeData) return [];
        return nodeData.map(node => node.api_url);
    }, [nodeData]);
    const pingResponses = useBatchAPI(pingUrls);
  
    // Set the table to be displayed including ping response times
    if (!pingResponses || pingResponses.length === 0) return;
    // Set table columns
    const columns = [
        { field: 'node', headerName: 'Node name', flex: 0.4, align: 'center', headerAlign: 'center',
        renderCell: params => renderHref(params.row.node, params.row.url) },
        { field: 'flag', headerName: 'Country', flex: 0.15, align: 'center', headerAlign: 'center',
            renderCell: params => params.value },
        { field: 'status', headerName: 'Status', flex: 0.15, align: 'center', headerAlign: 'center',
        renderCell: params => renderStatusSymbol(params.value) },
        { field: 'ping', headerName: 'Response time', flex: 0.3, align: 'center', headerAlign: 'center' }
    ];
    // Set a table row for every node
    const rows = nodeData.map(node => {
        const ping = pingResponses.find(response => response.url === node.api_url);
        const status = ping && ping.time ? 'active' : 'fallen';
        const responseTime = ping && ping.time ? `${ping.time}ms` : '...';
        // Find the corresponding country and get its flag
        const longitud = node.location[1];
        const latitud = node.location[0];
        const countryId = getCountryFromCoords(longitud, latitud);
        const countryCode = countryId.slice(0,2);
        const flag = <ReactCountryFlag countryCode={countryCode} svg
            style={{ width: "2.1em", height: "1.6em",
                border: 'solid', borderWidth: "0.1em", borderColor: "black" }} />;
        // The 'id' field is not used but it is required by the data table
        return {
            id: node.alias,
            key: node.alias,
            node: node.name,
            url: node.api_url,
            status: status,
            ping: responseTime,
            flag: flag,
        };
    });

    // Return the data table
    return (
        <DataGrid
            columns={columns}
            rows={rows}
            disableRowSelectionOnClick
            hideFooter
            key={'node table'}
        />
    );
}

export default NodeTable;