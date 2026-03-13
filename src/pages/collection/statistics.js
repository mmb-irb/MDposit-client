import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@mui/material';
import DataSummary from 'src/components/data-summary';

const CollectionStatistics = () => {
    const { id: collectionId } = useParams();

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
        <DataSummary internalQuery={internalQuery} title={`Statistics for collection: ${collectionId}`} />
    </>);
};

export default CollectionStatistics;
