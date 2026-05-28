import { Vector4 } from 'three';
import {
  calcBSplinePoint,
  calcNURBSDerivatives,
} from 'three/examples/jsm/curves/NURBSUtils.js';
// constant used for numerical stability
const EPSILON = 1e-8;
const CHAP_SPLINE_DEGREE = 3;

export const CHANNEL_COLOR_OPTIONS = [
  { value: 'avg_radius', label: 'Radius', divergent: false },
  { value: 'avg_pl_hydrophobicity', label: 'Pore-lining Hydrophobicity', divergent: true },
  { value: 'avg_pf_hydrophobicity', label: 'Pore-facing Hydrophobicity', divergent: true },
];

const PROPERTY_PALETTES = {
  avg_radius: 'ylorbr',
  avg_pl_hydrophobicity: 'brbg',
  avg_pf_hydrophobicity: 'brbg',
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const vecAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vecSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vecScale = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
const vecDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vecCross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const vecNorm = v => Math.sqrt(vecDot(v, v));
const vecNormalize = v => {
  const len = vecNorm(v);
  if (len < EPSILON) return [1, 0, 0];
  return vecScale(v, 1 / len);
};

const finiteDiffDerivative = (x, y, i) => {
  if (x.length === 1) return 0;
  if (i === 0) {
    return (y[1] - y[0]) / Math.max(x[1] - x[0], EPSILON);
  }
  if (i === x.length - 1) {
    return (y[i] - y[i - 1]) / Math.max(x[i] - x[i - 1], EPSILON);
  }
  return (y[i + 1] - y[i - 1]) / Math.max(x[i + 1] - x[i - 1], EPSILON);
};

const hermiteInterpolate = (x0, x1, y0, y1, m0, m1, x) => {
  const h = Math.max(x1 - x0, EPSILON);
  const t = (x - x0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * y0 + h10 * h * m0 + h01 * y1 + h11 * h * m1;
};

const interpolateSamplesCubic = (xSource, ySource, xTarget) => {
  if (!xSource.length || !ySource.length || xSource.length !== ySource.length) {
    return xTarget.map(() => 0);
  }
  if (xSource.length === 1) {
    return xTarget.map(() => ySource[0]);
  }

  const deriv = ySource.map((_, i) => finiteDiffDerivative(xSource, ySource, i));
  let seg = 0;
  return xTarget.map(x => {
    if (x <= xSource[0]) return ySource[0];
    if (x >= xSource[xSource.length - 1]) return ySource[ySource.length - 1];
    while (seg < xSource.length - 2 && x > xSource[seg + 1]) {
      seg += 1;
    }
    return hermiteInterpolate(
      xSource[seg],
      xSource[seg + 1],
      ySource[seg],
      ySource[seg + 1],
      deriv[seg],
      deriv[seg + 1],
      x,
    );
  });
};

const generateRing = (centre, tangent, normal, radius, phiValues, coordScale) => (
  phiValues.map(phi => {
    const rotNormal = rotateAboutAxis(normal, tangent, phi);
    const vertex = vecAdd(centre, vecScale(rotNormal, radius));
    return vecScale(vertex, coordScale);
  })
);

const rotateAboutAxis = (vec, axisInput, angle) => {
  const axis = vecNormalize(axisInput);
  const [x, y, z] = axis;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;

  const m00 = c + x * x * t;
  const m01 = x * y * t - z * s;
  const m02 = x * z * t + y * s;
  const m10 = y * x * t + z * s;
  const m11 = c + y * y * t;
  const m12 = y * z * t - x * s;
  const m20 = z * x * t - y * s;
  const m21 = z * y * t + x * s;
  const m22 = c + z * z * t;

  return [
    m00 * vec[0] + m01 * vec[1] + m02 * vec[2],
    m10 * vec[0] + m11 * vec[1] + m12 * vec[2],
    m20 * vec[0] + m21 * vec[1] + m22 * vec[2],
  ];
};

const deriveDegree = (knots, ctrlCount) => {
  const degree = knots.length - ctrlCount - 1;
  if (degree >= 1) return degree;
  return CHAP_SPLINE_DEGREE;
};

const getSplineDomain = knots => [knots[0], knots[knots.length - 1]];

const expandUniqueKnots = (knots, degree) => {
  if (!Array.isArray(knots) || knots.length === 0) return [];
  if (degree <= 1) return [...knots];
  const padCount = degree - 1;
  return [
    ...Array.from({ length: padCount }, () => knots[0]),
    ...knots,
    ...Array.from({ length: padCount }, () => knots[knots.length - 1]),
  ];
};

const getFullKnotVector = (knots, ctrlCount) => {
  const degree = deriveDegree(knots, ctrlCount);
  const expectedFullLen = ctrlCount + degree + 1;
  if (knots.length === expectedFullLen) return { degree, knots };

  const expanded = expandUniqueKnots(knots, degree);
  if (expanded.length === expectedFullLen) {
    return { degree, knots: expanded };
  }

  // Fallback: preserve input to avoid hard failures on malformed payloads.
  return { degree, knots };
};

const toWeightedScalarCtrl = ctrl => ctrl.map(v => new Vector4(v, 0, 0, 1));

const toWeightedVectorCtrl = (ctrlX, ctrlY, ctrlZ) => (
  ctrlX.map((_, i) => new Vector4(ctrlX[i], ctrlY[i], ctrlZ[i], 1))
);

const evaluateScalarSpline = (u, knots, ctrl, extrapolation) => {
  const spline = getFullKnotVector(knots, ctrl.length);
  const degree = spline.degree;
  const fullKnots = spline.knots;
  const [lo, hi] = getSplineDomain(fullKnots);
  const ctrlW = toWeightedScalarCtrl(ctrl);

  if (u < lo || u > hi) {
    if (extrapolation === 'constant') {
      const endpoint = calcBSplinePoint(degree, fullKnots, ctrlW, u < lo ? lo : hi);
      return endpoint.x / Math.max(endpoint.w, EPSILON);
    }
  }

  const uClamped = clamp(u, lo, hi);
  const point = calcBSplinePoint(degree, fullKnots, ctrlW, uClamped);
  return point.x / Math.max(point.w, EPSILON);
};

const evaluateVectorSpline = (s, knots, ctrlX, ctrlY, ctrlZ, extrapolation) => {
  const spline = getFullKnotVector(knots, ctrlX.length);
  const degree = spline.degree;
  const fullKnots = spline.knots;
  const [lo, hi] = getSplineDomain(fullKnots);
  const ctrlW = toWeightedVectorCtrl(ctrlX, ctrlY, ctrlZ);

  if (s >= lo && s <= hi) {
    const point = calcBSplinePoint(degree, fullKnots, ctrlW, s);
    const invW = 1 / Math.max(point.w, EPSILON);
    return [point.x * invW, point.y * invW, point.z * invW];
  }

  if (extrapolation !== 'linear') {
    const boundaryPoint = calcBSplinePoint(degree, fullKnots, ctrlW, s < lo ? lo : hi);
    const invW = 1 / Math.max(boundaryPoint.w, EPSILON);
    return [boundaryPoint.x * invW, boundaryPoint.y * invW, boundaryPoint.z * invW];
  }

  const boundary = s < lo ? lo : hi;
  const boundaryPoint = calcBSplinePoint(degree, fullKnots, ctrlW, boundary);
  const invW = 1 / Math.max(boundaryPoint.w, EPSILON);
  const b0 = [boundaryPoint.x * invW, boundaryPoint.y * invW, boundaryPoint.z * invW];

  const deriv = calcNURBSDerivatives(degree, fullKnots, ctrlW, boundary, 1)[1];
  const slope = deriv ? [deriv.x, deriv.y, deriv.z] : [0, 0, 0];
  return vecAdd(b0, vecScale(slope, s - boundary));
};

const orthogonalVector = vec => {
  const x = Math.abs(vec[0]);
  const y = Math.abs(vec[1]);
  const z = Math.abs(vec[2]);
  if (x <= y && x <= z) return vecNormalize([0, -vec[2], vec[1]]);
  if (y <= x && y <= z) return vecNormalize([-vec[2], 0, vec[0]]);
  return vecNormalize([-vec[1], vec[0], 0]);
};

const generateTransportNormals = tangents => {
  if (!tangents.length) return [];
  const normals = [];
  let normal = orthogonalVector(tangents[0]);
  normals.push(normal);

  for (let i = 1; i < tangents.length; i += 1) {
    const axis = vecCross(tangents[i - 1], tangents[i]);
    const axisLen = vecNorm(axis);
    if (axisLen < EPSILON) {
      normals.push(normal);
      continue;
    }

    const angle = Math.atan2(axisLen, clamp(vecDot(tangents[i], tangents[i - 1]), -1, 1));
    normal = vecNormalize(rotateAboutAxis(normal, axis, angle));
    normals.push(normal);
  }

  return normals;
};

const PALETTES = {
  ylorbr: [
    [0.0, [255, 255, 229]],
    [0.25, [255, 237, 160]],
    [0.5, [254, 217, 118]],
    [0.75, [217, 95, 14]],
    [1.0, [102, 37, 6]],
  ],
  blues: [
    [0.0, [247, 251, 255]],
    [0.25, [198, 219, 239]],
    [0.5, [107, 174, 214]],
    [0.75, [33, 113, 181]],
    [1.0, [8, 48, 107]],
  ],
  purd: [
    [0.0, [247, 244, 249]],
    [0.25, [212, 185, 218]],
    [0.5, [201, 148, 199]],
    [0.75, [223, 101, 176]],
    [1.0, [122, 1, 119]],
  ],
  brbg: [
    [0.0, [1, 102, 94]],
    [0.25, [90, 180, 172]],
    [0.5, [221, 221, 221]],
    [0.75, [191, 129, 45]],
    [1.0, [84, 48, 5]],
  ],
};

const interpolateColor = (paletteName, tInput) => {
  const t = clamp(tInput, 0, 1);
  const stops = PALETTES[paletteName] || PALETTES.ylorbr;

  for (let i = 0; i < stops.length - 1; i += 1) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const alpha = (t - t0) / Math.max(t1 - t0, EPSILON);
      return [
        (c0[0] + alpha * (c1[0] - c0[0])) / 255,
        (c0[1] + alpha * (c1[1] - c0[1])) / 255,
        (c0[2] + alpha * (c1[2] - c0[2])) / 255,
      ];
    }
  }

  const last = stops[stops.length - 1][1];
  return [last[0] / 255, last[1] / 255, last[2] / 255];
};

