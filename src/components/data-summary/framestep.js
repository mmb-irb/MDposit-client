import React, { useRef, useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useTheme, useColorScheme } from '@mui/material/styles';
import { isFromApi, NOT_FROM_API, NO_API_RESPONSE } from '../../utils/api-response';
import createChartTooltip from '../../utils/chart-tooltip';

// ─── Layout ───────────────────────────────────────────────────────────────────
// The margins hold text, which keeps its size, so they are fixed
const ML = 80, MB = 65, MT = 12, MR = 14;
const CBAR_W = 18, CBAR_LABELS_W = 60;
const GAP_T = 6, GAP_R = 15, GAP_CBAR = 28;
const FIXED_W = ML + GAP_R + GAP_CBAR + CBAR_W + CBAR_LABELS_W + MR;
// The plots have these sizes when there is room, and shrink together in a narrower container
const FULL_MAIN_W = 600, FULL_MAIN_H = 520, FULL_TOP_H = 100, FULL_RIGHT_W = 80;
// The histograms keep at least the room of their axis numbers
const MIN_TOP_H = 48, MIN_RIGHT_W = 56;
// The main plot keeps at least this share of its full size
// In a container too narrow for that the whole chart is scaled down, text included
const MIN_MAIN_SCALE = 0.35;
const MAX_W = FIXED_W + FULL_MAIN_W + FULL_RIGHT_W;
const MIN_W = FIXED_W + FULL_MAIN_W * MIN_MAIN_SCALE + MIN_RIGHT_W;

// The size of every part of the chart in a container of the given width
function getLayout(containerWidth) {
    const SVG_W = Math.min(MAX_W, Math.max(MIN_W, containerWidth));
    let scale = (SVG_W - FIXED_W) / (FULL_MAIN_W + FULL_RIGHT_W);
    let RIGHT_W = FULL_RIGHT_W * scale;
    if (RIGHT_W < MIN_RIGHT_W) {
        RIGHT_W = MIN_RIGHT_W;
        scale = (SVG_W - FIXED_W - RIGHT_W) / FULL_MAIN_W;
    }
    const MAIN_W = FULL_MAIN_W * scale;
    const MAIN_H = FULL_MAIN_H * scale;
    const TOP_H = Math.max(MIN_TOP_H, FULL_TOP_H * scale);
    const SVG_H = MT + TOP_H + GAP_T + MAIN_H + MB;
    return { MAIN_W, MAIN_H, TOP_H, RIGHT_W, SVG_W, SVG_H };
}

const N_GRID  = 200;   // KDE grid resolution (matches Python)
const N_LEVELS = 8;    // Number of contour levels (matches Python)
// Above 1 the density color starts later: the low levels stay close to white
const DENSITY_COLOR_CURVE = 2;
const BW_METHOD = 0.9; // Bandwidth factor (tuned to match Python contour spread)

// Constant FRAMESTEP isolines (ns)
const FRAMESTEP_LINES = [
    [100,   '100 ns'],
    [10,    '10 ns'],
    [1,     '1 ns'],
    [0.1,   '0.1 ns'],
    [0.01,  '0.01 ns'],
    [0.001, '0.001 ns'],
];

const axisNumbersFontSize = "12px";
const axisLabelsFontSize = "14px";
// Padding for the axis to add to the min/max
const DOMAIN_PAD_DECADES = 0.5;

// ─── Data processing ──────────────────────────────────────────────────────────
function processData(raw) {
    const pts = [];
    for (const entry of raw) {
        const framestep = entry.metadata?.FRAMESTEP;
        if (framestep == null) continue;
        for (const md of (entry.mds ?? [])) {
            const f = md.frames;
            if (f == null) continue;
            pts.push([framestep * f, f, framestep]); // [total_time_ns, frames, framestep_ns]
        }
    }
    // Cut at 1e7 frames; drop degenerate points
    return pts.filter(([t, f]) => f <= 1e7 && t > 0 && f > 0);
}

