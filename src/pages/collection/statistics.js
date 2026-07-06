import React, { useMemo } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { Button } from '@mui/material';
import DataSummary from 'src/components/data-summary';

const CollectionStatistics = () => {
    const { id: collectionId } = useParams();
    // The collection name is passed via router state from the collection page to avoid
    // an extra API call here. If the page was opened directly (e.g. a bookmarked URL),
    // fall back to the collection id.
    const { state } = useLocation();
    const collectionName = state?.collectionName || collectionId;

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
