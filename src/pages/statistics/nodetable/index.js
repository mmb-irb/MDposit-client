import React, { useMemo } from "react";

// Visual assets
import { DataGrid } from '@mui/x-data-grid';
import { Tooltip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import Loading from 'src/components/loading'; // Displays an animated "loading" circle

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
  if (status === 'active') return (
    <Tooltip title="The node is working correctly">
      <CheckCircleIcon style={{ color: 'green', marginTop: '0.5em' }} />
    </Tooltip>
  );
  if (status === 'halted') return (
    <Tooltip title="The node is responding and the API is working, but the database is not responding">
      <ErrorIcon style={{ color: 'orange', marginTop: '0.5em' }} />
    </Tooltip>
  );
  if (status === 'fallen') return (
    <Tooltip title="The node is not responding at all">
      <ErrorIcon style={{ color: 'red', marginTop: '0.5em' }} />
    </Tooltip>
  );
  throw new Error(`Not supported status ${status}`);
}

// Set a table displaying all avilable nodes and their status and response time
// Note that this component will only work with the global API
const NodeTable = ({ nodeData }) => {
  
    // If this is the global client then ping all nodes to check the response time
    // Note that this ping confrms the API is working, but the database may still not responding
    const pingUrls = useMemo(() => {
        if (!nodeData) return [];
        return nodeData.map(node => node.api_url);
    }, [nodeData]);
    const pingResponses = useBatchAPI(pingUrls);

    // Also ask every node about a summary of their stats
    // Note that the stats confirm that the database is working
    const statUrls = useMemo(() => {
        if (!nodeData) return [];
        return nodeData.map(node => node.api_url + 'rest/current/stats');
    }, [nodeData]);
    const statResponses = useBatchAPI(statUrls);
  
    // Set the table to be displayed including ping response times
    if (!pingResponses || pingResponses.length === 0) return;
    // Set table columns
    const columns = [
        { field: 'node', headerName: 'Node', flex: 0.2, align: 'center', headerAlign: 'center',
        renderCell: params => renderHref(params.row.node, params.row.client) },
        { field: 'api', headerName: 'API', flex: 0.28, align: 'center', headerAlign: 'center',
        renderCell: params => renderHref(params.row.url, params.row.url) },
        { field: 'flag', headerName: 'Country', flex: 0.10, align: 'center', headerAlign: 'center',
            renderCell: params => params.value },
        { field: 'status', headerName: 'Status', flex: 0.10, align: 'center', headerAlign: 'center',
        renderCell: params => renderStatusSymbol(params.value) },
        { field: 'ping', headerName: 'Response time', flex: 0.15, align: 'center', headerAlign: 'center' },
        { field: 'size', headerName: 'Data size', flex: 0.15, align: 'center', headerAlign: 'center',
            renderCell: params => params.value }
    ];
    // Set a table row for every node
    const rows = nodeData.map(node => {
        // Get the response time
        const ping = pingResponses.find(response => response.url === node.api_url);
        const responseTime = ping && ping.time ? `${ping.time}ms` : '...';
        // Get the data size
        const stats = statResponses.find(response => response.url?.startsWith(node.api_url));
        const statsText = stats && stats.payload && new TextDecoder().decode(stats.payload);
        const statsData = statsText && JSON.parse(statsText);
        const dataSize = (stats && stats.loading && <Loading size={25}/>)
            || (statsData && statsData.dataSizeInTB)
            || (stats && stats.error && '-');
        // Now the status is a mix of the API and the database responses
        const isApiAlive = ping && ping.time;
        const isDatabaseAlive = stats && stats.payload;
        let status = 'fallen';
        if (isApiAlive) status = 'halted';
        if (isDatabaseAlive) status = 'active'
        // Find the corresponding country and get its flag
        const longitud = node.location[1];
        const latitud = node.location[0];
        const countryId = getCountryFromCoords(longitud, latitud);
        const countryCode = countryId.slice(0,2);
        const flag = <ReactCountryFlag countryCode={countryCode} svg
            style={{ width: "2.1em", height: "1.6em",
                border: 'solid', borderWidth: "0.1em", borderColor: "black" }} />;
        // Set the client URL
        // HARDCODE: We technically do not know the cliente URL from the API
        // HARDCODE: However the format in all nodes is similar enought nowadays
        const clientURL = node.api_url.replace('/api/', '');
        // The 'id' field is not used but it is required by the data table
        return {
            id: node.alias,
            key: node.alias,
            node: node.name,
            url: node.api_url,
            client: clientURL,
            status: status,
            ping: responseTime,
            flag: flag,
            size: dataSize,
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