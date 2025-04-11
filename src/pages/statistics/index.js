// React logic
import React, { useMemo } from 'react';

// Visual assets
import { Typography } from '@mui/material';

// Import the map chart to display where nodes are (global client only)
import NodeMap from './nodemap';
import NodeTable from './nodetable';

// Constants
import { BASE_PATH, BASE_PATH_PROJECTS, HOST_CONFIG } from '../../utils/constants';
import { createPalette } from '../../utils/auxiliar-functions';
// API acces
import useAPI from '../../hooks/use-api';

import style from './style.module.css';

import { PieChart } from 'react-minimal-pie-chart';
import SimpleLegend from '../../components/simple-legend';
import Histogram from '../../components/histogram';

// Current data summary
export default () => {
    // Use the API to get the summary
    const summaryUrl = `${BASE_PATH_PROJECTS}/summary`;
    const { payload: summaryPayload, error: summaryError } = useAPI(summaryUrl);
  
    // Use the API to get the options
    const optionsUrl = `${BASE_PATH_PROJECTS}/options?projection=${HOST_CONFIG.optionsField}`;
    const { payload: optionsPayload, error: optionsError } = useAPI(optionsUrl);
  
    // Prepare data for the options pie chart
    const { optionsPieChartData, optionsLegendData } = useMemo(() => {
        if (!HOST_CONFIG.optionsField) return {};
        // Set the data to be represented on the pie chart
        const options = optionsPayload &&
            Object.entries(optionsPayload[HOST_CONFIG.optionsField]);
        if (options) options.sort((a, b) => b[1] - a[1]);
        const colors = options && createPalette(options.length);
        const optionsPieChartData = options
            ? options.map(([key, value], i) => ({
                title: HOST_CONFIG.optionsNiceNames[key] || key,
                value: value,
                color: colors[i],
            }))
            : [{ title: 'Loading...', value: 1, color: 'lightgrey' }];
    
        // Set the legend
        const summatory = options && options.reduce((current_value, [key, value]) => current_value + value, 0);
        const optionsLegendData = options && options.map(([key, value], i) => ({
            label: (HOST_CONFIG.optionsNiceNames[key] || key) + ' (' + (Math.round((value / summatory) * 10000 ) / 100) + ' %)',
            color: colors[i],
        }));
        // Return the pie chart data
        return { optionsPieChartData, optionsLegendData };
    }, [optionsPayload]);
  
    // Use the API to get MD method options
    const methodsUrl = `${BASE_PATH_PROJECTS}/options?projection=metadata.METHOD`;
    const { payload: methodsPayload, error: methodsError } = useAPI(methodsUrl);
  
    // Prepare data for the methods pie chart
    const { methodsPieChartData, methodsLegendData } = useMemo(() => {
        // Remove the classical MD count since it would eclipse the rest of MD methods
        methodsPayload && delete methodsPayload['metadata.METHOD']['Classical MD'];
        // Remove null values as well
        methodsPayload && delete methodsPayload['metadata.METHOD'][null];
        // Set the data to be represented on the pie chart
        const methods = methodsPayload && Object.entries(methodsPayload['metadata.METHOD']);
        if (!methods || methods.length === 0) return {};
        methods.sort((a, b) => b[1] - a[1]);
        const colors = createPalette(methods.length);
        const methodsPieChartData = methods.map(([key, value], i) => ({
            title: key,
            value: value,
            color: colors[i],
        }));
        // Set the legend
        const summatory = methods.reduce((current_value, [key, value]) => current_value + value, 0);
        const methodsLegendData = methods.map(([key, value], i) => ({
            label: key + ' (' + (Math.round((value / summatory) * 10000 ) / 100) + ' %)',
            color: colors[i],
        }));
        // Return the pie chart data
        return { methodsPieChartData, methodsLegendData };
    }, [methodsPayload]);
  
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
        const frameCounts = snapshotsPayload && oldSnapshotsPayload && { ...snapshotsPayload['mds.frames'] };
        if (snapshotsPayload && oldSnapshotsPayload) {
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
  
    // Check if this is the global cliente
    const isGlobal = HOST_CONFIG.global;

    // Get nodes info
    // Use the API to get the nodes info
    const nodesUrl = isGlobal ? `${BASE_PATH}/current/nodes` : null;
    const { payload: nodesPayload, error: nodesError } = useAPI(nodesUrl);
  
    // Handle possible errors by just showing a log error in the console
    // Thus we allow the rest of the page to keep loading
    [summaryError, optionsError, methodsError, snapshotsError, oldSnapshotsError, atomsError, nodesError].forEach(error => {
        if (error) console.error(error.message);
    });

    return (<>
        {isGlobal && <>
            <Typography variant="h6">Node locations</Typography>
            <NodeMap nodeData={nodesPayload} className={style.nodemap}/>
            <NodeTable nodeData={nodesPayload}/>
            <br />
        </>}
        <Typography key={0} variant="h6">Data summary</Typography>
        Total number of projects:{' '}
        {summaryPayload ? summaryPayload.projectsCount : 'Loading...'}
        <br />
        Total number of MDs:{' '}
        {summaryPayload ? summaryPayload.mdCount : 'Loading...'}
        <br />
        {/*
            DANI: Funciona. Solo lo he quitado temporalmente por un tema "político"
            Total amount of MD time (μs):{' '}
            {summaryPayload ? Math.round(summaryPayload.totalTime / 1000) : 'Loading...'}
            <br />
        */}
        Total amount of MD frames:{' '}
        {summaryPayload ? summaryPayload.totalFrames : 'Loading...'}
        <br />
        Total number of stored files:{' '}
        {summaryPayload ? summaryPayload.totalFiles : 'Loading...'}
        <br />
        Total number of stored analyses:{' '}
        {summaryPayload ? summaryPayload.totalAnalyses : 'Loading...'}
        <br />
        <br />
        {HOST_CONFIG.optionsField && <>
            <Typography variant="h6">{`Projects per ${HOST_CONFIG.optionsLabel}`}</Typography>
            <div className={style.horizontal}>
                <PieChart
                    data={optionsPieChartData}
                    //label={({ dataEntry }) => dataEntry.value}
                    className={style.piechart}
                />
                {optionsLegendData && (
                    <SimpleLegend entries={optionsLegendData} className={style.legend} />
                )}
            </div>
        </>}
        {methodsPieChartData && <>
            <Typography variant="h6">Projects per non-equilibrium MD method</Typography>
            <div className={style.horizontal}>
                <PieChart
                    data={methodsPieChartData}
                    //label={({ dataEntry }) => dataEntry.value}
                    className={style.piechart}
                />
                {methodsLegendData && (
                    <SimpleLegend entries={methodsLegendData} className={style.legend} />
                )}
            </div>
        </>}
        <div className={style.histograms} >
            <div className={style.half}>
                <Typography variant="h6">Snapshots per MD</Typography>
                <Histogram
                    data={frameCounts}
                    xAxisLabelText={'Number of snapshots'}
                    yAxisLabelText={'Number of MDs'}
                    onHover={d => `There are ${d.length} MDs with a number of snapshots between ${d.x0} and ${d.x1}`}
                />
            </div>
            <div className={style.half}>
                <Typography variant="h6">System atoms per project</Typography>
                <Histogram
                    data={atomsPayload && atomsPayload["metadata.SYSTATS"]}
                    xAxisLabelText={'Number of atoms'}
                    yAxisLabelText={'Number of projects'}
                    color={"#ffcc00"}
                    onHover={d => `There are ${d.length} MDs with a number of atoms between ${d.x0} and ${d.x1}`}
                />
            </div>
        </div>
    </>);
};