// ─── Log-spaced histogram bins ────────────────────────────────────────────────
function makeLogBins(values, minLog, maxLog, n) {
    let loLog = minLog;
    let hiLog = maxLog;
    if (!(hiLog > loLog)) {
        // Degenerate case (e.g. all values equal): widen one decade around the value.
        loLog -= 0.5;
        hiLog += 0.5;
    }

    let step = (hiLog - loLog) / n;
    if (step < 0.01) {
        // to small bin cause subpixel rendering issues
        step = 0.01;
        n = Math.ceil((hiLog - loLog) / step);
    }
    const bins = Array.from({ length: n }, (_, i) => {
        const lo = 10 ** (loLog + i * step);
        const hi = 10 ** (loLog + (i + 1) * step);
        return { x0: lo, x1: hi, count: 0 };
    });

    for (const v of values) {
        if (!(v > 0)) continue;
        let idx = Math.floor((Math.log10(v) - loLog) / step);
        if (!Number.isFinite(idx)) continue;
        if (idx < 0) continue;
        if (idx >= n) idx = n - 1; // include exact max edge in last bin
        bins[idx].count++;
    }

    return bins;
}

function computeLogDomain(values, fallbackMin, fallbackMax) {
    if (!values.length) return [fallbackMin, fallbackMax];

    const minV = d3.min(values);
    const maxV = d3.max(values);
    if (!Number.isFinite(minV) || !Number.isFinite(maxV) || minV <= 0 || maxV <= 0) {
        return [fallbackMin, fallbackMax];
    }

    let minLog = Math.log10(minV);
    let maxLog = Math.log10(maxV);

    if (minLog === maxLog) {
        minLog -= 0.5;
        maxLog += 0.5;
    } else {
        minLog -= DOMAIN_PAD_DECADES;
        maxLog += DOMAIN_PAD_DECADES;
    }

    return [10 ** minLog, 10 ** maxLog];
}

function majorLogTicks(minV, maxV) {
    const start = Math.floor(Math.log10(minV));
    const end = Math.ceil(Math.log10(maxV));
    return d3.range(start, end + 1)
        .map(e => 10 ** e)
        .filter(v => v >= minV && v <= maxV);
}

function minorLogTicks(minV, maxV) {
    const start = Math.floor(Math.log10(minV));
    const end = Math.ceil(Math.log10(maxV));
    const ticks = [];
    for (let e = start; e <= end; e++) {
        for (let m = 2; m <= 9; m++) {
            const v = m * 10 ** e;
            if (v >= minV && v <= maxV) ticks.push(v);
        }
    }
    return ticks;
}

// ─── 2D Gaussian KDE in log10 space ───────────────────────────────────────────
// Matches scipy.stats.gaussian_kde with bw_method=0.2, evaluated on a grid and
// multiplied by N to give "expected MDs per (log10 unit)²".
// Returns a flat array of length nGrid*nGrid in row-major order, representing
// the KDE evaluated at the center of each grid cell.
function computeKDE(logPts, nGrid, xMin, xMax, yMin, yMax) {
    const N = logPts.length;
    const dx = (xMax - xMin) / nGrid;
    const dy = (yMax - yMin) / nGrid;

    // Per-dimension std (population)
    const meanX = logPts.reduce((s, p) => s + p[0], 0) / N;
    const meanY = logPts.reduce((s, p) => s + p[1], 0) / N;
    const stdX = Math.sqrt(logPts.reduce((s, p) => s + (p[0] - meanX) ** 2, 0) / N);
    const stdY = Math.sqrt(logPts.reduce((s, p) => s + (p[1] - meanY) ** 2, 0) / N);

    // Bandwidth matching scipy gaussian_kde: h = bw_method * N^{-1/(d+4)} * std
    const scottFactor = Math.pow(N, -1 / 6); // d=2 → 1/(d+4)=1/6
    const sigmaX_log = BW_METHOD * scottFactor * stdX; // in log10 units
    const sigmaY_log = BW_METHOD * scottFactor * stdY;
    const sigmaX = sigmaX_log / dx; // in grid cells
    const sigmaY = sigmaY_log / dy;

    // Bin data onto grid
    const grid = new Float64Array(nGrid * nGrid);
    for (const [lx, ly] of logPts) {
        const ix = Math.floor((lx - xMin) / dx);
        const iy = Math.floor((ly - yMin) / dy);
        if (ix >= 0 && ix < nGrid && iy >= 0 && iy < nGrid) {
            grid[iy * nGrid + ix]++;
        }
    }

    // Separable Gaussian blur
    function makeKernel(sigma) {
        const r = Math.ceil(3.5 * sigma);
        const k = [];
        let sum = 0;
        for (let i = -r; i <= r; i++) {
            const v = Math.exp(-0.5 * (i / sigma) ** 2);
            k.push(v);
            sum += v;
        }
        return { kernel: k.map(v => v / sum), radius: r };
    }

    const kx = makeKernel(sigmaX);
    const ky = makeKernel(sigmaY);

    // Blur horizontally
    const temp = new Float64Array(nGrid * nGrid);
    for (let j = 0; j < nGrid; j++) {
        for (let i = 0; i < nGrid; i++) {
            let sum = 0;
            for (let di = -kx.radius; di <= kx.radius; di++) {
                const ii = Math.min(nGrid - 1, Math.max(0, i + di));
                sum += grid[j * nGrid + ii] * kx.kernel[di + kx.radius];
            }
            temp[j * nGrid + i] = sum;
        }
    }

    // Blur vertically
    const blurred = new Float64Array(nGrid * nGrid);
    for (let j = 0; j < nGrid; j++) {
        for (let i = 0; i < nGrid; i++) {
            let sum = 0;
            for (let dj = -ky.radius; dj <= ky.radius; dj++) {
                const jj = Math.min(nGrid - 1, Math.max(0, j + dj));
                sum += temp[jj * nGrid + i] * ky.kernel[dj + ky.radius];
            }
            blurred[j * nGrid + i] = sum;
        }
    }

    // Normalize to "MDs per (log10 unit)²"  (≡ Python's kde * N)
    for (let k = 0; k < blurred.length; k++) blurred[k] /= (dx * dy);
    return blurred;
}

