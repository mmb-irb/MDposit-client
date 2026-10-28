// This analysis has been integrated by Claude

import React, {
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
} from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

import { CardContent, Slider, Typography } from '@mui/material';

import { color as d3color, interpolatePlasma, interpolateSinebow, schemeTableau10 } from 'd3';

import { ColormakerRegistry } from 'ngl';

import Card from '../../../components/animated-card';
import ViewerWithControls from '../../../components/viewer-with-controls';
import Selector from '../../../components/selector';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

// Set references to find representations between different renders
const EDGE_REFERENCE = 'edge';
const REGION_REFERENCE = 'region';

// Set the available region types to be painted over the structure
const HOTSPOTS = 'Hotspots';
const CLIQUES = 'Cliques';
const COMMUNITIES = 'Communities';
const LINK_STRENGTH = 'Link strength';
const NO_REGIONS = 'None';
const REGION_OPTIONS = [LINK_STRENGTH, HOTSPOTS, CLIQUES, COMMUNITIES, NO_REGIONS];

// Links are grouped in bins according to their weight, one representation per bin
// Every bin has its own thickness and opacity, which grow with the link weight
const WEIGHT_BINS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const MIN_EDGE_RADIUS = 0.02;
const MAX_EDGE_RADIUS = 0.2;
const MIN_EDGE_OPACITY = 0.05;
// WARNING: Colors must be CSS color names, since hexadecimal colors are not accepted by the viewer
const EDGE_COLOR = 'dimgray';
// Links between residues of the same chain closer than the minimum step in sequence are hidden
const MAX_SEQUENCE_STEP = 10;

// Colors used to paint regions (as integers, since they are used in a custom color scheme)
const HOTSPOT_COLOR = 0xd62728;
const BACKGROUND_COLOR = 0xd3d3d3; // lightgrey
// Parse a CSS color to the integer format used by NGL
const colorToInt = color => parseInt(d3color(color).formatHex().substring(1), 16);
// Greatest common divisor
const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
// Get a distinct color for each region
// Use a categorical palette when possible and spread colors along the hue wheel otherwise
const getRegionColor = (index, count) => {
  if (count <= schemeTableau10.length) return colorToInt(schemeTableau10[index]);
  // Hues are evenly spaced, but consecutive regions jump across the wheel to have very different colors
  let jump = Math.round(count * 0.382);
  while (gcd(jump, count) !== 1) jump++;
  return colorToInt(interpolateSinebow(((index * jump) % count) / count));
};
// Get the color of links according to their strength, when links are colored by strength
// The brightest end of the scale is skipped since yellow is hard to see over white backgrounds
const getStrengthColor = weight => colorToInt(interpolatePlasma(weight * 0.85));
// Format a link weight (from 0 to 1) as a percentage for display
const toPercent = weight => `${Math.round(weight * 100)}%`;
// Format an integer color as a CSS color
const intToCss = color => '#' + color.toString(16).padStart(6, '0');

// Find the atom to be used as the anchor of links for a given residue
// Use the alpha carbon in proteins, the phosphorus in nucleic acids or the first atom otherwise
const getAnchorAtomIndex = residue => {
  const atoms = residue.atoms;
  const anchor = atoms.find(atom => atom.name === 'CA') || atoms.find(atom => atom.name === 'P');
  return anchor ? anchor.index : atoms[0].index;
};

// Given a link weight, find the index of the bin it belongs to
const getBinIndex = weight => {
  const index = Math.round(weight * 10) - 1;
  return Math.min(Math.max(index, 0), WEIGHT_BINS.length - 1);
};

