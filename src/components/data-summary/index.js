import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, ButtonGroup, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import { BASE_PATH_PROJECTS, BASE_VERSIONED_PATH, HOST_CONFIG } from '../../utils/constants';
import { buildProjectionQuery, createPalette, formatBytes } from '../../utils/auxiliar-functions';
import useAPI from '../../hooks/use-api';
import useBatchAPI from '../../hooks/use-batch-api';

import PieChart from '../pie-chart';
import Histogram from '../histogram';
import SimpleHistogram from '../simple-histogram';
import TimelineChart from './timeline';
import FramestepPlot from './framestep';

// Fields that are best represented as a pie chart (categorical, low cardinality)
const PIE_CHART_FIELDS = new Set([
    'metadata.METHOD', 'metadata.WAT', 'metadata.BOXTYPE', 'metadata.COLLECTIONS',
    'metadata.ENSEMBLE', 'metadata.INTERACTIONS.type', 'metadata.TEMP',
    'metadata.TIMESTEP', 'metadata.PROGRAM', 'metadata.TYPE', 'node',
]);

// Fields to hide because they are more for internal use
const HIDDEN_FIELDS = new Set([
    'files.name', 'mds.files.name', 'mds.analyses.name'
]);

// Fields excluded from the constants section (too context-specific to be useful there)
const CONSTANTS_HIDDEN_FIELDS = new Set([
    'metadata.AUTHORS', 'metadata.COLLECTIONS', 'published', 'metadata.GROUPS',
]);

import style from './style.module.css';

const formatFieldValue = value => value.charAt(0).toUpperCase() + value.slice(1);

const formatNodeDisplayName = (nodeAlias, nodeNameMap) => nodeNameMap[nodeAlias] || nodeAlias;

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

/**
 * DataSummary component — displays a summary table, pie chart, growth timeline,
 * and histograms of project statistics.
 *
 * @param {object|null} internalQuery - Optional MongoDB-style query object to filter
 *   the statistics to a subset of projects (e.g. `{ 'metadata.COLLECTIONS': 'col123' }`).
 *   When omitted the global summary is shown.
 * @param {string} [title='Data summary'] - Section heading text.
 */