const normalizeSequential = values => {
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;
  if (Math.abs(range) < EPSILON) {
    return values.map(() => 0.5);
  }
  return values.map(v => (v - minValue) / range);
};

const isValidNumeric = value => Number.isFinite(value) && Math.abs(value) < 1e20;

const sanitizeSeries = values => {
  const finiteValues = values.filter(isValidNumeric);
  if (finiteValues.length === 0) {
    return values.map(() => 0);
  }

  const fallback = finiteValues[0];
  const output = [];
  for (let i = 0; i < values.length; i += 1) {
    if (isValidNumeric(values[i])) {
      output.push(values[i]);
    } else if (i > 0) {
      output.push(output[i - 1]);
    } else {
      output.push(fallback);
    }
  }

  return output;
};

const sampleProfileSeries = (pathwayProfile, profileKey, sValues) => {
  if (!pathwayProfile || !Array.isArray(pathwayProfile.s) || !Array.isArray(pathwayProfile[profileKey])) {
    return null;
  }

  const x = pathwayProfile.s;
  const y = pathwayProfile[profileKey];
  if (x.length === 0 || y.length === 0 || x.length !== y.length) {
    return null;
  }
  if (x.length === 1) {
    return sValues.map(() => y[0]);
  }

  let j = 0;
  const sampled = sValues.map(s => {
    if (s <= x[0]) return y[0];
    if (s >= x[x.length - 1]) return y[y.length - 1];

    while (j < x.length - 2 && s > x[j + 1]) {
      j += 1;
    }

    const x0 = x[j];
    const x1 = x[j + 1];
    const y0 = y[j];
    const y1 = y[j + 1];
    const t = (s - x0) / Math.max(x1 - x0, EPSILON);
    return y0 + t * (y1 - y0);
  });

  return sampled;
};

