import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, ButtonGroup, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { buildReturn, stringifyQuery } from '../../utils/filters';

import { BASE_PATH_PROJECTS, BASE_VERSIONED_PATH, HOST_CONFIG } from '../../utils/constants';
import { buildReturnQuery, createPalette, formatBytes } from '../../utils/auxiliar-functions';
import useAPI from '../../hooks/use-api';
import useBatchAPI from '../../hooks/use-batch-api';

import PieChart from '../pie-chart';
import Histogram from '../histogram';
import SimpleHistogram from '../simple-histogram';
import TimelineChart from './timeline';
import FramestepPlot from './framestep';
import Info from '../info';
import Card from './card';

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
// Warnings are excluded since only some projects have them: a single kind of warning is not a constant
const CONSTANTS_HIDDEN_FIELDS = new Set([
    'metadata.AUTHORS', 'metadata.COLLECTIONS', 'published', 'metadata.GROUPS',
    'metadata.WARNINGS.tag', 'mds.warnings.tag',
]);

import style from './style.module.css';

const FEDERATED_STATS_TIMEOUT = 15000;

const formatFieldValue = value => value.charAt(0).toUpperCase() + value.slice(1);

const formatNodeDisplayName = (nodeAlias, nodeNameMap) => nodeNameMap[nodeAlias] || nodeAlias;

// What a histogram column counts, e.g. "1 project" or "3,481 projects"
const countProjects = count => `${count.toLocaleString()} project${count === 1 ? '' : 's'}`;

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
 * @param {string[]|null} internalFilters - Optional list of API filters to restrict
 *   the statistics to a subset of projects (e.g. `['collection=="col123"']`).
 *   When omitted the global summary is shown.
 * @param {string} [title='Data summary'] - Section heading text.
 */
