import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router';
import { Button } from '@mui/material';
import DataSummary from 'src/components/data-summary';
import useAPI from 'src/hooks/use-api';
import { BASE_VERSIONED_PATH } from 'src/utils/constants';
import { buildFilter } from 'src/utils/filters';


const CollectionStatistics = () => {
    const { id: collectionId } = useParams();
    // Get the collection name from its reference
    const referenceURL = `${BASE_VERSIONED_PATH}/references/collections/${collectionId}`;
    const { payload: referenceData, error: referenceError } = useAPI(referenceURL);
    if (referenceError) throw referenceError;
    const collectionName = referenceData?.name || collectionId;

    const internalFilters = useMemo(
        () => [ buildFilter('metadata.COLLECTIONS', '==', collectionId) ], [collectionId]);

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
        <DataSummary internalFilters={internalFilters} title={`Statistics for collection: ${collectionName}`} />
    </>);
};

export default CollectionStatistics;
