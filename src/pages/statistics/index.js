// React logic
import React from 'react';

// Import the map chart to display where nodes are (global client only)
import NodeMap from './nodemap';
import NodeTable from './nodetable';

// Constants
import { BASE_PATH, HOST_CONFIG } from '../../utils/constants';
// API access
import useAPI from '../../hooks/use-api';

import style from './style.module.css';
import DataSummary from '../../components/data-summary';
import Card from '../../components/data-summary/card';

// Current data summary
export default () => {

    // Check if this is the global client
    const isGlobal = HOST_CONFIG.global;

    // Get nodes info
    const nodesUrl = isGlobal ? `${BASE_PATH}/current/nodes` : null;
    const { payload: nodesPayload, error: nodesError } = useAPI(nodesUrl);

    if (nodesError) console.error(nodesError.message);

    return (<>
        {isGlobal && <Card title="Node locations" className={style.nodes}>
            <NodeMap nodeData={nodesPayload} className={style.nodemap} />
            <NodeTable nodeData={nodesPayload} />
        </Card>}
        <DataSummary nodeData={nodesPayload}/>
    </>);
};