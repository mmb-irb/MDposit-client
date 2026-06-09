import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

// ─── Layout constants (fixed parts) ─────────────────────────────────────────
const ML = 80, MB = 65, MT = 12, MR = 14;
const MAIN_H = 520;
const TOP_H = 100, RIGHT_W = 80, CBAR_W = 18;
const GAP_T = 6, GAP_R = 15, GAP_CBAR = 28;
const FIXED_W = ML + GAP_R + RIGHT_W + GAP_CBAR + CBAR_W + MR + 60;

const N_GRID  = 200;   // KDE grid resolution (matches Python)
const N_LEVELS = 8;    // Number of contour levels (matches Python)
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

const axisNumbersFontSize = "15px";
const axisLabelsFontSize = "22px";
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
            pts.push([framestep * f, f]); // [total_time_ns, frames]
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

function drawScatterCanvas(canvasEl, points, xSc, ySc, mainWidth, mainHeight, alphaWeight) {
    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = Math.max(1, Math.round(mainWidth * dpr));
    canvasEl.height = Math.max(1, Math.round(mainHeight * dpr));
    canvasEl.style.width = `${mainWidth}px`;
    canvasEl.style.height = `${mainHeight}px`;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, mainWidth, mainHeight);
    ctx.fillStyle = `rgba(70, 130, 180, ${alphaWeight / points.length})`;

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
// containerWidth is the full pixel width of the wrapping div
const SUPERSCRIPTS = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
function fmtLargeNumber(v) {
    const av = Math.abs(v);
    if (av >= 1e4) return d3.format('.0e')(v);
    if (av >= 1) return d3.format(',.0f')(v);
    return d3.format('.2g')(v);
}

function fmtPow10(v) {
    const exp = Math.floor(Math.log10(v));
    const base = v / (10 ** exp);
    // only label exact powers of 10, not 2e-3 or 5e6
    if (base !== 1) return ''; 
    if (exp === 0) return '1';
    const sup = String(exp).split('').map(c => SUPERSCRIPTS[c] ?? c).join('');
    return `10${sup}`;
}