const DataSummary = ({ internalFilters = null, title = 'Data summary', nodeData = null }) => {
    // Get the provided theme
    const theme = useTheme();
    const primaryColor = theme.palette.primary.main;
    const secondaryColor = theme.palette.secondary.dark;
    const isGlobalSummary = HOST_CONFIG.global && !internalFilters;

    // Helper to build the leading query string fragment for URLs
    const filtersQuery = internalFilters
        ? stringifyQuery({ filter: internalFilters })
        : '';
    const queryPrefix = filtersQuery ? `${filtersQuery}&` : '';

    // Use the API to get the summary
    const summaryQueryParam = filtersQuery ? `?${filtersQuery}` : '';
    const summaryUrl = `${BASE_PATH_PROJECTS}/summary${summaryQueryParam}`;
    const { payload: summaryPayload, error: summaryError } = useAPI(summaryUrl, { name: 'summary', cacheOn: true });
    // Use the API to get the options
    // Reuse return query logic from custom-search
    const availableFields = HOST_CONFIG.availableFields;
    const queryFields = HOST_CONFIG.queryFields;
    const returnQuery = buildReturnQuery(availableFields);
    const optionsUrl = `${BASE_PATH_PROJECTS}/options?${queryPrefix}${returnQuery}&countMds=true`;
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
            if (internalFilters && variableOptionsFields.includes('metadata.METHOD')) {
                setSelectedOptionsField('metadata.METHOD');
            } else if (!internalFilters && variableOptionsFields.includes('node')) {
                setSelectedOptionsField('node');
            } else if (!internalFilters && variableOptionsFields.includes('metadata.COLLECTIONS')) {
                setSelectedOptionsField('metadata.COLLECTIONS');
            } else {
                setSelectedOptionsField(variableOptionsFields[0]);
            }
        }
    }, [variableOptionsFields, internalFilters, selectedOptionsField]);

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
    const federatedNodeUrls = useMemo(() => {
        if (!isGlobalSummary || !Array.isArray(nodeData) || nodeData.length === 0) return [];
        return nodeData
            .map(node => node?.api_url)
            .filter(Boolean);
    }, [isGlobalSummary, nodeData]);

    const federatedStatsUrls = useMemo(
        () => federatedNodeUrls.map(apiUrl => `${apiUrl}rest/current/stats`),
        [federatedNodeUrls],
    );

    const batchStatsResponses = useBatchAPI(federatedStatsUrls, 'json', FEDERATED_STATS_TIMEOUT);

    // The global API may not expose /projects/summary. Query the federated nodes
    // as a fallback so the summary can still show the data that is available.
    const federatedSummaryUrls = useMemo(() => {
        return federatedNodeUrls.map(apiUrl => `${apiUrl}rest/current/projects/summary`);
    }, [federatedNodeUrls]);

    const batchSummaryResponses = useBatchAPI(federatedSummaryUrls, 'json', FEDERATED_STATS_TIMEOUT);

    const { displaySummaryPayload, summaryCoverage } = useMemo(() => {
        if (!isGlobalSummary || summaryPayload)
            return { displaySummaryPayload: summaryPayload, summaryCoverage: null };

        const currentBatchSummaryResponses = batchSummaryResponses
            .filter(response => federatedSummaryUrls.includes(response.url));
        const successfulPayloads = currentBatchSummaryResponses
            .filter(response => !response.loading && !response.error && response.payload)
            .map(response => response.payload);

        if (successfulPayloads.length === 0)
            return { displaySummaryPayload: null, summaryCoverage: null };

        const sumField = field => successfulPayloads.reduce((total, payload) => {
            const value = Number(payload?.[field]);
            return total + (Number.isFinite(value) ? value : 0);
        }, 0);

        return {
            displaySummaryPayload: {
                projectsCount: sumField('projectsCount'),
                mdCount: sumField('mdCount'),
                totalTime: sumField('totalTime'),
                totalFrames: sumField('totalFrames'),
                totalFiles: sumField('totalFiles'),
                totalAnalyses: sumField('totalAnalyses'),
            },
            summaryCoverage: {
                available: successfulPayloads.length,
                total: federatedSummaryUrls.length,
            },
        };
    }, [isGlobalSummary, summaryPayload, federatedSummaryUrls, batchSummaryResponses]);

    const { bsPayload, bsError, bsLoading } = useMemo(() => {
        if (!isGlobalSummary)
            return { bsPayload: null, bsError: null, bsLoading: false, };
        if (federatedStatsUrls.length === 0)
            return { bsPayload: null, bsError: null, bsLoading: true, };

        // Match responses to the current URLs because useBatchAPI reuses responses
        // for URLs that were already requested.
        const currentBatchStatsResponses = batchStatsResponses
            .filter(response => federatedStatsUrls.includes(response.url));
        const isLoading = currentBatchStatsResponses.length !== federatedStatsUrls.length
            || currentBatchStatsResponses.some(response => response.loading);

        const successfulPayloads = currentBatchStatsResponses
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

        const firstError = currentBatchStatsResponses.find(response => response.error)?.error;
        return {
            bsPayload: null,
            bsError: firstError || new Error('Unable to retrieve stats from any node'),
            bsLoading: false,
        };
    }, [isGlobalSummary, federatedStatsUrls, batchStatsResponses]);

    // Use the API to get the project growth data (global only — not meaningful for subsets)
    const growthUrl = !internalFilters ? `${BASE_PATH_PROJECTS}/summary/growth` : null;
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
        // Cycle through the colors array in steps of 15% of its length
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
            label: `${displayLabel(key)}: ${value.toLocaleString()} (${(100 * value / divisor).toFixed(1)}%)`,
            color: colors[i],
        }));
        return { optionPieChartData, optionLegendData };
    }, [getOptionCount, nodeNameMap, optionsPayload, selectedOptionsField, selectedStatsIndex]);

    // Use the API to get the snapshots options
    const snapshotsUrl = `${BASE_PATH_PROJECTS}/options?${queryPrefix}${buildReturn(['mds.frames'])}`;
    const { payload: snapshotsPayload, error: snapshotsError } = useAPI(snapshotsUrl);

    // Build the snapshots component
    // If snapshots data is not yet downloaded then show an empty plot
    const frameCounts = useMemo(
        () => (snapshotsPayload ? snapshotsPayload['mds.frames'] : {}), [snapshotsPayload]);

    // Use the API to get the atoms options
    const atomsUrl = `${BASE_PATH_PROJECTS}/options?${queryPrefix}${buildReturn(['metadata.SYSTATS'])}`;
    const { payload: atomsPayload, error: atomsError } = useAPI(atomsUrl);

    // Use the API to get the number of MDs per project
    const mdCountUrl = `${BASE_PATH_PROJECTS}/options?${queryPrefix}${buildReturn(['mdcount'])}`;
    const { payload: mdCountPayload, error: mdCountError } = useAPI(mdCountUrl);

    const framesBinCount = Object.keys(frameCounts).length;
    const atomsBinCount = Object.keys(atomsPayload?.["metadata.SYSTATS"] ?? {}).length;
    const mdsBinCount = Object.keys(mdCountPayload?.["mdcount"] ?? {}).length;
    const histogramCount = [framesBinCount, atomsBinCount, mdsBinCount]
        .filter(binCount => binCount > 1).length;

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
    const errorMap = { summaryError, optionsError, snapshotsError, atomsError, mdCountError, growthError, statsError, bsError };
    Object.entries(errorMap).forEach(([name, error]) => {
        if (error) console.error(`${name}:`, error.message);
    });

    const dataSizeValue = useMemo(() => {
        if (!isGlobalSummary && statsError) return 'Unavailable';
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
    }, [isGlobalSummary, nodeData, statsPayload, statsError, bsPayload, bsLoading, bsError]);
    const summaryUnavailableValue = summaryError ? 'Unavailable' : 'Loading...';
    const dataSizeTooltip = (<>
        This size accounts only for the processed files stored in the database.
        <br />
        <br />
        The raw simulation data is usually 10 to 50 times bigger, mostly because
        water is removed from most trajectories during processing.
    </>);

    // Headline numbers: every total with its unit and a note that puts it in context
    // Totals of a million or more are shortened (11,396,340 -> 11.4 M) and show the exact value on hover
    const shorten = value => value >= 1e6
        ? { text: String(Number((value / 1e6).toPrecision(3))), unit: 'M', exact: value.toLocaleString() }
        : { text: value.toLocaleString() };
    const shortenTime = nanoseconds => {
        const microseconds = nanoseconds / 1000;
        const exact = `${Math.round(microseconds).toLocaleString()} μs`;
        return microseconds >= 1e4
            ? { text: String(Number((microseconds / 1000).toPrecision(3))), unit: 'ms', exact }
            : { text: Math.round(microseconds).toLocaleString(), unit: 'μs' };
    };
    const average = (value, count, unit) => count ? `${Math.round(value / count).toLocaleString()} ${unit}` : null;
    // The latest month with uploads (growth is not asked for a subset of projects)
    const lastGrowth = Array.isArray(growthPayload) && growthPayload.length > 0
        ? growthPayload[growthPayload.length - 1] : null;
    const lastGrowthMonth = lastGrowth && new Date(`${lastGrowth.date}-01T00:00`)
        .toLocaleString(undefined, { month: 'short', year: 'numeric' });
    const summaryTiles = [
        ['Projects', s => shorten(s.projectsCount),
            () => lastGrowth && `+${lastGrowth.newProjects.toLocaleString()} in ${lastGrowthMonth}`],
        ['MDs', s => shorten(s.mdCount),
            s => s.projectsCount ? `${(s.mdCount / s.projectsCount).toFixed(1)} per project` : null],
        ['Simulated time', s => shortenTime(s.totalTime), s => average(s.totalTime, s.mdCount, 'ns per MD')],
        ['Frames', s => shorten(s.totalFrames), s => average(s.totalFrames, s.mdCount, 'per MD')],
        ['Files', s => shorten(s.totalFiles), s => average(s.totalFiles, s.projectsCount, 'per project')],
        ['Analyses', s => shorten(s.totalAnalyses), s => average(s.totalAnalyses, s.mdCount, 'per MD')],
    ].map(([label, value, note]) => displaySummaryPayload
        ? { label, ...value(displaySummaryPayload), note: note(displaySummaryPayload) }
        : { label, placeholder: summaryUnavailableValue });
    // The data size is already formatted as "<number> <unit>", or as a single word while there is none
    const [dataSizeText, dataSizeUnit] = dataSizeValue.split(' ');
    summaryTiles.push({
        label: 'Data',
        info: true,
        text: dataSizeUnit && dataSizeText,
        unit: dataSizeUnit,
        placeholder: dataSizeValue,
        note: dataSizeUnit && (bsPayload
            ? `From ${bsPayload.nodeCount} of ${bsPayload.totalNodes} nodes`
            : 'Processed files only'),
    });

    return (<div className={style.root}>
        <div>
            <Typography variant="h5" sx={{ fontSize: 'var(--text-lg)', lineHeight: '1.75rem', marginBottom: 'var(--space-3)' }}>
                {title}
                {summaryCoverage && summaryCoverage.available < summaryCoverage.total && (
                    <Typography component="span" variant="body2">
                        {' '}(based on {summaryCoverage.available}/{summaryCoverage.total} nodes)
                    </Typography>
                )}
            </Typography>
            <dl className={style.tiles}>
                {summaryTiles.map(({ label, text, unit, exact, note, placeholder, info }) => (
                    <div key={label} className={style.tile}>
                        <dt className={style.tileLabel}>
                            {label}
                            {info && <Info tooltip={dataSizeTooltip} className={style.info} />}
                        </dt>
                        {text
                            ? <dd className={style.tileValue} title={exact}>{text}{unit && <small> {unit}</small>}</dd>
                            : <dd className={style.tilePending}>{placeholder}</dd>}
                        <dd className={style.tileNote}>{note}</dd>
                    </div>
                ))}
            </dl>
        </div>
        {!internalFilters && <Card title="Data growth over time" subtitle="Cumulative projects and MDs by upload date">
            <div className={style.timelineChart}>
                {growthPayload ? (
                    <TimelineChart data={growthPayload} />
                ) : (
                    growthError ? 'Growth data is not available' : 'Loading growth data...'
                )}
            </div>
        </Card>}
        {(() => {
            const formatVal = (field, key) => field === 'node'
                ? formatNodeDisplayName(key, nodeNameMap)
                : formatFieldValue(key);
            // A field with a single value is a constant only when every project has that value
            const projectsCount = displaySummaryPayload?.projectsCount;
            const coversEveryProject = ({ field, entries }) => {
                const count = optionsPayload[field][entries[0][0]];
                return (Array.isArray(count) ? count[0] : count) === projectsCount;
            };
            const allConstantItems = [
                ...constantFields.filter(({ field }) => !CONSTANTS_HIDDEN_FIELDS.has(field))
                    .filter(coversEveryProject)
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
                <Card title="Constant fields">
                    <div className={style.constantsGrid}>
                        {allConstantItems.map(({ key, displayName, displayValue }) => (
                            <div key={key} className={style.constantItem}>
                                <span className={style.constantLabel}>{displayName}</span>
                                <span className={style.constantValue}>{displayValue}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            );
        })()}
        {(availableOptionsFields.length === 0 || variableOptionsFields.length > 0) && (
        <Card
            title="Statistics per field"
            subtitle={`${selectedStatsMode === 'mds' ? 'MDs' : 'Projects'} per value of the selected field`}
        >
            {availableOptionsFields.length === 0 ? (
                <div style={{ textAlign: 'center' }}>
                    {optionsError ? 'Field data is not available' : 'Loading field data...'}
                </div>
            ) : (
                <>{variableOptionsFields.length > 0 && (<>
                    <div className={style.fieldControls}>
                        <select
                            id="options-field-select"
                            className={style.fieldSelect}
                            value={selectedOptionsField || ''}
                            onChange={e => setSelectedOptionsField(e.target.value)}
                        >
                            {variableOptionsFields.map(field => {
                                const fieldObj = findFieldByTitleOrLabel(queryFields, field);
                                const optionCount = Object.keys(optionsPayload[field] || {})
                                    .filter(key => key !== 'null').length;
                                return (
                                    <option key={field} value={field}>
                                        {fieldObj
                                            ? `${fieldObj.name} (${fieldObj.category}) - ${optionCount}`
                                            : `${field} - ${optionCount}`}
                                    </option>
                                );
                            })}
                        </select>
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
                    {optionPieChartData && optionLegendData && optionLegendData.length > 0 && (
                        PIE_CHART_FIELDS.has(selectedOptionsField)
                            ? <PieChart
                                data={optionPieChartData}
                                legendData={optionLegendData}
                                autoHide={true}
                                className={style.pie}
                                pieClassName={style.pieChart}
                                legendClassName={style.pieLegend}
                            />
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
        </Card>
        )}
        {(framesBinCount > 1 || atomsBinCount > 1 || mdsBinCount > 1) && (
            <div
                className={style.histograms}
                style={{ gridTemplateColumns: `repeat(${histogramCount}, minmax(0, 1fr))` }}
            >
                {framesBinCount > 1 && <Card className={style.histogram} title="Frames per MD" subtitle="Number of projects">
                    <Histogram
                        data={frameCounts}
                        xAxisLabelText={'Frames'}
                        color={primaryColor}
                        binMethod={'sturges'}
                        onHover={d => `${countProjects(d.length)} with MDs of ${Math.floor(d.x0).toLocaleString()} to ${Math.floor(d.x1).toLocaleString()} frames`}
                    />
                </Card>}
                {atomsBinCount > 1 && <Card className={style.histogram} title="Atoms per system" subtitle="Number of projects">
                    <Histogram
                        data={atomsPayload && atomsPayload["metadata.SYSTATS"]}
                        xAxisLabelText={'Atoms'}
                        color={secondaryColor}
                        binMethod={'sturges'}
                        onHover={d => `${countProjects(d.length)} with ${Math.floor(d.x0).toLocaleString()} to ${Math.floor(d.x1).toLocaleString()} atoms`}
                    />
                </Card>}
                {mdsBinCount > 1 && <Card className={style.histogram} title="MDs per project" subtitle="Number of projects">
                    <Histogram
                        data={mdCountPayload && mdCountPayload["mdcount"]}
                        xAxisLabelText={'MDs'}
                        color={primaryColor}
                        binMethod={'linear'}
                        binCount={mdCountPayload && mdCountPayload["mdcount"]
                            ? Math.max(...Object.keys(mdCountPayload["mdcount"]).map(Number))
                            : 10}
                        onHover={d => `${countProjects(d.length)} with ${d.x0} MD${d.x0 === 1 ? '' : 's'}`}
                    />
                </Card>}
            </div>
        )}
        {showTimeDistribution && (
            <Card title="Time distribution" subtitle="MDs by total simulated time and number of frames">
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <FramestepPlot jsonUrl={framestepUrl} onPoints={setFramestepPoints} />
                </div>
            </Card>
        )}
    </div>);
};

export default DataSummary;