// ─── Transform contour coordinates from grid space to pixel space ─────────────
function transformContourCoords(contour, xMin, yMin, dx, dy, xSc, ySc) {
    return {
        type: contour.type,
        value: contour.value,
        coordinates: contour.coordinates.map(polygon =>
            polygon.map(ring =>
                ring.map(([gi, gj]) => {
                    const logX = xMin + gi * dx;
                    const logY = yMin + gj * dy;
                    return [xSc(10 ** logX), ySc(10 ** logY)];
                })
            )
        ),
    };
}

function contourBBox(contour) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const polygon of contour.coordinates) {
        for (const ring of polygon) {
            for (const [x, y] of ring) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }

    return { minX, minY, maxX, maxY };
}

function contourContainsPoint(contour, point) {
    for (const polygon of contour.coordinates) {
        const outer = polygon[0];
        if (!outer || !d3.polygonContains(outer, point)) continue;

        let inHole = false;
        for (let i = 1; i < polygon.length; i++) {
            if (d3.polygonContains(polygon[i], point)) {
                inHole = true;
                break;
            }
        }

        if (!inHole) return true;
    }

    return false;
}

function countPointsInContour(contour, projectedPoints) {
    const bbox = contour._bbox ?? (contour._bbox = contourBBox(contour));
    let count = 0;

    for (const p of projectedPoints) {
        const [x, y] = p;
        if (x < bbox.minX || x > bbox.maxX || y < bbox.minY || y > bbox.maxY) continue;
        if (contourContainsPoint(contour, p)) count++;
    }

    return count;
}

