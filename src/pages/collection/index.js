// React logic
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
// Hooks
import useAPI from 'src/hooks/use-api'; // API acces

// Additional components
import Loading from 'src/components/loading'; // Displays an animated "loading" circle
import Card from 'src/components/animated-card';
import LazyImg from 'src/components/lazy-img';
import ProjectBrowser from 'src/components/project-browser';
import { CardContent, Typography } from '@mui/material';

// Constants
import {
    BASE_VERSIONED_PATH,
    BASE_PATH_PROJECTS
} from 'src/utils/constants';

// Styling
import style from './style.module.css';
import { useTheme } from '@mui/material/styles';

// Set option fields to search among projects which belong to a collection
const PROJECT_OPTIONS = {
    'Authors': 'metadata.AUTHORS',
    'Groups': 'metadata.GROUPS',
    'System keywords': 'metadata.SYSKEYS',
};

// The main component
const Collection = () => {
    // Get the project accession according to the URL
    // Get the actual page where the user is going according to the URL
    const { id: collectionId } = useParams();
    // Get the reference data for the corresponding reference id
    const referenceURL = `${BASE_VERSIONED_PATH}/references/collections/${collectionId}`
    const {
        loading: referenceLoading,
        payload: referenceData,
        error: referenceError
    } = useAPI(referenceURL);
    // Using the options API endpoint, get a summary of values from simulations in this collection
    const query = `query={"metadata.COLLECTIONS":"${collectionId}"}`;
    const projection = Object.values(PROJECT_OPTIONS).map(field => `projection=${field}`).join('&');
    const optionsUrl = `${BASE_PATH_PROJECTS}/options?${query}&${projection}`;
    const { payload: optionsPayload, error: optionsError } = useAPI(optionsUrl);

    // Set also the internal query for the project browser
    const browserInternalQuery = useMemo(
        () => ({ 'metadata.COLLECTIONS': collectionId }), [collectionId]);

    // Get the provided theme
    const theme = useTheme();
    const secondaryColor = theme.palette.secondary;

    if (referenceLoading) return <Loading />;
    if (referenceError) return referenceError.toString();
    if (optionsError) return optionsError.toString();
    
    // Return the accession routes
    return (<Card>
        <CardContent>
            <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1em',
                }} >
                <div>
                <Typography marginBottom={'10px'} variant="h6" sx={{ fontSize: '1.4rem' }}>
                    {referenceData.name}
                </Typography>
                <div>{referenceData.description}</div>
                </div>
                <LazyImg src={referenceData.image} loading="lazy" alt={`Collection logo`}
                    style={{ maxWidth: '30%', height: 'auto', margin: '0 1em' }}
                />
            </div>
            {Object.entries(PROJECT_OPTIONS).map(([optionName, optionField]) => {
                if (!optionsPayload) return;
                // Get the option values
                const optionValues = optionsPayload[optionField];
                return (<div key={optionName} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.3em' }}>
                    <div className={style['decorated-list-item__title']}>{optionName}</div>
                    <div className={style['decorated-list-item__content']} style={{ borderColor: secondaryColor.dark }}>
                        {Object.keys(optionValues).join(', ')}
                    </div>
                </div>)
            })}
        </CardContent>
        <hr style={{ color: 'lightGrey' }} />
        <ProjectBrowser internalQuery={browserInternalQuery} />
    </Card> );
};

export default Collection;