const DataSummary = ({ internalQuery = null, title = 'Data summary', nodeData = null }) => {
    // Get the provided theme
    const theme = useTheme();
    const primaryColor = theme.palette.primary.main;
    const secondaryColor = theme.palette.secondary.dark;
    const isGlobalSummary = HOST_CONFIG.global && !internalQuery;

    // Helper to build the leading query string fragment for URLs
    const queryPrefix = internalQuery
        ? `query=${encodeURIComponent(JSON.stringify(internalQuery))}&`
        : '';

    // Use the API to get the summary
    const summaryQueryParam = internalQuery
        ? `?query=${encodeURIComponent(JSON.stringify(internalQuery))}`
        : '';
    const summaryUrl = `${BASE_PATH_PROJECTS}/summary${summaryQueryParam}`;
    const { payload: summaryPayload, error: summaryError } = useAPI(summaryUrl, { name: 'summary', cacheOn: true });
    // Use the API to get the options
    // Reuse projection query logic from custom-search
    const availableFields = HOST_CONFIG.availableFields;
    const queryFields = HOST_CONFIG.queryFields;
    const projectionQuery = buildProjectionQuery(availableFields);
    const optionsUrl = `${BASE_PATH_PROJECTS}/options?${queryPrefix}${projectionQuery}&countMds=true`;
    const { payload: optionsPayload, error: optionsError } = useAPI(optionsUrl, { name: 'browse', cacheOn: true });

    // State for selected options field for pie chart
    const [selectedOptionsField, setSelectedOptionsField] = useState(null);
    const [selectedStatsMode, setSelectedStatsMode] = useState('mds');
    const selectedStatsIndex = selectedStatsMode === 'mds' ? 1 : 0;

    const getOptionCount = useCallback(value => {
        if (Array.isArray(value)) return Number(value[selectedStatsIndex] ?? 0);
        const parsedValue = Number(value);
        return Number.isFinite(parsedValue) ? parsedValue : 0;
    }, [selectedStatsIndex]);

    // Get all available fields from optionsPayload (if loaded), sorted and memoized
    // Filter out fields where all entries are null (would produce an empty legend)
    const availableOptionsFields = useMemo(() => {
        if (!optionsPayload) return [];
        return Object.keys(optionsPayload)
            .filter(field => !HIDDEN_FIELDS.has(field) && Object.keys(optionsPayload[field]).some(key => key !== 'null'))
            .sort((a, b) => {
                const aName = findFieldByTitleOrLabel(queryFields, a)?.name || a;
                const bName = findFieldByTitleOrLabel(queryFields, b)?.name || b;
                return aName.localeCompare(bName);
            });
    }, [optionsPayload]);

    // Classify fields: single-value (constants), all-equal-count (uniform), or variable
    const { constantFields, uniformFields, variableOptionsFields } = useMemo(() => {
        if (!optionsPayload || availableOptionsFields.length === 0)
            return { constantFields: [], uniformFields: [], variableOptionsFields: [] };
        const constantFields = [], uniformFields = [], variableOptionsFields = [];
        for (const field of availableOptionsFields) {
            const entries = Object.entries(optionsPayload[field])
                .filter(([key]) => key !== 'null')
                .map(([key, value]) => [key, getOptionCount(value)]);
            if (entries.length === 0) continue;
            if (entries.length === 1) {
                constantFields.push({ field, entries });
            } else {
                const firstCount = entries[0][1];
                if (entries.every(([, v]) => v === firstCount)) {
                    uniformFields.push({ field, entries });
                } else {
                    variableOptionsFields.push(field);
                }
            }
        }
        return { constantFields, uniformFields, variableOptionsFields };
    }, [availableOptionsFields, optionsPayload, getOptionCount]);

    // Set default selected field when variableOptionsFields is first populated
    useEffect(() => {
        if (variableOptionsFields.length > 0 && !selectedOptionsField) {
            if (internalQuery && variableOptionsFields.includes('metadata.METHOD')) {
                setSelectedOptionsField('metadata.METHOD');
            } else if (!internalQuery && variableOptionsFields.includes('node')) {
                setSelectedOptionsField('node');
            } else if (!internalQuery && variableOptionsFields.includes('metadata.COLLECTIONS')) {
                setSelectedOptionsField('metadata.COLLECTIONS');
            } else {
                setSelectedOptionsField(variableOptionsFields[0]);
            }
        }
    }, [variableOptionsFields, internalQuery, selectedOptionsField]);

    // Reset selection if current field moves to constant/uniform (e.g. after MDs/Projects toggle)
    useEffect(() => {
        if (!selectedOptionsField || variableOptionsFields.length === 0) return;
        if (!variableOptionsFields.includes(selectedOptionsField)) {
            setSelectedOptionsField(variableOptionsFields[0]);
        }
    }, [variableOptionsFields]);
    // Use the API to get the real data size from the stats endpoint
    const statsUrl = !isGlobalSummary ? `${BASE_VERSIONED_PATH}/stats${summaryQueryParam}` : null;
    const { payload: statsPayload, error: statsError } = useAPI(statsUrl, { name: 'stats', cacheOn: true });

    const nodeNameMap = useMemo(() => {
        if (!Array.isArray(nodeData)) return {};

        return nodeData.reduce((acc, node) => {
            if (node?.alias && node?.name) {
                acc[node.alias] = node.name;
            }
            return acc;
        }, {});
    }, [nodeData]);

    // Aggregate data size across all nodes for the global view
    const federatedStatsUrls = useMemo(() => {
        if (!isGlobalSummary || !Array.isArray(nodeData) || nodeData.length === 0) return [];
        return nodeData
            .map(node => node && node.api_url)
            .filter(Boolean)
            .map(apiUrl => `${apiUrl}rest/current/stats`);
    }, [isGlobalSummary, nodeData]);

    const batchStatsResponses = useBatchAPI(federatedStatsUrls, 'json');

    const { bsPayload, bsError, bsLoading } = useMemo(() => {
        if (!isGlobalSummary)
            return { bsPayload: null, bsError: null, bsLoading: false, };
        if (federatedStatsUrls.length === 0)
            return { bsPayload: null, bsError: null, bsLoading: true, };

        const isLoading = batchStatsResponses.length !== federatedStatsUrls.length
            || batchStatsResponses.some(response => response.loading);

        const successfulPayloads = batchStatsResponses
            .filter(response => !response.loading && !response.error && response.payload)
            .map(response => response.payload);

        if (successfulPayloads.length > 0) {
            const totalDataSizeInTB = successfulPayloads.reduce((acc, payload) => {
                const parsedSize = Number(payload?.dataSizeInTB);
                return acc + (Number.isFinite(parsedSize) ? parsedSize : 0);
            }, 0);
            return {
                bsPayload: {
                    dataSizeInTB: Math.round(totalDataSizeInTB * 1000) / 1000,
                    nodeCount: successfulPayloads.length,
                    totalNodes: federatedStatsUrls.length,
                },
                bsError: null,
                bsLoading: isLoading,
            };
        }

        if (isLoading)
            return { bsPayload: null, bsError: null, bsLoading: true, };

        const firstError = batchStatsResponses.find(response => response.error)?.error;
        return {
            bsPayload: null,
            bsError: firstError || new Error('Unable to retrieve stats from any node'),
            bsLoading: false,
        };
    }, [isGlobalSummary, federatedStatsUrls, batchStatsResponses]);

    // Use the API to get the project growth data (global only — not meaningful for subsets)
    const growthUrl = !internalQuery ? `${BASE_PATH_PROJECTS}/summary/growth` : null;
    const { payload: growthPayload, error: growthError } = useAPI(growthUrl, { name: 'growth', cacheOn: true });
    // Use the API datapoint for the FrameStep plot
    const framestepUrl = `${BASE_PATH_PROJECTS}/summary/framestep${summaryQueryParam}`;

    // Prepare data for the selected options pie chart
    const { optionPieChartData, optionLegendData } = useMemo(() => {
        if (!selectedOptionsField || !optionsPayload) return {};
        const option = Object.entries(optionsPayload[selectedOptionsField])
        .filter(([key]) => key !== 'null')
        .map(([key, value]) => [key, getOptionCount(value)]);
        if (option) {
            if (!PIE_CHART_FIELDS.has(selectedOptionsField)) {
                option.sort((a, b) => b[1] - a[1]);
            } else {
                option.sort((a, b) => {
                    const aLabel = a[0];
                    const bLabel = b[0];
                    return aLabel.localeCompare(bLabel) || a[0].localeCompare(b[0]);
                });
            }
        }
        const colors = option && createPalette(option.length);
        // Cycle through the colors array in steps of 20% of its length
        if (colors) {
            const step = Math.max(1, Math.floor(colors.length * 0.15));
            const cycledColors = [];
            let idx = 0;
            for (let i = 0; i < colors.length; i++) {
                cycledColors.push(colors[idx]);
                idx = (idx + step) % colors.length;
            }
            for (let i = 0; i < colors.length; i++) colors[i] = cycledColors[i];
        }
        // Max value for histogram and sumatory for pie chart
        let divisor;
        if (PIE_CHART_FIELDS.has(selectedOptionsField)) {
            divisor = option.reduce((acc, [, value]) => acc + value, 0);
        } else {
            divisor = option.reduce((max, [, value]) => value > max ? value : max, 0);
        }
        const displayLabel = key => selectedOptionsField === 'node'
            ? formatNodeDisplayName(key, nodeNameMap)
            : formatFieldValue(key);
        const optionPieChartData = option
            ? option.map(([key, value], i) => ({
                title: displayLabel(key),
                value,
                percentage: divisor ? Math.round((value / divisor) * 10000) / 100 : 0,
                color: colors[i],
            }))
            : [{ title: 'Loading...', value: 1, percentage: 100, color: 'lightgrey' }];
        const optionLegendData = option && option.map(([key, value], i) => ({
            value,
            label: displayLabel(key) + ': ' + value + ' (' + (Math.round((value / divisor) * 10000) / 100) + '%)',
            color: colors[i],
        }));
        return { optionPieChartData, optionLegendData };
    }, [getOptionCount, nodeNameMap, optionsPayload, selectedOptionsField, selectedStatsIndex]);

    // Use the API to get the snapshots options
    const snapshotsUrl = `${BASE_PATH_PROJECTS}/options?${queryPrefix}projection=mds.frames`;
    const { payload: snapshotsPayload, error: snapshotsError } = useAPI(snapshotsUrl);

    // Use the API to get the snapshots options
    const oldSnapshotsBaseQuery = { mds: { $exists: false } };
    const oldSnapshotsQuery = internalQuery
        ? { ...oldSnapshotsBaseQuery, ...internalQuery }
        : oldSnapshotsBaseQuery;
    const oldSnapshotsUrl = `${BASE_PATH_PROJECTS}/options?query=${encodeURIComponent(JSON.stringify(oldSnapshotsQuery))}&projection=metadata.SNAPSHOTS`;
    const { payload: oldSnapshotsPayload, error: oldSnapshotsError } = useAPI(oldSnapshotsUrl);

    // Build the snapshots component
    // If snapshots data is not yet downloaded then show an empty plot
    const frameCounts = useMemo(() => {
        // Merge both the new and the old format frame counts
        let frameCounts = {};
        if (snapshotsPayload) frameCounts = { ...snapshotsPayload['mds.frames'] };
        if (oldSnapshotsPayload) {
            Object.entries(oldSnapshotsPayload['metadata.SNAPSHOTS']).forEach(([frameCount, amount]) => {
                frameCounts[frameCount] = (frameCounts[frameCount] || 0) + amount;
            });
        }
        return frameCounts;
    }, [snapshotsPayload, oldSnapshotsPayload]);

    // Use the API to get the atoms options
    const atomsUrl = `${BASE_PATH_PROJECTS}/options?${queryPrefix}projection=metadata.SYSTATS`;
    const { payload: atomsPayload, error: atomsError } = useAPI(atomsUrl);

    // Use the API to get the number of MDs per project
    const mdCountUrl = `${BASE_PATH_PROJECTS}/options?${queryPrefix}projection=mdcount`;
    const { payload: mdCountPayload, error: mdCountError } = useAPI(mdCountUrl);

    const framesBinCount = Object.keys(frameCounts).length;
    const atomsBinCount = Object.keys(atomsPayload?.["metadata.SYSTATS"] ?? {}).length;
    const mdsBinCount = Object.keys(mdCountPayload?.["mdcount"] ?? {}).length;

    // For the time distribution: hide when both axis marginals are single-decade
    const [framestepPoints, setFramestepPoints] = useState(null);

    const showTimeDistribution = useMemo(() => {
        if (!framestepPoints) return true; // show while loading
        if (framestepPoints.length === 0) return false;
        const tDecades = new Set(framestepPoints.map(([t]) => Math.floor(Math.log10(t))));
        const fDecades = new Set(framestepPoints.map(([, f]) => Math.floor(Math.log10(f))));
        return tDecades.size > 1 || fDecades.size > 1;
    }, [framestepPoints]);

    // Single unique framestep value (ns), or null if multiple / not yet loaded
    const framestepConstant = useMemo(() => {
        if (!framestepPoints || framestepPoints.length === 0) return null;
        const unique = new Set(framestepPoints.map(([,, fs]) => fs));
        if (unique.size !== 1) return null;
        const v = [...unique][0];
        return v < 1 ? `${Number(v.toPrecision(4))} ns` : `${Number(v.toPrecision(6))} ns`;
    }, [framestepPoints]);

    // Handle possible errors by just showing a log error in the console
    // Thus we allow the rest of the page to keep loading
    const errorMap = { summaryError, optionsError, snapshotsError, oldSnapshotsError, atomsError, mdCountError, growthError, statsError, bsError };
    Object.entries(errorMap).forEach(([name, error]) => {
        if (error) console.error(`${name}:`, error.message);
    });

    const dataSizeValue = useMemo(() => {
        if (!isGlobalSummary && statsPayload) {
            if (statsPayload.totalSize !== undefined)
                return formatBytes(statsPayload.totalSize);
            // Backwards compatibility for API<0.0.13
            else if (statsPayload.realDataSizeInTB !== undefined)
                return `${statsPayload?.realDataSizeInTB.toFixed(2)} TB`;
            else
                return 'Loading...';
        }
        if (!Array.isArray(nodeData) || nodeData.length === 0) return 'Loading...';
        if (bsPayload) return `${bsPayload.dataSizeInTB.toLocaleString()} TB`;
        if (bsError) return 'Unavailable';
        return 'Loading...';
    }, [isGlobalSummary, nodeData, statsPayload, bsPayload, bsLoading, bsError]);

    return (<>
        <div className={style.dataSummary}>
            <Typography style={{ marginBottom: 10 }} variant="h5">{title}</Typography>
            <table className={style.summaryTable}>
                <tbody>
                    <tr>
                        <td className={style.summaryTitle}>Projects</td>
                        <td className={style.summaryTitle}>MDs</td>
                        <td className={style.summaryTitle}>Time (μs)</td>
                        <td className={style.summaryTitle}>Frames</td>
                        <td className={style.summaryTitle}>Files</td>
                        <td className={style.summaryTitle}>Analyses</td>
                        <td className={style.summaryTitle}>Data</td>
                    </tr>
                    <tr>
                        <td className={style.summaryValue}>{summaryPayload ? summaryPayload.projectsCount.toLocaleString() : 'Loading...'}</td>
                        <td className={style.summaryValue}>{summaryPayload ? summaryPayload.mdCount.toLocaleString() : 'Loading...'}</td>
                        <td className={style.summaryValue}>{summaryPayload ? Math.round(summaryPayload.totalTime / 1000) : 'Loading...'}</td>
                        <td className={style.summaryValue}>{summaryPayload ? summaryPayload.totalFrames.toLocaleString() : 'Loading...'}</td>
                        <td className={style.summaryValue}>{summaryPayload ? summaryPayload.totalFiles.toLocaleString() : 'Loading...'}</td>
                        <td className={style.summaryValue}>{summaryPayload ? summaryPayload.totalAnalyses.toLocaleString() : 'Loading...'}</td>
                        <td className={style.summaryValue}>{dataSizeValue}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        {!internalQuery && <div className={style.growth}>
            <Typography variant="h5">Data Growth Over Time</Typography>
            <div className={style.timelineChart}>
                {growthPayload ? (
                    <TimelineChart data={growthPayload} className={style.growthChart} />
                ) : (
                    'Loading growth data...'
                )}
            </div>
        </div>}
        {(() => {
            const formatVal = (field, key) => field === 'node'
                ? formatNodeDisplayName(key, nodeNameMap)
                : formatFieldValue(key);
            const allConstantItems = [
                ...constantFields.filter(({ field }) => !CONSTANTS_HIDDEN_FIELDS.has(field))
                    .map(({ field, entries }) => ({
                        key: field,
                        displayName: findFieldByTitleOrLabel(queryFields, field)?.name || field,
                        displayValue: formatVal(field, entries[0][0]),
                    })),
                ...uniformFields.filter(({ field }) => !CONSTANTS_HIDDEN_FIELDS.has(field))
                    .map(({ field, entries }) => ({
                        key: field,
                        displayName: findFieldByTitleOrLabel(queryFields, field)?.name || field,
                        displayValue: entries.map(([key]) => formatVal(field, key)).join(' · '),
                    })),
            ];
            if (framesBinCount === 1)
                allConstantItems.push({ key: '__frames__', displayName: 'Frames', displayValue: Number(Object.keys(frameCounts)[0]).toLocaleString() });
            if (atomsBinCount === 1) {
                const v = Object.keys(atomsPayload["metadata.SYSTATS"])[0];
                allConstantItems.push({ key: '__atoms__', displayName: 'Atoms', displayValue: Number(v).toLocaleString() });
            }
            if (mdsBinCount === 1) {
                const v = Object.keys(mdCountPayload["mdcount"])[0];
                allConstantItems.push({ key: '__mds__', displayName: 'MDs per project', displayValue: Number(v).toLocaleString() });
            }
            if (framestepConstant)
                allConstantItems.push({ key: '__framestep__', displayName: 'Framestep', displayValue: framestepConstant });
            allConstantItems.sort((a, b) => a.displayName.localeCompare(b.displayName));
            if (allConstantItems.length === 0) return null;
            return (
                <div className={style.constantsSection}>
                    <Typography variant="h5">Constant fields</Typography>
                    <div className={style.constantsGrid}>
                        {allConstantItems.map(({ key, displayName, displayValue }) => (
                            <div key={key} className={style.constantItem}>
                                <span className={style.constantLabel}>{displayName}</span>
                                <span className={style.constantValue}>{displayValue}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        })()}
        {(availableOptionsFields.length === 0 || variableOptionsFields.length > 0) && (
        <div className={style.fieldStats}>
            <div className={style.fieldStatsHeader}>
                <Typography variant="h5">Statistics per field</Typography>
                <ButtonGroup size="small" variant="outlined" className={style.statsModeToggle}>
                    <Button
                        onClick={() => setSelectedStatsMode('mds')}
                        variant={selectedStatsMode === 'mds' ? 'contained' : 'outlined'}
                    >
                        MDs
                    </Button>
                    <Button
                        onClick={() => setSelectedStatsMode('projects')}
                        variant={selectedStatsMode === 'projects' ? 'contained' : 'outlined'}
                    >
                        Projects
                    </Button>
                </ButtonGroup>
            </div>
            {availableOptionsFields.length === 0 ? (
                <div style={{ textAlign: 'center' }}>Loading field data...</div>
            ) : (
                <>{variableOptionsFields.length > 0 && (<>
                    <div style={{ marginBottom: 18, width: '33%' }}>
                        <select
                            id="options-field-select"
                            value={selectedOptionsField || ''}
                            onChange={e => setSelectedOptionsField(e.target.value)}
                            style={{ fontSize: '1rem', padding: '4px 8px', width: '99%' }}
                        >
                            {variableOptionsFields.map(field => {
                                const fieldObj = findFieldByTitleOrLabel(queryFields, field);
                                return (
                                    <option key={field} value={field}>
                                        {fieldObj ? `${fieldObj.name} (${fieldObj.category})` : field}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                    {optionPieChartData && optionLegendData && optionLegendData.length > 0 && (
                        PIE_CHART_FIELDS.has(selectedOptionsField)
                            ? <PieChart data={optionPieChartData} legendData={optionLegendData} autoHide={true} />
                            : <div className={style.fieldHistograms}>
                                <SimpleHistogram
                                    showPercentage={false}
                                    data={optionPieChartData.map(item => ({
                                        label: item.title,
                                        value: item.value,
                                        percentage: item.percentage,
                                    }))} />
                            </div>
                    )}
                </>)}</>
            )}
        </div>
        )}
        {(framesBinCount > 1 || atomsBinCount > 1 || mdsBinCount > 1) && <>
            <Typography variant="h5">Data distributions</Typography>
            <div className={style.histograms}>
                {framesBinCount > 1 && <div className={style.histogram}>
                    <Histogram
                        data={frameCounts}
                        xAxisLabelText={'Frames'}
                        yAxisLabelText={'Projects'}
                        color={primaryColor}
                        binMethod={'sturges'}
                        onHover={d => `There are ${d.length} MDs with a number of frames between ${Math.floor(d.x0)} and ${Math.floor(d.x1)}`}
                    />
                </div>}
                {atomsBinCount > 1 && <div className={style.histogram}>
                    <Histogram
                        data={atomsPayload && atomsPayload["metadata.SYSTATS"]}
                        xAxisLabelText={'Atoms'}
                        yAxisLabelText={'Projects'}
                        color={secondaryColor}
                        binMethod={'sturges'}
                        onHover={d => `There are ${d.length} MDs with a number of atoms between ${Math.floor(d.x0)} and ${Math.floor(d.x1)}`}
                    />
                </div>}
                {mdsBinCount > 1 && <div className={style.histogram}>
                    <Histogram
                        data={mdCountPayload && mdCountPayload["mdcount"]}
                        xAxisLabelText={'MDs'}
                        yAxisLabelText={'Projects'}
                        color={primaryColor}
                        binMethod={'linear'}
                        binCount={mdCountPayload && mdCountPayload["mdcount"]
                            ? Math.max(...Object.keys(mdCountPayload["mdcount"]).map(Number))
                            : 10}
                        onHover={d => `There are ${d.length} MDs with a number of MDs between ${Math.floor(d.x0)} and ${Math.floor(d.x1)}`}
                    />
                </div>}
            </div>
        </>}
        {showTimeDistribution && <>
            <Typography variant="h5">Time distribution</Typography>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 10%' }}>
                <FramestepPlot jsonUrl={framestepUrl} onPoints={setFramestepPoints} />
            </div>
        </>}
    </>);
};

export default DataSummary;
