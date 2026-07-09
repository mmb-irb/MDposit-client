import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@mui/material';
import DataSummary from 'src/components/data-summary';
import { HOST_CONFIG } from 'src/utils/constants';


const CollectionStatistics = () => {
    const { id: collectionId } = useParams();
    // Collection names are loaded into HOST_CONFIG.collectionNiceNames at startup
    const collectionName = HOST_CONFIG.collectionNiceNames[collectionId] || collectionId;

    const internalQuery = useMemo(
        () => ({ 'metadata.COLLECTIONS': collectionId }), [collectionId]);

    return (<>
        <Button
            component={Link}
            to={`/collection/${collectionId}`}
            variant="outlined"
            size="small"
            style={{ marginBottom: '1em' }}
        >
            ← Back to collection
        </Button>
        <DataSummary internalQuery={internalQuery} title={`Statistics for collection: ${collectionName}`} />
    </>);
};

export default CollectionStatistics;
