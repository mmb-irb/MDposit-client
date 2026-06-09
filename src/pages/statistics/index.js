// React logic
import React from 'react';

// Visual assets
import { Typography } from '@mui/material';

// Import the map chart to display where nodes are (global client only)
import NodeMap from './nodemap';
import NodeTable from './nodetable';

// Constants
import { BASE_PATH, HOST_CONFIG } from '../../utils/constants';
// API access
import useAPI from '../../hooks/use-api';

import style from './style.module.css';
import DataSummary from '../../components/data-summary';

// Current data summary
export default () => {

    // Check if this is the global client
    const isGlobal = HOST_CONFIG.global;

    // Get nodes info
    const nodesUrl = isGlobal ? `${BASE_PATH}/current/nodes` : null;
    const { payload: nodesPayload, error: nodesError } = useAPI(nodesUrl);

    if (nodesError) console.error(nodesError.message);

    return (<>
        {isGlobal && <>
            <Typography variant="h5">Node locations</Typography>
            <NodeMap nodeData={nodesPayload} className={style.nodemap} />
            <NodeTable nodeData={nodesPayload} />
            <br />
        </>}
        <DataSummary nodeData={nodesPayload}/>
    </>);
};