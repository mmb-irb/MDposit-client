// React logic
import React, { useEffect, useMemo, useState } from 'react';

// Visual assets
import { Typography } from '@mui/material';

// Import the map chart to display where nodes are (global client only)
import NodeMap from './nodemap';
import NodeTable from './nodetable';

// Constants
import { BASE_PATH, BASE_PATH_PROJECTS, HOST_CONFIG } from '../../utils/constants';
import { buildProjectionQuery, createPalette } from '../../utils/auxiliar-functions';
// API acces
import useAPI from '../../hooks/use-api';

import style from './style.module.css';
import { useTheme } from '@mui/material/styles';

import PieChart from '../../components/pie-chart';
import Histogram from '../../components/histogram';
import TimelineChart from './timeline';

// Utility to search for a field by title (name) or label (path) in queryFields
export function findFieldByTitleOrLabel(queryFields, searchValue) {
    for (const [categoryName, category] of Object.entries(queryFields)) {
        for (const field of category) {
            if (field.name === searchValue || field.path === searchValue) {
                field.category = categoryName;
                return field;
            }
        }
    }
    return null;
}

// Current data summary
export default () => {

    // Get the provided theme
    const theme = useTheme();
    const primaryColor = theme.palette.primary.main;
    const secondaryColor = theme.palette.secondary.dark;

    // Use the API to get the summary
    const summaryUrl = `${BASE_PATH_PROJECTS}/summary`;
    const { payload: summaryPayload, error: summaryError } = useAPI(summaryUrl);

    // Use the API to get the options
    // Reuse projection query logic from custom-search
    const availableFields = HOST_CONFIG.availableFields;
    const queryFields = HOST_CONFIG.queryFields;
    const projectionQuery = buildProjectionQuery(availableFields);
    const optionsUrl = `${BASE_PATH_PROJECTS}/options?${projectionQuery}`;
    const { payload: optionsPayload, error: optionsError } = useAPI(optionsUrl, { name: 'browse', cacheOn: true });


    // State for selected options field for pie chart
    const [selectedOptionsField, setSelectedOptionsField] = useState(null);

    // Get all available fields from optionsPayload (if loaded), sorted and memoized
    const availableOptionsFields = useMemo(() => {
        if (!optionsPayload) return [];
        return Object.keys(optionsPayload).slice().sort((a, b) => {
                const aName = findFieldByTitleOrLabel(queryFields, a)?.name || a;
                const bName = findFieldByTitleOrLabel(queryFields, b)?.name || b;
                return aName.localeCompare(bName);
            });
    }, [optionsPayload]);

    // Set default selected field when optionsPayload loads
    useEffect(() => {
        if (availableOptionsFields.length > 0 && !selectedOptionsField) {
            setSelectedOptionsField(availableOptionsFields.includes('node') ? 'node' : methods.COLLECTION);
        }
    }, [optionsPayload]);

    // Use the API to get the project growth data
    const growthUrl = `${BASE_PATH_PROJECTS}/summary/growth`;
    const { payload: growthPayload, error: growthError } = useAPI(growthUrl);

    // Prepare data for the selected options pie chart
    const { optionPieChartData, optionLegendData } = useMemo(() => {
        if (!selectedOptionsField || !optionsPayload) return {};
        console.log('Preparing pie chart for field:', optionsPayload, queryFields);
        const option = Object.entries(optionsPayload[selectedOptionsField]).filter(([key, value]) => key !== 'null');
        if (option) option.sort((a, b) => b[1] - a[1]);
        const colors = option && createPalette(option.length);
        // Cycle through the colors array in steps of 20% of its length
        if (colors) {
            const step = Math.max(1, Math.floor(colors.length * 0.2));
            const cycledColors = [];
            let idx = 0;
            for (let i = 0; i < colors.length; i++) {
            cycledColors.push(colors[idx]);
            idx = (idx + step) % colors.length;
            }
            for (let i = 0; i < colors.length; i++) {
            colors[i] = cycledColors[i];
            }
        }
        const optionPieChartData = option
            ? option
            .map(([key, value], i) => ({
                title: key,
                value: value,
                color: colors[i],
            }))
            : [{ title: 'Loading...', value: 1, color: 'lightgrey' }];
        const summatory = option && option.reduce((current_value, [key, value]) => current_value + value, 0);
        const optionLegendData = option && option.map(([key, value], i) => ({
            label: key.charAt(0).toUpperCase() + key.slice(1) + ': ' + value + ' (' + (Math.round((value / summatory) * 10000) / 100) + ' %)',
            color: colors[i],
        }));
        return { optionPieChartData, optionLegendData };
    }, [optionsPayload, selectedOptionsField]);

    // Use the API to get the snapshots options
    const snapshotsUrl = `${BASE_PATH_PROJECTS}/options?projection=mds.frames`;
    const { payload: snapshotsPayload, error: snapshotsError } = useAPI(snapshotsUrl);

    // Use the API to get the snapshots options
    const oldSnapshotsUrl = `${BASE_PATH_PROJECTS}/options?query={"mds":{"$exists":false}}&projection=metadata.SNAPSHOTS`;
    const { payload: oldSnapshotsPayload, error: oldSnapshotsError } = useAPI(oldSnapshotsUrl);

    // Build the snapshots component
    // If snapshots data is not yet downloaded then show an empty plot
    const frameCounts = useMemo(() => {
        // Merge both the new and the old format frame counts
        let frameCounts = {};
        if (snapshotsPayload) frameCounts = { ...snapshotsPayload['mds.frames'] };
        if (oldSnapshotsPayload) {
            Object.entries(oldSnapshotsPayload['metadata.SNAPSHOTS']).forEach(([frameCount, amount]) => {
                let currentAmount = frameCounts[frameCount] || 0;
                currentAmount += amount;
                frameCounts[frameCount] = currentAmount;
            })
        }
        return frameCounts
    }, [snapshotsPayload, oldSnapshotsPayload]);

    // Use the API to get the atoms options
    const atomsUrl = `${BASE_PATH_PROJECTS}/options?projection=metadata.SYSTATS`;
    const { payload: atomsPayload, error: atomsError } = useAPI(atomsUrl);
    // Use the API to get the number of MDs per project
    const mdCountUrl = `${BASE_PATH_PROJECTS}/options?projection=mdcount`;
    const { payload: mdCountPayload, error: mdCountError } = useAPI(mdCountUrl);

    // Check if this is the global cliente
    const isGlobal = HOST_CONFIG.global;

    // Get nodes info
    // Use the API to get the nodes info
    const nodesUrl = isGlobal ? `${BASE_PATH}/current/nodes` : null;
    const { payload: nodesPayload, error: nodesError } = useAPI(nodesUrl);

    // Handle possible errors by just showing a log error in the console
    // Thus we allow the rest of the page to keep loading
    [summaryError, optionsError, snapshotsError, oldSnapshotsError, atomsError, mdCountError, nodesError, growthError].forEach(error => {
        if (error) console.error(error.message);
    });

    return (<>
        {isGlobal && <>
            <Typography variant="h6">Node locations</Typography>
            <NodeMap nodeData={nodesPayload} className={style.nodemap} />
            <NodeTable nodeData={nodesPayload} />
            <br />
        </>}
        <Typography key={0} variant="h6">Data summary</Typography>
        Total number of projects:{' '}
        {summaryPayload ? summaryPayload.projectsCount.toLocaleString() : 'Loading...'}
        <br />
        Total number of MDs:{' '}
        {summaryPayload ? summaryPayload.mdCount.toLocaleString() : 'Loading...'}
        <br />
        {/*
            DANI: Funciona. Solo lo he quitado temporalmente por un tema "político"
            Total amount of MD time (μs):{' '}
            {summaryPayload ? Math.round(summaryPayload.totalTime / 1000) : 'Loading...'}
            <br />
        */}
        Total amount of MD frames:{' '}
        {summaryPayload ? summaryPayload.totalFrames.toLocaleString() : 'Loading...'}
        <br />
        Total number of stored files:{' '}
        {summaryPayload ? summaryPayload.totalFiles.toLocaleString() : 'Loading...'}
        <br />
        Total number of stored analyses:{' '}
        {summaryPayload ? summaryPayload.totalAnalyses.toLocaleString() : 'Loading...'}
        <br />
        Total size of the uncompressed data:{' '}
        {summaryPayload ? `${summaryPayload.storageStats.dataSizeInTB} (TB)` : 'Loading...'}
        <br />
        {availableOptionsFields.length > 0 && (
            <>
                <Typography style={{ marginTop: 16 }} variant="h6">Projects per field</Typography>
                <div style={{ marginBottom: 16 }}>
                    <label htmlFor="options-field-select" style={{ marginRight: 8 }}>Field:</label>
                    <select
                        id="options-field-select"
                        value={selectedOptionsField || ''}
                        onChange={e => setSelectedOptionsField(e.target.value)}
                        style={{ fontSize: '1rem', padding: '4px 8px' }}
                    >
                        {availableOptionsFields.map(field => {
                            const fieldObj = findFieldByTitleOrLabel(queryFields, field);
                            return (
                                <option key={field} value={field}>
                                    {fieldObj
                                        ? `${fieldObj.name} (${fieldObj.category})`
                                        : field}
                                </option>
                            );
                        })}
                    </select>
                </div>
                {optionPieChartData && optionLegendData && (
                    <PieChart
                        data={optionPieChartData}
                        legendData={optionLegendData}
                        autoHide={true}
                    />
                )}
            </>
        )}
        <div className={style.histograms} >
            <div className={style.histogram}>
                <Typography variant="h6">Snapshots per MD</Typography>
                <Histogram
                    data={frameCounts}
                    xAxisLabelText={'Snapshots'}
                    yAxisLabelText={'MDs'}
                    color={primaryColor}
                    binMethod={'sturges'}
                    onHover={d => `There are ${d.length} MDs with a number of snapshots between ${Math.floor(d.x0)} and ${Math.floor(d.x1)}`}
                />
            </div>
            <div className={style.histogram}>
                <Typography variant="h6">System atoms per project</Typography>
                <Histogram
                    data={atomsPayload && atomsPayload["metadata.SYSTATS"]}
                    xAxisLabelText={'Atoms'}
                    yAxisLabelText={'Projects'}
                    color={secondaryColor}
                    binMethod={'sturges'}
                    onHover={d => `There are ${d.length} MDs with a number of atoms between ${Math.floor(d.x0)} and ${Math.floor(d.x1)}`}
                />
            </div>
            <div className={style.histogram}>
                <Typography variant="h6">MD count per project</Typography>
                <Histogram
                    data={mdCountPayload && mdCountPayload["mdcount"]}
                    xAxisLabelText={'MDs'}
                    yAxisLabelText={'Projects'}
                    color={primaryColor}
                    binMethod={'linear'}
                    binCount={ mdCountPayload && mdCountPayload["mdcount"] 
                        ? Math.max(...Object.keys(mdCountPayload["mdcount"]).map(Number)) 
                        : 10}
                    onHover={d => `There are ${d.length} MDs with a number of MDs between ${Math.floor(d.x0)} and ${Math.floor(d.x1)}`}
                />
            </div>
        </div>
        <Typography variant="h6">Projects and MDs Growth Over Time</Typography>
        <div className={style.timelineChart}>
            {growthPayload ? (
                <TimelineChart
                    data={growthPayload}
                    className={style.growthChart}
                />
            ) : (
                'Loading growth data...'
            )}
        </div>
    </>);
};