const Allostery = () => {
  // Track if the NGL viewer
  // The status isNglVisible is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the current project data
  const { accessionAndMdNumber, topology } = useContext(ProjectCtx);

  // Send a request to the API with the url of the allostery analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/allostery`,
  );

  // Set which type of region is painted over the structure
  const [selectedRegionType, setSelectedRegionType] = useState(LINK_STRENGTH);
  // Set the minimum weight of links to be displayed
  const [minimumWeight, setMinimumWeight] = useState(0.5);
  // Set the minimum step in sequence between residues of the same chain for their links to be displayed
  const [minimumStep, setMinimumStep] = useState(2);
  // Set which region is highlighted in the viewer, if any
  const [highlightedRegion, setHighlightedRegion] = useState(null);

  // Process analysis data
  const { edges, regions } = useMemo(() => {
    if (!payload || !topology) return {};
    // Analysis residues are topology residue indices
    // Set the anchor atom for every residue which is involved in any link
    const anchors = {};
    const getAnchor = residueIndex => {
      let anchor = anchors[residueIndex];
      if (anchor === undefined) {
        anchor = getAnchorAtomIndex(topology.getResidueByIndex(residueIndex));
        anchors[residueIndex] = anchor;
      }
      return anchor;
    };
    // Set the links as pairs of atoms with their weights
    // Also set the step in sequence between both residues, which is infinite for residues in different chains
    const { source, target, weight } = payload.edges;
    const chainIndices = topology.residueChainIndices;
    const edges = source.map((sourceResidueIndex, i) => {
      const targetResidueIndex = target[i];
      const sameChain = chainIndices[sourceResidueIndex] === chainIndices[targetResidueIndex];
      return {
        residuePair: [sourceResidueIndex, targetResidueIndex],
        atomPair: [getAnchor(sourceResidueIndex), getAnchor(targetResidueIndex)],
        weight: weight[i],
        step: sameChain ? Math.abs(targetResidueIndex - sourceResidueIndex) : Infinity,
      };
    });
    // Set the regions of every type as lists of residue indices with their colors
    const setRegions = (residueGroups, label) => residueGroups.map((residueIndices, i) => ({
      name: `${label} ${i + 1}`,
      residueIndices,
      color: getRegionColor(i, residueGroups.length),
    }));
    const regions = {
      [HOTSPOTS]: [{ name: 'Hotspots', residueIndices: payload.hotspots, color: HOTSPOT_COLOR }],
      [CLIQUES]: setRegions(payload.cliques, 'Clique'),
      [COMMUNITIES]: setRegions(payload.communities, 'Community'),
      // Links are painted instead of regions, so the whole structure is grey
      [LINK_STRENGTH]: [],
      [NO_REGIONS]: [],
    };
    return { edges, regions };
  }, [payload, topology]);

  // Set one color scheme for every type of region
  // Residues which do not belong to any region are painted in grey
  const regionSchemes = useMemo(() => {
    if (!regions) return;
    const regionSchemes = {};
    Object.entries(regions).forEach(([regionType, typeRegions]) => {
      const residueColors = {};
      typeRegions.forEach(region => region.residueIndices.forEach(residueIndex => {
        residueColors[residueIndex] = region.color;
      }));
      regionSchemes[regionType] = ColormakerRegistry.addScheme(function () {
        this.atomColor = atom => {
          const color = residueColors[atom.residueIndex];
          return color === undefined ? BACKGROUND_COLOR : color;
        };
      });
    });
    return regionSchemes;
  }, [regions]);

  // Set one color scheme for every bin of links, used when links are colored by strength
  // Note that link colors come from the atoms they join, so every atom gets the bin color
  const strengthSchemes = useMemo(() => WEIGHT_BINS.map(binWeight => {
    const color = getStrengthColor(binWeight);
    return ColormakerRegistry.addScheme(function () {
      this.atomColor = () => color;
    });
  }), []);

  // Set the color fields of link representations according to the selected type of region
  const getEdgeColor = useCallback((regionType, binIndex) => {
    if (regionType === LINK_STRENGTH)
      return { color: 'custom', customScheme: strengthSchemes[binIndex] };
    return { color: EDGE_COLOR, customScheme: undefined };
  }, [strengthSchemes]);

  // Set the links to be displayed according to the minimum weight and step
  const displayedEdges = useMemo(() => {
    if (!edges) return;
    return edges.filter(edge => edge.weight >= minimumWeight && edge.step >= minimumStep);
  }, [edges, minimumWeight, minimumStep]);

  // Split the links to be displayed in their corresponding weight bins
  const binAtomPairs = useMemo(() => {
    if (!displayedEdges) return;
    const binAtomPairs = WEIGHT_BINS.map(() => []);
    displayedEdges.forEach(edge => {
      binAtomPairs[getBinIndex(edge.weight)].push(edge.atomPair);
    });
    return binAtomPairs;
  }, [displayedEdges]);

  // Find links by their atom pairs, to set the tooltip when a link is hovered in the viewer
  const edgesByAtomPair = useMemo(() => {
    if (!edges) return;
    const edgesByAtomPair = new Map();
    edges.forEach(edge => {
      const [atom1, atom2] = edge.atomPair;
      edgesByAtomPair.set(`${Math.min(atom1, atom2)}-${Math.max(atom1, atom2)}`, edge);
    });
    return edgesByAtomPair;
  }, [edges]);

  // Set the tooltip content when a link is hovered in the viewer
  const handleDistanceTooltip = useCallback((atom1, atom2) => {
    const edge = edgesByAtomPair && edgesByAtomPair.get(`${Math.min(atom1, atom2)}-${Math.max(atom1, atom2)}`);
    if (!edge) return;
    const [residue1, residue2] = edge.residuePair.map(residueIndex => topology.getResidueByIndex(residueIndex));
    return (
      <>
        <div>{`${residue1.standardLabel} - ${residue2.standardLabel}`}</div>
        <div>{`Link strength: ${toPercent(edge.weight)}`}</div>
      </>
    );
  }, [edgesByAtomPair, topology]);

  // Use this hook to get the memoized NGL default representations
  const defaultRepresentations = topology && topology.defaultRepresentations;

  // Define the representations to be displayed in the viewer
  const [representations, setRepresentations] = useState(null);

  // Set the representations of links, one for every bin with links to be displayed
  // WARNING: Bins with no links must not be represented at all
  // WARNING: NGL distance representations with no atom pairs crash when their parameters are updated
  // Previous representations are reused when possible to keep changes made by the user (e.g. hidden)
  const getEdgeRepresentations = useCallback((previousEdgeRepresentations, regionType) => {
    const edgeRepresentations = [];
    // Bins are sorted from strongest to weakest links
    // Thus weak bins, which are the ones to be removed more often, are at the end of the list
    // This way the removal does not change the position (and thus the name in the viewer) of the rest
    for (let binIndex = WEIGHT_BINS.length - 1; binIndex >= 0; binIndex--) {
      const atomPair = binAtomPairs[binIndex];
      if (atomPair.length === 0) continue;
      const binWeight = WEIGHT_BINS[binIndex];
      const name = `Links (strength ${toPercent(binWeight)})`;
      const previous = previousEdgeRepresentations.find(representation => representation.name === name);
      const representation = previous || {
        name,
        selection: 'all',
        type: 'distance',
        opacity: MIN_EDGE_OPACITY + (1 - MIN_EDGE_OPACITY) * binWeight,
        other: {
          useCylinder: true,
          radiusSize: MIN_EDGE_RADIUS + (MAX_EDGE_RADIUS - MIN_EDGE_RADIUS) * binWeight,
          labelVisible: false,
        },
        reference: EDGE_REFERENCE,
      };
      // Only replace the atom pairs when they change, so the representation is not rebuilt otherwise
      if (!previous || previous.other.atomPair !== atomPair)
        representation.other = { ...representation.other, atomPair };
      Object.assign(representation, getEdgeColor(regionType, binIndex));
      edgeRepresentations.push(representation);
    }
    return edgeRepresentations;
  }, [binAtomPairs, getEdgeColor]);

  // Set the representations state the first time
  useEffect(() => {
    // Wait until we have both the analysis data and the default representations available
    if (!binAtomPairs || !regionSchemes) return;
    if (!defaultRepresentations || defaultRepresentations.length === 0) return;
    setRepresentations(previousRepresentations => {
      // Representations are set just once, further changes are handled apart
      if (previousRepresentations !== null) return previousRepresentations;
      // Everything is painted in grey but the selected regions
      const baseRepresentations = defaultRepresentations.map(representation => ({
        ...representation,
        color: 'custom',
        customScheme: regionSchemes[selectedRegionType],
        reference: REGION_REFERENCE,
      }));
      return [...baseRepresentations, ...getEdgeRepresentations([], selectedRegionType)];
    });
  }, [binAtomPairs, regionSchemes, getEdgeRepresentations, defaultRepresentations]);

  // Update link representations according to the displayed links and the selected type of region
  useEffect(() => {
    setRepresentations(previousRepresentations => {
      if (previousRepresentations === null) return null;
      const otherRepresentations = previousRepresentations.filter(
        representation => representation.reference !== EDGE_REFERENCE);
      const previousEdgeRepresentations = previousRepresentations.filter(
        representation => representation.reference === EDGE_REFERENCE);
      return [
        ...otherRepresentations,
        ...getEdgeRepresentations(previousEdgeRepresentations, selectedRegionType),
      ];
    });
  }, [getEdgeRepresentations, selectedRegionType]);

  // Update the region representations according to the selected type of region
  useEffect(() => {
    if (!regionSchemes) return;
    setRepresentations(previousRepresentations => {
      if (previousRepresentations === null) return null;
      previousRepresentations.forEach(representation => {
        if (representation.reference !== REGION_REFERENCE) return;
        representation.customScheme = regionSchemes[selectedRegionType];
      });
      return [...previousRepresentations];
    });
    // Reset the highlighted region, which may belong to the previous type of region
    setHighlightedRegion(null);
  }, [regionSchemes, getEdgeColor, selectedRegionType]);

  // Set the residues to be highlighted in the viewer
  const selectedResidueIndices = useMemo(() => {
    if (!highlightedRegion) return [];
    return highlightedRegion.residueIndices;
  }, [highlightedRegion]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened with the analysis data';

  if (!topology || !regions) return <Loading />;

  // Get the regions of the selected type
  const currentRegions = regions[selectedRegionType];

  return (
    <>
      <Card>
        <CardContent>
          <div className={style.horizontal}>
            <Typography variant="h7" className={style.wide30}>{'Painted regions: '}</Typography>
            <Selector
              options={REGION_OPTIONS}
              selection={selectedRegionType}
              setter={setSelectedRegionType}
            />
          </div>
          <div className={style.horizontal}>
            <Typography variant="h7" className={style.wide30}>
              {'Minimum link strength: '}
            </Typography>
            <Slider
              title="Change the minimum strength of displayed links"
              value={minimumWeight}
              // Round the value to avoid float precision errors (e.g. 0.8999999)
              onChange={(_, value) => { setMinimumWeight(Math.round(value * 10) / 10) }}
              min={WEIGHT_BINS[0]}
              max={WEIGHT_BINS[WEIGHT_BINS.length - 1]}
              step={0.1}
              marks
              valueLabelDisplay="auto"
              valueLabelFormat={toPercent}
              className={style.wide75}
            />
          </div>
          <div className={style.horizontal}>
            <Typography variant="h7" className={style.wide30}>
              {'Minimum residue step in sequence: '}
            </Typography>
            <Slider
              title="Hide links between residues of the same chain which are closer in sequence than this step"
              value={minimumStep}
              onChange={(_, value) => { setMinimumStep(value) }}
              min={1}
              max={MAX_SEQUENCE_STEP}
              step={1}
              marks
              valueLabelDisplay="auto"
              className={style.wide75}
            />
          </div>
          <Typography variant="body2" className={style.count}>
            {`Displayed links: ${displayedEdges.length} of ${edges.length}`}
          </Typography>
          {currentRegions.length > 0 && (
            <div className={style.legend}>
              {currentRegions.map(region => (
                <span
                  key={region.name}
                  className={region === highlightedRegion ? style['selected-region'] : style.region}
                  title={`Click to highlight ${region.name.toLowerCase()}`}
                  onClick={() => setHighlightedRegion(
                    previous => previous === region ? null : region)}
                >
                  <span className={style.swatch} style={{ backgroundColor: intToCss(region.color) }} />
                  {`${region.name} (${region.residueIndices.length} residues)`}
                </span>
              ))}
            </div>
          )}
          {selectedRegionType === LINK_STRENGTH && (
            <div className={style.legend}>
              {WEIGHT_BINS.map(binWeight => (
                <span key={binWeight} className={style['legend-item']}>
                  <span className={style.swatch}
                    style={{ backgroundColor: intToCss(getStrengthColor(binWeight)) }} />
                  {toPercent(binWeight)}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card className={style.nglcard} ref={nglRef}>
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible && representations ? (
          <ViewerWithControls
            className={style.container}
            representationsState={[representations, setRepresentations]}
            selectedResidueIndices={selectedResidueIndices}
            distanceTooltip={handleDistanceTooltip}
          />
        ) : (
          <div style={{ height: '70vh' }} />
        )}
      </Card>
    </>
  );
};

export default Allostery;