const normalizeDivergent = values => {
  const maxAbs = Math.max(...values.map(v => Math.abs(v)));
  if (maxAbs < EPSILON) {
    return values.map(() => 0.5);
  }
  return values.map(v => 0.5 + 0.5 * (v / maxAbs));
};

const getSplineValue = (frame, splineName, s) => {
  const spline = frame[splineName];
  if (!spline || !spline.knots || !spline.ctrl || spline.knots.length === 0) {
    return 0;
  }
  return evaluateScalarSpline(s, spline.knots, spline.ctrl, 'constant');
};

const getColorSeries = (frame, sValues, propertyName, pathwayProfile) => {
  const profileKeyMap = {
    avg_radius: 'radiusMean',
    avg_density: 'densityMean',
    avg_energy: 'energyMean',
    avg_pl_hydrophobicity: 'plHydrophobicityMean',
    avg_pf_hydrophobicity: 'pfHydrophobicityMean',
  };

  const profileKey = profileKeyMap[propertyName];
  if (profileKey) {
    const sampled = sampleProfileSeries(pathwayProfile, profileKey, sValues);
    if (sampled) {
      return sanitizeSeries(sampled);
    }
  }

  switch (propertyName) {
    case 'avg_density':
      return sanitizeSeries(sValues.map(s => getSplineValue(frame, 'solventDensitySpline', s)));
    case 'avg_pl_hydrophobicity':
      return sanitizeSeries(sValues.map(s => getSplineValue(frame, 'plHydrophobicitySpline', s)));
    case 'avg_pf_hydrophobicity':
      return sanitizeSeries(sValues.map(s => getSplineValue(frame, 'pfHydrophobicitySpline', s)));
    case 'avg_energy':
      return sValues.map(() => 0);
    case 'avg_radius':
    default:
      return sanitizeSeries(sValues.map(s => getSplineValue(frame, 'molPathRadiusSpline', s)));
  }
};