function drawScatterCanvas(canvasEl, points, xSc, ySc, mainWidth, mainHeight, alphaWeight, color) {
    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = Math.max(1, Math.round(mainWidth * dpr));
    canvasEl.height = Math.max(1, Math.round(mainHeight * dpr));

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, mainWidth, mainHeight);
    const { r, g, b } = d3.rgb(color);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alphaWeight / points.length})`;

    const radius = 2.5;
    for (const [t, f] of points) {
        const x = xSc(t);
        const y = ySc(f);
        if (x < -radius || x > mainWidth + radius || y < -radius || y > mainHeight + radius) continue;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ─── D3 chart renderer ────────────────────────────────────────────────────────
// Counts are shortened as in the histograms of the page: 1k, 20k, 1M
const fmtCount = d3.format('~s');

// A time in ns with the unit that fits it: 0.01 ns, 100 ns, 10 μs, 1 ms
function fmtTime(ns) {
    const [value, unit] = ns >= 1e6 ? [ns / 1e6, 'ms'] : ns >= 1e3 ? [ns / 1e3, 'μs'] : [ns, 'ns'];
    return `${d3.format('.3~g')(value)} ${unit}`;
}

// Labels a tick with the given format, only when it is an exact power of 10 (not 2e-3 or 5e6)
function fmtPow10(v, format) {
    const exp = Math.floor(Math.log10(v));
    const base = v / (10 ** exp);
    return base === 1 ? format(v) : '';
}

// layout: the sizes from getLayout
// colors: the theme colors, as { main, dark }
function drawChart(el, canvasEl, points, layout, colors) {
    const { MAIN_W, MAIN_H, TOP_H, RIGHT_W, SVG_W, SVG_H } = layout;
    const svg = d3.select(el).attr('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
    svg.selectAll('*').remove();

    const tooltip = createChartTooltip();

    const ox = ML, oy = MT + TOP_H + GAP_T;

    const [xMin, xMax] = computeLogDomain(points.map(d => d[0]), 8e-3, 1e6);
    let [yMin, yMax] = computeLogDomain(points.map(d => d[1]), 2e-1, 5e6);
    yMin = Math.max(yMin, 1); // ensure we show the region around 1 frame
    const xMajorTicks = majorLogTicks(xMin, xMax);
    const yMajorTicks = majorLogTicks(yMin, yMax);
    const xMinorTicks = minorLogTicks(xMin, xMax);
    const yMinorTicks = minorLogTicks(yMin, yMax);

    // Scales
    const xSc = d3.scaleLog().domain([xMin, xMax]).range([0, MAIN_W]);
    const ySc = d3.scaleLog().domain([yMin, yMax]).range([MAIN_H, 0]);
    const projectedPoints = points.map(([t, f]) => [xSc(t), ySc(f)]);

    // Clip path
    svg.append('defs').append('clipPath').attr('id', 'fsClip')
        .append('rect').attr('width', MAIN_W).attr('height', MAIN_H);

    // ── Main plot group ───────────────────────────────────────────────────────
    const gMain = svg.append('g').attr('transform', `translate(${ox},${oy})`);
    gMain.append('rect').attr('width', MAIN_W).attr('height', MAIN_H).attr('fill', 'none');
    const gPlot = gMain.append('g').attr('clip-path', 'url(#fsClip)');

    // Major grid
    xMajorTicks.forEach(v =>
        gPlot.append('line')
            .attr('x1', xSc(v)).attr('x2', xSc(v)).attr('y1', 0).attr('y2', MAIN_H)
            .attr('stroke', 'var(--mui-palette-text-secondary)').attr('stroke-opacity', 0.45).attr('stroke-width', 0.8));
    yMajorTicks.forEach(v =>
        gPlot.append('line')
            .attr('x1', 0).attr('x2', MAIN_W).attr('y1', ySc(v)).attr('y2', ySc(v))
            .attr('stroke', 'var(--mui-palette-text-secondary)').attr('stroke-opacity', 0.45).attr('stroke-width', 0.8));

    // Minor grid
    xMinorTicks.forEach(v => {
        gPlot.append('line')
            .attr('x1', xSc(v)).attr('x2', xSc(v))
            .attr('y1', 0).attr('y2', MAIN_H)
            .attr('stroke', 'gray').attr('stroke-opacity', 0.35).attr('stroke-width', 0.4)
            .attr('stroke-dasharray', '2,2');
    });
    yMinorTicks.forEach(v => {
        gPlot.append('line')
            .attr('x1', 0).attr('x2', MAIN_W)
            .attr('y1', ySc(v)).attr('y2', ySc(v))
            .attr('stroke', 'gray').attr('stroke-opacity', 0.35).attr('stroke-width', 0.4)
            .attr('stroke-dasharray', '2,2');
    });

    // ── Isolines for constant FRAMESTEP ───────────────────────────────────────
    const tLog = d3.range(Math.log10(xMin) - 0.1, Math.log10(xMax) + 0.11, 0.02);
    FRAMESTEP_LINES.forEach(([dt, lbl]) => {
        const lineData = tLog
            .map(le => [10 ** le, 10 ** le / dt])
            .filter(([t, f]) => t >= xMin && t <= xMax && f >= yMin && f <= yMax);
        if (!lineData.length) return;

        gPlot.append('path').datum(lineData)
            .attr('d', d3.line().x(d => xSc(d[0])).y(d => ySc(d[1])))
            .attr('stroke', 'gray').attr('stroke-dasharray', '5,3')
            .attr('stroke-width', 1).attr('fill', 'none').attr('opacity', 0.55);
        // Compute the visual angle of the isoline for label rotation
        // In log-log, slope=1 → angle = atan(pixelsPerLogY / pixelsPerLogX)
        const logXRange = Math.log10(xMax) - Math.log10(xMin);
        const logYRange = Math.log10(yMax) - Math.log10(yMin);
        const pxPerLogX = MAIN_W / logXRange;
        const pxPerLogY = MAIN_H / logYRange;
        const angleDeg = -Math.atan(pxPerLogY / pxPerLogX) * (180 / Math.PI);
        let lt = 10 ** (Math.log10(xMin) + 0.15 * (Math.log10(xMax) - Math.log10(xMin)));
        let lf = lt / dt;
        if (lf < yMin) {
            lf = yMin * 1.15;
            lt = lf * dt;
        }

        gPlot.append('text').text(`Δt=${lbl}`)
            .attr('x', xSc(lt)).attr('y', ySc(lf))
            .attr('transform', `rotate(${angleDeg}, ${xSc(lt)}, ${ySc(lf)})`)
            .attr('dx', 2).attr('dy', -4)
            .style('font-size', axisNumbersFontSize).attr('fill', 'var(--mui-palette-text-primary)').attr('opacity', 0.85);
    });

    // ── KDE density contours in log10 space (zorder 3) ────────────────────────
    // Compute KDE on log10 grid, matching Python's gaussian_kde(bw_method=0.2) * N
    const logPts = points.map(([t, f]) => [Math.log10(t), Math.log10(f)]);
    const kdeXMin = d3.min(logPts, d => d[0]) - DOMAIN_PAD_DECADES;
    const kdeXMax = d3.max(logPts, d => d[0]) + DOMAIN_PAD_DECADES;
    const kdeYMin = d3.min(logPts, d => d[1]) - DOMAIN_PAD_DECADES;
    const kdeYMax = 7.0;
    const kdeDx = (kdeXMax - kdeXMin) / N_GRID;
    const kdeDy = (kdeYMax - kdeYMin) / N_GRID;

    const freq = computeKDE(logPts, N_GRID, kdeXMin, kdeXMax, kdeYMin, kdeYMax);

    // Log-spaced contour levels from fMax * 10^{-2.5} to fMax (8 levels)
    const fMax = d3.max(freq);
    const logLo = Math.log10(fMax) - 2.5;
    const logHi = Math.log10(fMax);
    const levels = Array.from({ length: N_LEVELS }, (_, i) =>
        10 ** (logLo + i * (logHi - logLo) / (N_LEVELS - 1))
    );

    // Color mapping on a logarithmic density scale: from white to a deep shade of the main theme color
    // The curve keeps the low densities close to white, so the color only shows where MDs concentrate
    // The points and the histograms use the dark theme color, to stand apart from the density
    // The lowest density is the colour of the page cards (white in light mode), resolved since d3 can not interpolate CSS variables
    const paperColor = getComputedStyle(el).getPropertyValue('--mui-palette-background-paper').trim() || '#fff';
    const deepColor = d3.rgb(colors.main).darker(1.2);
    const densityColor = d3.scaleSequential(d3.interpolateRgbBasis([paperColor, colors.main, deepColor]))
        .domain([0, 1]);
    const getColor = v => densityColor(Math.max(0, (Math.log10(v) - logLo) / (logHi - logLo)) ** DENSITY_COLOR_CURVE);

    // Generate contours in grid coordinates, then transform to pixel space
    const contourGen = d3.contours().size([N_GRID, N_GRID]).thresholds(levels);
    const contourLevels = contourGen(freq)
        .filter(c => c.value >= levels[0])
        .map(c => transformContourCoords(c, kdeXMin, kdeYMin, kdeDx, kdeDy, xSc, ySc));
    const contours = contourLevels.flatMap(c =>
        c.coordinates.map(polygon => ({
            type: 'MultiPolygon',
            value: c.value,
            coordinates: [polygon],
        }))
    );

    // ── Scatter points (under contours) ──────────────────────────────────────
    const alphaWeight = 10 ** (logHi / 1.5); // mid-level density for alpha scaling
    drawScatterCanvas(canvasEl, points, xSc, ySc, MAIN_W, MAIN_H, alphaWeight, colors.dark);

    const fmtDensity = v => v >= 1 ? d3.format(',.0f')(v) : v.toFixed(1);

    // Shared tooltip helper.
    // Coordinates are measured against gPlot, whose local space is already the
    // plot area (gMain is translated by (ox, oy)), so no margin offset is needed.
    function showTooltip(customLines) {
        customLines = customLines || [];
        const [mx, my] = d3.mouse(gPlot.node());
        const textLines = [];

        if (mx >= 0 && mx <= MAIN_W && my >= 0 && my <= MAIN_H) {
            const timeNs = xSc.invert(mx);
            const frames = ySc.invert(my);
            textLines.push(`Time: ${fmtTime(timeNs)}`);
            textLines.push(`Frames: ${d3.format(',.0f')(frames)}`);
        }

        textLines.push(...customLines);


        tooltip.show(textLines.join('<br/>'), d3.event);
    }

    function moveTooltip() {
        tooltip.move(d3.event);
    }

    function showSimpleTooltip(text) {
        tooltip.show(text, d3.event);
    }

    // Transparent overlay for value display in empty areas
    // This is added BEFORE contours so contours can capture their own hover events
    gPlot.append('rect')
        .attr('class', 'value-overlay')
        .attr('width', MAIN_W)
        .attr('height', MAIN_H)
        .attr('fill', 'transparent')
        .style('pointer-events', 'visible')
        .on('mousemove', () => showTooltip([]))
        .on('mouseout', () => tooltip.hide());

    // Filled contours (alpha 0.2 so scatter dots show through)
    gPlot.selectAll('.cf').data(contours).enter().append('path')
        .attr('d', d3.geoPath())
        .attr('fill', d => getColor(d.value))
        .attr('fill-opacity', 0.2)
        .style('cursor', 'default')
        .on('mouseover', function(d) {
            d3.select(this).attr('fill-opacity', 0.55);
            if (d.pointCount == null) {
                d.pointCount = countPointsInContour(d, projectedPoints);
            }
        })
        .on('mousemove', function() {
            showTooltip(
                [`Density: ${fmtDensity(d3.select(this).datum().value)} MD/decade²`,
                `MDs in contour: ${d3.format(',.0f')(d3.select(this).datum().pointCount)}`
                ]);
        })
        .on('mouseout', function() {
            d3.select(this).attr('fill-opacity', 0.3);
            tooltip.hide();
        });
    // Contour edges (thin outlines, a bit darker than the fill of their level)
    gPlot.selectAll('.cl').data(contours).enter().append('path')
        .attr('d', d3.geoPath())
        .attr('fill', 'none')
        .attr('stroke', d => d3.rgb(getColor(d.value)).darker(0.7)).attr('stroke-width', 0.5).attr('stroke-opacity', 0.6);


    // ── Mean cross (zorder 5) ─────────────────────────────────────────────────
    // const meanX = 10 ** d3.mean(logPts, d => d[0]);
    // const meanY = 10 ** d3.mean(logPts, d => d[1]);
    // const [mx, my, cs] = [xSc(meanX), ySc(meanY), 7];
    // gPlot.append('line')
    //     .attr('x1', mx - cs).attr('x2', mx + cs).attr('y1', my).attr('y2', my)
    //     .attr('stroke', 'steelblue').attr('stroke-width', 2);
    // gPlot.append('line')
    //     .attr('x1', mx).attr('x2', mx).attr('y1', my - cs).attr('y2', my + cs)
    //     .attr('stroke', 'steelblue').attr('stroke-width', 2);

    // ── Axes ──────────────────────────────────────────────────────────────────
    gMain.append('g').attr('transform', `translate(0,${MAIN_H})`)
        .call(d3.axisBottom(xSc).ticks(MAIN_W < 300 ? 3 : 6).tickFormat(v => fmtPow10(v, fmtTime))).style('font-size', axisNumbersFontSize);
    gMain.append('g')
        .call(d3.axisLeft(ySc).ticks(6).tickFormat(v => fmtPow10(v, fmtCount))).style('font-size', axisNumbersFontSize);
    gMain.append('text').text('Total time')
        .attr('text-anchor', 'middle').attr('x', MAIN_W / 2).attr('y', MAIN_H + 52)
        .style('font-size', axisLabelsFontSize);
    gMain.append('text').text('Frames')
        .attr('text-anchor', 'middle')
        .attr('transform', `translate(-62,${MAIN_H / 2}) rotate(-90)`)
        .style('font-size', axisLabelsFontSize);

    // ── Top histogram (total time) ────────────────────────────────────────────
    const gHT = svg.append('g').attr('transform', `translate(${ox},${MT})`);
    const tVals = points.map(d => d[0]);
    const tBins = makeLogBins(tVals,
        d3.min(points, d => Math.log10(d[0])),
        d3.max(points, d => Math.log10(d[0])),
        50);
    const htYSc = d3.scaleLinear().domain([0, d3.max(tBins, b => b.count)]).range([TOP_H, 0]);
    // Grid lines for top histogram
    htYSc.ticks(3).forEach(v => {
        gHT.append('line')
            .attr('x1', 0).attr('x2', MAIN_W).attr('y1', htYSc(v)).attr('y2', htYSc(v))
            .attr('stroke', 'var(--mui-palette-text-secondary)').attr('stroke-opacity', 0.4).attr('stroke-width', 0.6);
    });
    tBins.forEach(({ x0, x1, count }) => {
        if (!count) return;
        gHT.append('rect')
            .attr('x', xSc(x0)).attr('width', Math.max(0, xSc(x1) - xSc(x0) - 0.5))
            .attr('y', htYSc(count)).attr('height', TOP_H - htYSc(count))
            .attr('fill', colors.dark).attr('fill-opacity', 0.75)
            .style('cursor', 'default')
            .on('mouseover', () => showSimpleTooltip(`Count: ${count.toLocaleString()}`))
            .on('mousemove', () => moveTooltip())
            .on('mouseout', () => tooltip.hide());
    });
    gHT.append('g').call(d3.axisLeft(htYSc).ticks(3).tickFormat(fmtCount)).style('font-size', axisNumbersFontSize);
    gHT.append('text').text('Count')
        .attr('text-anchor', 'middle')
        .attr('transform', `translate(-48,${TOP_H / 2}) rotate(-90)`)
        .style('font-size', axisNumbersFontSize);

    // ── Right histogram (frames) ──────────────────────────────────────────────
    const gHR = svg.append('g').attr('transform', `translate(${ox + MAIN_W + GAP_R},${oy})`);
    const fBins = makeLogBins(
        points.map(d => d[1]),
        d3.min(points, d => Math.log10(d[1])),
        7, // cut at 1e7
        50);
    const hrMax = d3.max(fBins, b => b.count);
    const hrXSc = d3.scaleLinear().domain([0, hrMax]).range([0, RIGHT_W]);
    // Grid lines for right histogram
    hrXSc.ticks(3).forEach(v => {
        gHR.append('line')
            .attr('x1', hrXSc(v)).attr('x2', hrXSc(v)).attr('y1', 0).attr('y2', MAIN_H)
            .attr('stroke', 'var(--mui-palette-text-secondary)').attr('stroke-opacity', 0.4).attr('stroke-width', 0.6);
    });
    fBins.forEach(({ x0, x1, count }) => {
        if (!count) return;
        gHR.append('rect')
            .attr('y', ySc(x1)).attr('height', Math.max(0, ySc(x0) - ySc(x1) - 0.5))
            .attr('x', 0).attr('width', hrXSc(count))
            .attr('fill', colors.dark).attr('fill-opacity', 0.75)
            .style('cursor', 'default')
            .on('mouseover', () => showSimpleTooltip(`Count: ${count.toLocaleString()}`))
            .on('mousemove', () => moveTooltip())
            .on('mouseout', () => tooltip.hide());
    });
    gHR.append('g').attr('transform', `translate(0,${MAIN_H})`)
        .call(d3.axisBottom(hrXSc).ticks(2).tickFormat(fmtCount)).style('font-size', axisNumbersFontSize);
    gHR.append('text').text('Count')
        .attr('text-anchor', 'middle').attr('x', RIGHT_W / 2).attr('y', MAIN_H + 42)
        .style('font-size', axisNumbersFontSize);

    // ── Colorbar ──────────────────────────────────────────────────────────────
    const gCbar = svg.append('g')
        .attr('transform', `translate(${ox + MAIN_W + GAP_R + RIGHT_W + GAP_CBAR},${oy})`);
    const nG = 120;
    const gradH = MAIN_H / nG;
    for (let i = 0; i < nG; i++) {
        const logV = logLo + (i / (nG - 1)) * (logHi - logLo);
        gCbar.append('rect')
            .attr('x', 0).attr('width', CBAR_W)
            .attr('y', MAIN_H - (i + 1) * gradH).attr('height', gradH + 0.5)
            .attr('fill', getColor(10 ** logV));
    }
    gCbar.append('rect').attr('width', CBAR_W).attr('height', MAIN_H)
        .attr('fill', 'none').attr('stroke', 'var(--mui-palette-divider)');
    const cbarSc = d3.scaleLog().domain([levels[0], levels[N_LEVELS - 1]]).range([MAIN_H, 0]);
    // Show all contour level values on the colorbar (matching Python)
    gCbar.append('g').attr('transform', `translate(${CBAR_W},0)`)
        .call(d3.axisRight(cbarSc)
            .tickValues(levels)
            .tickFormat(d3.format('.3~s')))
        .style('font-size', axisNumbersFontSize);
    // Label: "MDs per decade²"
    const cbarLabelX = CBAR_W + 64;
    gCbar.append('text').text('MDs per decade²')
        .attr('text-anchor', 'middle')
        .attr('transform', `translate(${cbarLabelX},${MAIN_H / 2}) rotate(-90)`)
        .style('font-size', axisLabelsFontSize);

    // The tooltip is to be removed when the chart is drawn again or gone
    return tooltip.remove;
}

// ─── React component ──────────────────────────────────────────────────────────
// Data is fetched from jsonUrl.
const FramestepPlot = ({ jsonUrl, onPoints }) => {
    const svgRef = useRef(null);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [points, setPoints] = useState(null);
    const [error, setError] = useState(null);
    const [width, setWidth] = useState(MAX_W);
    const layout = useMemo(() => getLayout(width), [width]);
    const onPointsRef = useRef(onPoints);
    useEffect(() => { onPointsRef.current = onPoints; });
    // Get the provided theme
    const theme = useTheme();
    const mainColor = theme.palette.primary.main;
    // The points are drawn with the dark colour, which in dark mode would vanish against the background
    const { mode } = useColorScheme();
    const darkColor = mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark;

    // Track the container width, which sets the size of the plots
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            const w = entries[0].contentRect.width;
            if (w > 0) setWidth(w);
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        fetch(jsonUrl)
            // Network errors (e.g. the node is down) have no response at all
            .catch(error => { throw new Error(`${error.message} (${NO_API_RESPONSE})`); })
            .then(r => {
                if (r.ok) return r.json();
                const origin = isFromApi(r.headers) ? '' : ` (${NOT_FROM_API})`;
                throw new Error(`HTTP ${r.status} while fetching framestep data${origin}`);
            })
            .then(raw => {
                const pts = processData(raw);
                setPoints(pts);
                onPointsRef.current?.(pts);
            })
            .catch(err => {
                setError(err.message);
                // Report no points, so whoever shows this plot can hide its block
                onPointsRef.current?.([]);
            });
    }, [jsonUrl]);

    useEffect(() => {
        if (points && svgRef.current) {
            // Drawing returns how to remove the tooltip of the chart
            return drawChart(svgRef.current, canvasRef.current, points, layout, { main: mainColor, dark: darkColor });
        }
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }, [points, layout, mainColor, darkColor, mode]);

    // Old APIs have no framestep endpoint so we just return and empty component
    if (error) {
        console.error(error.toString());
        return null;
    }
    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: MAX_W }}>
            {!points && <div style={{ padding: 8 }}>Loading...</div>}
            <canvas
                ref={canvasRef}
                className="fs-scatter-canvas"
                aria-hidden="true"
                // Placed over the main plot in shares of the chart size, so it scales with the chart
                style={{
                    position: 'absolute',
                    left: `${100 * ML / layout.SVG_W}%`,
                    top: `${100 * (MT + layout.TOP_H + GAP_T) / layout.SVG_H}%`,
                    width: `${100 * layout.MAIN_W / layout.SVG_W}%`,
                    height: `${100 * layout.MAIN_H / layout.SVG_H}%`,
                    zIndex: 0,
                    pointerEvents: 'none',
                }}
            />
            <svg ref={svgRef} style={{ display: 'block', position: 'relative', zIndex: 1, width: '100%', height: 'auto' }} />
        </div>
    );
};

export default FramestepPlot;