function drawChart(el, canvasEl, points, containerWidth = 760) {
    const MAIN_W = Math.max(200, containerWidth - FIXED_W);
    const SVG_W = ML + MAIN_W + GAP_R + RIGHT_W + GAP_CBAR + CBAR_W + MR + 60;
    const SVG_H = MT + TOP_H + GAP_T + MAIN_H + MB;

    const svg = d3.select(el).attr('width', SVG_W).attr('height', SVG_H);
    svg.selectAll('*').remove();

    // Tooltip
    d3.selectAll('.fs-tooltip').remove();
    const tooltip = d3.select('body').append('div')
        .attr('class', 'fs-tooltip')
        .style('position', 'fixed')
        .style('z-index', 9999)
        .style('background', 'rgba(0,0,0,0.72)')
        .style('color', '#fff')
        .style('padding', '3px 8px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('transition', 'opacity 0.1s');

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
            .attr('stroke', '#444').attr('stroke-opacity', 0.45).attr('stroke-width', 0.8));
    yMajorTicks.forEach(v =>
        gPlot.append('line')
            .attr('x1', 0).attr('x2', MAIN_W).attr('y1', ySc(v)).attr('y2', ySc(v))
            .attr('stroke', '#444').attr('stroke-opacity', 0.45).attr('stroke-width', 0.8));

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
            .style('font-size', '14px').attr('fill', '#191919').attr('opacity', 0.85);
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

    // Color mapping on a logarithmic density scale.
    // Ref: https://matplotlib.org/stable/users/explain/colors/colormaps.html
    const densityColor = d3.scaleSequential(d3.interpolateRdPu)
        .domain([logLo, logHi]);
    const getColor = v => densityColor(Math.log10(v));

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
    drawScatterCanvas(canvasEl, points, xSc, ySc, MAIN_W, MAIN_H, alphaWeight);


    const fmtDensity = v => v >= 1 ? d3.format(',.0f')(v) : v.toFixed(1);

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

            tooltip.style('opacity', 1)
            .html(
                `Density: ${fmtDensity(d.value)} MD/decade²<br/>` +
                `MDs in contour: ${d3.format(',.0f')(d.pointCount)}`
            );
        })
        .on('mousemove', () => tooltip
            .style('left', (d3.event.clientX + 12) + 'px')
            .style('top',  (d3.event.clientY - 30) + 'px'))
        .on('mouseout', function() {
            d3.select(this).attr('fill-opacity', 0.3);
            tooltip.style('opacity', 0);
        });
    // Contour edges (thin black outlines)
    gPlot.selectAll('.cl').data(contours).enter().append('path')
        .attr('d', d3.geoPath())
        .attr('fill', 'none')
        .attr('stroke', '#000').attr('stroke-width', 0.5).attr('stroke-opacity', 0.35);


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
        .call(d3.axisBottom(xSc).ticks(6).tickFormat(fmtPow10)).style('font-size', '14px');
    gMain.append('g')
        .call(d3.axisLeft(ySc).ticks(6).tickFormat(fmtPow10)).style('font-size', '14px');
    gMain.append('text').text('Total time (ns)')
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
            .attr('stroke', '#444').attr('stroke-opacity', 0.4).attr('stroke-width', 0.6);
    });
    tBins.forEach(({ x0, x1, count }) => {
        if (!count) return;
        gHT.append('rect')
            .attr('x', xSc(x0)).attr('width', Math.max(0, xSc(x1) - xSc(x0) - 0.5))
            .attr('y', htYSc(count)).attr('height', TOP_H - htYSc(count))
            .attr('fill', 'steelblue').attr('fill-opacity', 0.75)
            .style('cursor', 'default')
            .on('mouseover', () => tooltip.style('opacity', 1).text(`Count: ${count}`))
            .on('mousemove', () => tooltip
                .style('left', (d3.event.clientX + 12) + 'px')
                .style('top',  (d3.event.clientY - 30) + 'px'))
            .on('mouseout', () => tooltip.style('opacity', 0));
    });
    gHT.append('g').call(d3.axisLeft(htYSc).ticks(3).tickFormat(fmtLargeNumber)).style('font-size', '10px');
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
            .attr('stroke', '#444').attr('stroke-opacity', 0.4).attr('stroke-width', 0.6);
    });
    fBins.forEach(({ x0, x1, count }) => {
        if (!count) return;
        gHR.append('rect')
            .attr('y', ySc(x1)).attr('height', Math.max(0, ySc(x0) - ySc(x1) - 0.5))
            .attr('x', 0).attr('width', hrXSc(count))
            .attr('fill', 'steelblue').attr('fill-opacity', 0.75)
            .style('cursor', 'default')
            .on('mouseover', () => tooltip.style('opacity', 1).text(`Count: ${count}`))
            .on('mousemove', () => tooltip
                .style('left', (d3.event.clientX + 12) + 'px')
                .style('top',  (d3.event.clientY - 30) + 'px'))
            .on('mouseout', () => tooltip.style('opacity', 0));
    });
    gHR.append('g').attr('transform', `translate(0,${MAIN_H})`)
        .call(d3.axisBottom(hrXSc).ticks(2).tickFormat(fmtLargeNumber)).style('font-size', '10px');
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
        .attr('fill', 'none').attr('stroke', '#ccc');
    const cbarSc = d3.scaleLog().domain([levels[0], levels[N_LEVELS - 1]]).range([MAIN_H, 0]);
    // Show all contour level values on the colorbar (matching Python)
    gCbar.append('g').attr('transform', `translate(${CBAR_W},0)`)
        .call(d3.axisRight(cbarSc)
            .tickValues(levels)
            .tickFormat(fmtLargeNumber))
        .style('font-size', '11px');
    // Label: "MDs per decade²"
    const cbarLabelX = CBAR_W + 64;
    gCbar.append('text').text('MDs per decade²')
        .attr('text-anchor', 'middle')
        .attr('transform', `translate(${cbarLabelX},${MAIN_H / 2}) rotate(-90)`)
        .style('font-size', axisLabelsFontSize - 4);
}

// ─── React component ──────────────────────────────────────────────────────────
// Data is fetched from jsonUrl.
const FramestepPlot = ({ jsonUrl }) => {
    const svgRef = useRef(null);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [points, setPoints] = useState(null);
    const [error, setError] = useState(null);
    const [width, setWidth] = useState(760);

    // Track container width for responsive layout
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
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} while fetching framestep data`); return r.json(); })
            .then(raw => setPoints(processData(raw)))
            .catch(err => setError(err.message));
    }, [jsonUrl]);

    useEffect(() => {
        if (points && svgRef.current) {
            drawChart(svgRef.current, canvasRef.current, points, width);
        } else if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }, [points, width]);

    // Old APIs have no framestep endpoint so we just return and empty component
    if (error) {
        console.error(error.toString());
        return null;
    }
    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            {!points && <div style={{ padding: 8 }}>Loading...</div>}
            <canvas
                ref={canvasRef}
                className="fs-scatter-canvas"
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    left: ML,
                    top: MT + TOP_H + GAP_T,
                    zIndex: 0,
                    pointerEvents: 'none',
                }}
            />
            <svg ref={svgRef} style={{ display: 'block', position: 'relative', zIndex: 1 }} />
        </div>
    );
};

export default FramestepPlot;
