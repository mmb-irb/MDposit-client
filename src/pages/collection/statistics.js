import React, { useMemo } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { Button } from '@mui/material';
import DataSummary from 'src/components/data-summary';
import useAPI from 'src/hooks/use-api';
import { BASE_VERSIONED_PATH } from 'src/utils/constants';

const CollectionStatistics = () => {
    const { id: collectionId } = useParams();
    // The collection name is passed via router state from the collection page to avoid
    // an extra API call here. If the page was opened directly (e.g. a bookmarked URL),
    // there is no state, so fetch the reference data ourselves as a fallback.
    const { state } = useLocation();
    const stateCollectionName = state?.collectionName;
    const referenceURL = stateCollectionName
        ? null
        : `${BASE_VERSIONED_PATH}/references/collections/${collectionId}`;
    const { payload: referenceData } = useAPI(referenceURL);
    const collectionName = stateCollectionName || referenceData?.name || collectionId;


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