export const getChannelSamplingValues = (frame, numLen = 200) => {
  if (!frame || !frame.molPathRadiusSpline || !frame.molPathRadiusSpline.knots) {
    return [];
  }

  const radius = frame.molPathRadiusSpline;
  const sLo = radius.knots[0];
  const sHi = radius.knots[radius.knots.length - 1];
  const sRange = Math.max(sHi - sLo, EPSILON);

  return Array.from({ length: numLen }, (_, i) => sLo + (i / Math.max(numLen - 1, 1)) * sRange);
};

export const getChannelPropertyValues = (frame, sValues, propertyName) => {
  switch (propertyName) {
    case 'avg_pl_hydrophobicity':
      return sanitizeSeries(sValues.map(s => getSplineValue(frame, 'plHydrophobicitySpline', s)));
    case 'avg_pf_hydrophobicity':
      return sanitizeSeries(sValues.map(s => getSplineValue(frame, 'pfHydrophobicitySpline', s)));
    case 'avg_radius':
    default:
      return sanitizeSeries(sValues.map(s => getSplineValue(frame, 'molPathRadiusSpline', s)));
  }
};

export const buildChannelMeshFromFrame = (frame, options = {}) => {
  if (!frame || !frame.molPathCentreLineSpline || !frame.molPathRadiusSpline) {
    return { position: [], colors: [], normals: [] };
  }

  // Number of samples along the channel length and around the circumference
  const numLen = options.numLen || 200;
  const numPhi = options.numPhi || 50;
  const coordScale = options.coordScale || 10;
  const colorProperty = options.colorProperty || 'avg_radius';
  const explicitPalette = options.colorPalette;
  const colorPalette = explicitPalette || PROPERTY_PALETTES[colorProperty] || 'ylorbr';
  const pathwayProfile = options.pathwayProfile || null;

  const centre = frame.molPathCentreLineSpline;
  const radius = frame.molPathRadiusSpline;
  const sLo = radius.knots[0];
  const sHi = radius.knots[radius.knots.length - 1];
  const sRange = Math.max(sHi - sLo, EPSILON);

  const sValues = getChannelSamplingValues(frame, numLen);
  const phiValues = Array.from({ length: numPhi }, (_, i) => (i * 2 * Math.PI) / numPhi);
  const centres = sValues.map(s => evaluateVectorSpline(
    s,
    centre.knots,
    centre.ctrlX,
    centre.ctrlY,
    centre.ctrlZ,
    'linear',
  ));

  const radii = sValues.map(s => evaluateScalarSpline(s, radius.knots, radius.ctrl, 'constant'));
  // logs all pairs of (s,radii)
  //   radii.forEach((r, i) => console.log(`s: ${sValues[i]}, radius: ${r}`));

  const tangentStep = sRange / Math.max(numLen * 10, 1000);
  const tangents = sValues.map(s => {
    const pPrev = evaluateVectorSpline(
      s - tangentStep,
      centre.knots,
      centre.ctrlX,
      centre.ctrlY,
      centre.ctrlZ,
      'linear',
    );
    const pNext = evaluateVectorSpline(
      s + tangentStep,
      centre.knots,
      centre.ctrlX,
      centre.ctrlY,
      centre.ctrlZ,
      'linear',
    );
    return vecNormalize(vecSub(pNext, pPrev));
  });
  const normals = generateTransportNormals(tangents);

  const propertyMeta = CHANNEL_COLOR_OPTIONS.find(opt => opt.value === colorProperty)
    || CHANNEL_COLOR_OPTIONS[0];
  const propertyValues = getColorSeries(frame, sValues, colorProperty, pathwayProfile);
  const normalizedValues = propertyMeta.divergent
    ? normalizeDivergent(propertyValues)
    : normalizeSequential(propertyValues);
  const pointColors = normalizedValues.map(v => {
    const t = colorProperty === 'avg_radius' ? 1 - v : v;
    return interpolateColor(colorPalette, t);
  });

  // Generate all rings directly without hierarchical filtering
  const vertexGrid = Array.from({ length: numLen }, (_, i) => {
    const ring = generateRing(
      centres[i], tangents[i], normals[i], radii[i], phiValues, coordScale,
    );
    return ring;
  });

  const normalGrid = Array.from({ length: numLen }, () => Array.from({ length: numPhi }, () => [0, 0, 1]));
  for (let i = 0; i < numLen; i += 1) {
    for (let j = 0; j < numPhi; j += 1) {
      const iPrev = i === 0 ? i : i - 1;
      const iNext = i === numLen - 1 ? i : i + 1;
      const jPrev = (j - 1 + numPhi) % numPhi;
      const jNext = (j + 1) % numPhi;

      const ds = vecSub(vertexGrid[iNext][j], vertexGrid[iPrev][j]);
      const dphi = vecSub(vertexGrid[i][jNext], vertexGrid[i][jPrev]);
      normalGrid[i][j] = vecNormalize(vecCross(dphi, ds));
    }
  }

  const position = [];
  const colors = [];
  const normalsOut = [];

  for (let i = 0; i < numLen - 1; i += 1) {
    const colA = pointColors[i];
    const colB = pointColors[i + 1];

    for (let j = 0; j < numPhi; j += 1) {
      const jNext = (j + 1) % numPhi;

      const bl = vertexGrid[i][j];
      const br = vertexGrid[i][jNext];
      const tl = vertexGrid[i + 1][j];
      const tr = vertexGrid[i + 1][jNext];
      const nbl = normalGrid[i][j];
      const nbr = normalGrid[i][jNext];
      const ntl = normalGrid[i + 1][j];
      const ntr = normalGrid[i + 1][jNext];

      position.push(
        bl[0], bl[1], bl[2],
        tr[0], tr[1], tr[2],
        tl[0], tl[1], tl[2],
      );
      colors.push(
        colA[0], colA[1], colA[2],
        colB[0], colB[1], colB[2],
        colB[0], colB[1], colB[2],
      );
      normalsOut.push(
        nbl[0], nbl[1], nbl[2],
        ntr[0], ntr[1], ntr[2],
        ntl[0], ntl[1], ntl[2],
      );

      position.push(
        bl[0], bl[1], bl[2],
        br[0], br[1], br[2],
        tr[0], tr[1], tr[2],
      );
      colors.push(
        colA[0], colA[1], colA[2],
        colA[0], colA[1], colA[2],
        colB[0], colB[1], colB[2],
      );
      normalsOut.push(
        nbl[0], nbl[1], nbl[2],
        nbr[0], nbr[1], nbr[2],
        ntr[0], ntr[1], ntr[2],
      );
    }
  }

  return { position, colors, normals: normalsOut };
};
