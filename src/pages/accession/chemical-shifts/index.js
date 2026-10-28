// This analysis has been integrated by Claude

import React, {
  lazy,
  Suspense,
  useState,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from 'react';

// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

import { Tooltip, Typography } from '@mui/material';

import { interpolateTurbo } from 'd3';

import Card from '../../../components/animated-card';
import ViewerWithControls from '../../../components/viewer-with-controls';
import Selector from '../../../components/selector';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

// Explain the legend colors, which stand for the models deviation
const MODELS_DEVIATION_HELP = 'Models deviation: chemical shifts are predicted by an ensemble of 5 models '
  + 'and the standard deviation between models is a measure of the prediction confidence. '
  + 'Its mean along the trajectory is displayed for every atom, where higher values stand for less reliable predictions.';

// Set the atom names to be displayed first
// Any other atom name in the analysis is displayed after these ones
const ATOM_NAME_ORDER = ['CA', 'CB', 'C', 'HA', 'H', 'N'];

// The color scale goes from blue (lowest csmdv, reliable) to red (highest csmdv, not reliable)
// The darkest ends of the turbo scale are skipped so colors are easier to see
const SCALE_START = 0.1;
const SCALE_END = 0.95;
const getReliabilityColor = normalizedValue =>
  interpolateTurbo(SCALE_START + (SCALE_END - SCALE_START) * normalizedValue);

// Set the CSS gradient for the color scale legend
const LEGEND_STEPS = 10;
const LEGEND_GRADIENT = `linear-gradient(to right, ${Array.from(
  { length: LEGEND_STEPS + 1 },
  (_, i) => getReliabilityColor(i / LEGEND_STEPS),
).join(', ')})`;

// Set the color of the selected atom line in the temporal graph
const TEMPORAL_COLOR = '#1f77b4';

// Set the residue filter option which displays atoms in all residues
const ALL_RESIDUES = 'all';

const cents = num => Math.round(num * 100) / 100;

const ChemicalShifts = () => {
  // Track if the NGL viewer is on screen
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Get the current project data
  const { accessionAndMdNumber, metadata, topology } = useContext(ProjectCtx);

  // Set a ref to the viewer which allows access to its exposed methods
  const viewerRef = useRef(null);
  // Set a ref to the temporal graph which allows access to its exposed methods
  const temporalGraphRef = useRef(null);

  // Send a request to the API with the url of the chemical shifts analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/chemshifts`,
  );

  // Set the atom name of the group displayed in the graph
  const [selectedName, setSelectedName] = useState(null);

  // Set the residue name used to filter the analyzed atoms
  const [selectedResidue, setSelectedResidue] = useState(ALL_RESIDUES);

  // Set the atom clicked in the graph, if any
  // It includes the graph index, the payload index and the actual atom index
  const [clicked, setClicked] = useState(null);

  // Find the minimum and maximum csmdv values to set the color scale
  // They are found among all analyzed atoms so colors do not change when residues are filtered
  // Also keep the payload index of every analyzed atom
  // Also set the residue filter options, which are the names of residues with analyzed atoms
  const { minCsmdv, maxCsmdv, payloadIndices, residueOptions } = useMemo(() => {
    if (!payload || !topology) return {};
    const { atndx, csmdv } = payload;
    const payloadIndices = new Map(atndx.map((atomIndex, i) => [atomIndex, i]));
    const residueNames = new Set(atndx.map(atomIndex =>
      topology.residueNames[topology.atomResidueIndices[atomIndex]]));
    return {
      minCsmdv: Math.min(...csmdv),
      maxCsmdv: Math.max(...csmdv),
      payloadIndices,
      residueOptions: [ALL_RESIDUES, ...Array.from(residueNames).sort()],
    };
  }, [payload, topology]);

  // Split analysis data of atoms in the selected residues in one group per atom name
  // Also keep where every displayed atom is (i.e. its group and graph index) to find it when clicked in the viewer
  const { groups, atomLocations } = useMemo(() => {
    if (!payload || !topology) return {};
    const { atndx, csav, csdv, csmdv } = payload;
    const groupsByName = {};
    const atomLocations = new Map();
    atndx.forEach((atomIndex, i) => {
      if (selectedResidue !== ALL_RESIDUES
        && topology.residueNames[topology.atomResidueIndices[atomIndex]] !== selectedResidue) return;
      const name = topology.atomNames[atomIndex];
      let group = groupsByName[name];
      if (!group) {
        group = { name, atomIndices: [], payloadIndices: [], csav: [], csdv: [], csmdv: [] };
        groupsByName[name] = group;
      }
      atomLocations.set(atomIndex, { name, graphIndex: group.atomIndices.length, payloadIndex: i });
      group.atomIndices.push(atomIndex);
      group.payloadIndices.push(i);
      group.csav.push(csav[i]);
      group.csdv.push(csdv[i]);
      group.csmdv.push(csmdv[i]);
    });
    // Sort groups according to the atom name order
    const getOrder = name => {
      const order = ATOM_NAME_ORDER.indexOf(name);
      return order === -1 ? ATOM_NAME_ORDER.length : order;
    };
    const groups = Object.values(groupsByName).sort(
      (a, b) => getOrder(a.name) - getOrder(b.name));
    // Set the graph data for every group
    // Every dot is colored according to its csmdv
    const range = maxCsmdv - minCsmdv;
    groups.forEach(group => {
      group.yData = {
        csav: {
          data: group.csav,
          errorBars: group.csdv,
        },
      };
      group.xColors = group.csmdv.map(value =>
        getReliabilityColor(range ? (value - minCsmdv) / range : 0));
    });
    return { groups, atomLocations };
  }, [payload, topology, selectedResidue, minCsmdv, maxCsmdv]);

  // Set the frame ranges of the temporal summary
  // Every range is represented in the viewer by its central frame
  // Then set the viewer components to load only these central frames
  const { rangeLabels, components } = useMemo(() => {
    if (!payload || !metadata) return {};
    const { tcsav, start, step } = payload;
    const rangeCount = tcsav[0].length;
    const lastFrame = metadata.mdFrames - 1;
    const rangeLabels = [];
    const centralFrames = [];
    for (let r = 0; r < rangeCount; r++) {
      const first = start + r * step;
      const last = Math.min(first + step - 1, lastFrame);
      // Frame labels are 1-based
      rangeLabels.push(`${first + 1}-${last + 1}`);
      centralFrames.push(first + Math.floor(step / 2));
    }
    // Central frames are equally spaced so they may be requested as a range with step
    // Note that frames in the query are 1-based
    const firstCentral = centralFrames[0] + 1;
    const lastCentral = centralFrames[centralFrames.length - 1] + 1;
    const trajectoryUrl = `/trajectory?frames=${firstCentral}:${lastCentral}:${step}`;
    const components = [{ trajectoryURLs: [trajectoryUrl] }];
    return { rangeLabels, components };
  }, [payload, metadata]);

  // Set the group displayed in the graph
  // Use the first group when there is no selection yet
  const currentGroup = useMemo(() => {
    if (!groups) return null;
    return groups.find(group => group.name === selectedName) || groups[0];
  }, [groups, selectedName]);

  // Set the selector options with the number of atoms in every group
  // Options are labels, so we keep track of which group belongs to every label
  const { groupOptions, groupsByOption } = useMemo(() => {
    if (!groups) return {};
    const groupsByOption = {};
    groups.forEach(group => {
      groupsByOption[`${group.name} (${group.atomIndices.length} atoms)`] = group;
    });
    return { groupOptions: Object.keys(groupsByOption), groupsByOption };
  }, [groups]);
  const currentOption = groupOptions && groupOptions.find(
    option => groupsByOption[option] === currentGroup);

  // Change the displayed group and reset the selected atom, which belongs to the previous group
  const handleGroupChange = useCallback(option => {
    setSelectedName(groupsByOption[option].name);
    setClicked(null);
  }, [groupsByOption]);

  // Change the residue filter and reset the selected atom, which may be filtered out
  // The displayed atom name is kept if there are atoms with this name in the new residues
  const handleResidueChange = useCallback(residue => {
    setSelectedResidue(residue);
    setClicked(null);
  }, []);

  // Get a label for an atom, including its residue standard label
  const getAtomLabel = useCallback(atomIndex => {
    const atom = topology.getAtomByIndex(atomIndex);
    const tag = 'atom ' + (atomIndex + 1);
    const atomName = atom.name;
    if (!atomName) return tag;
    if (!atom.residue.name) return `${tag} (${atomName})`;
    return `${tag} (${atom.label})`;
  }, [topology]);

  // Set the tooltip generator for when the mouse hovers the global graph
  // Display an atom label based on the x index
  const tooltip = useCallback((_, xIndex) => {
    const atomIndex = currentGroup.atomIndices[xIndex];
    if (atomIndex === undefined) return '';
    return `${getAtomLabel(atomIndex)} σ ${cents(currentGroup.csdv[xIndex])} | Models deviation: ${cents(currentGroup.csmdv[xIndex])}`;
  }, [currentGroup, getAtomLabel]);

  // Select an atom when it is clicked in the viewer
  // Display its group in the graph if it is not displayed already
  // Atoms which are not in the analysis are ignored
  const handleAtomSelect = useCallback(atomIndex => {
    const location = atomLocations.get(atomIndex);
    if (!location) return;
    const { name, graphIndex, payloadIndex } = location;
    setSelectedName(name);
    setClicked({ graphIndex, payloadIndex, atomIndex });
  }, [atomLocations]);

  // Only atoms in the analysis and in the selected residues may be selected in the viewer
  const isAtomSelectable = useCallback(atomIndex => atomLocations.has(atomIndex), [atomLocations]);

  // Add the chemical shift values to the viewer tooltip when hovering an analyzed atom
  const handleHoverDisplay = useCallback((atomIndex, original) => {
    const i = payloadIndices.get(atomIndex);
    if (i === undefined) return original;
    return (
      <>
        {original}
        <hr style={{ color: 'lightGrey' }} />
        <div>{`Chemical shift: ${cents(payload.csav[i])} ppm`}</div>
        <div>{`σ: ${cents(payload.csdv[i])} ppm`}</div>
        <div>{`Models deviation: ${cents(payload.csmdv[i])}`}</div>
      </>
    );
  }, [payloadIndices, payload]);

  // Set if the current group has one atom only
  // In this case there is no global graph and the atom is selected automatically
  const isSingleAtom = currentGroup && currentGroup.atomIndices.length === 1;

  // Select an atom in the viewer and the temporal graph when it is clicked in the global graph
  const handleSelect = useCallback(graphIndex => setClicked({
    graphIndex,
    payloadIndex: currentGroup.payloadIndices[graphIndex],
    atomIndex: currentGroup.atomIndices[graphIndex],
  }), [currentGroup]);

  // Set the selected atom, which is the clicked atom or the only atom in the group
  const selected = useMemo(() => {
    if (!isSingleAtom) return clicked;
    return {
      graphIndex: 0,
      payloadIndex: currentGroup.payloadIndices[0],
      atomIndex: currentGroup.atomIndices[0],
    };
  }, [isSingleAtom, clicked, currentGroup]);

  // Set the mark for the selected atom in the global graph
  const marks = useMemo(() => {
    if (!selected) return [];
    return [{ x: selected.graphIndex }];
  }, [selected]);

  // Set the atoms to be highlighted in the viewer
  // It is memoized so the viewer does not refocus the selected atom on every render
  const selectedAtoms = useMemo(() => {
    if (!selected) return [];
    return [selected.atomIndex];
  }, [selected]);

  // Set the temporal data of the selected atom
  // Also set a padding in the y axis so the standard deviation area fits in the graph
  const { temporalData, temporalPadding } = useMemo(() => {
    if (!selected) return {};
    const means = payload.tcsav[selected.payloadIndex];
    const stdvs = payload.tcsdv[selected.payloadIndex];
    const temporalData = {
      [getAtomLabel(selected.atomIndex)]: {
        data: means,
        areaStdDev: stdvs,
        color: TEMPORAL_COLOR,
      },
    };
    return { temporalData, temporalPadding: Math.max(...stdvs) };
  }, [selected, payload, getAtomLabel]);

  // Set the tooltip for when the mouse hovers the temporal graph
  const temporalTooltip = useCallback((_, xIndex) => {
    const label = rangeLabels[xIndex];
    if (label === undefined || !selected) return '';
    const stdv = payload.tcsdv[selected.payloadIndex][xIndex];
    return `frames ${label} σ ${cents(stdv)}`;
  }, [rangeLabels, selected, payload]);

  // When the user clicks on the temporal graph, move the viewer to the corresponding frame
  // There is one frame loaded in the viewer for every frame range
  const handleFrameSelection = useCallback(frame => {
    if (!viewerRef.current) return;
    viewerRef.current.togglePlaying(false);
    viewerRef.current.currentFrame = frame;
  }, []);

  // When the viewer is playing, mark the current frame range in the temporal graph
  const handleFrameProgress = useCallback(progress => {
    if (!temporalGraphRef.current || !rangeLabels) return;
    // Progress is a float number which ranges from 0 to 1
    // WARNING: This 'round' is only for the float problem (e.g. 57 = 56.9999...)
    const frame = Math.round(progress * (rangeLabels.length - 1));
    temporalGraphRef.current.marks = [{ x: frame }];
  }, [rangeLabels]);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened with the analysis data';

  if (!topology || !metadata || !currentGroup) return <Loading />;

  // Render
  const legend = (
    <Tooltip title={MODELS_DEVIATION_HELP} arrow>
      <div className={style.legend}>
        <span>{cents(minCsmdv)}</span>
        <span className={style.gradient} style={{ background: LEGEND_GRADIENT }} />
        <span>{cents(maxCsmdv)}</span>
      </div>
    </Tooltip>
  );

  return (
    <Suspense fallback={<Loading />}>
      <div className={style.layout}>
        <Card className={style.nglcard} ref={nglRef}>
          {/* Render the NGL viewer when it is on screen*/}
          {isNglVisible && (
            <ViewerWithControls
              className={style.container}
              startingComponents={components}
              selectedAtoms={selectedAtoms}
              onAtomSelect={handleAtomSelect}
              isAtomSelectable={isAtomSelectable}
              onHoverDisplay={handleHoverDisplay}
              onProgress={handleFrameProgress}
              ref={viewerRef}
              framesSelect={false}
            />
          )}
        </Card>
        <div className={style.column}>
          <Card className={isSingleAtom ? style.summarycard : style.graphcard}>
            <div className={style.controls}>
              <div className={style.horizontal}>
                <Typography variant="subtitle2">{'Atom:'}</Typography>
                <Selector
                  options={groupOptions}
                  selection={currentOption}
                  setter={handleGroupChange}
                  size="small"
                />
              </div>
              <div className={style.horizontal}>
                <Typography variant="subtitle2">{'Residue:'}</Typography>
                <Selector
                  options={residueOptions}
                  selection={selectedResidue}
                  setter={handleResidueChange}
                  size="small"
                />
              </div>
              {isSingleAtom && legend}
            </div>
            {isSingleAtom ? (
              // There is no point in a graph with one dot only, so values are displayed as text
              <div className={style.summary}>
                <Typography variant="subtitle2">
                  {getAtomLabel(currentGroup.atomIndices[0])}
                </Typography>
                <span>
                  <b>Chemical shift: </b>
                  {`${cents(currentGroup.csav[0])} ppm`}
                </span>
                <span>
                  <b>σ: </b>
                  {`${cents(currentGroup.csdv[0])} ppm`}
                </span>
                <span className={style.horizontal}>
                  <b>Models deviation:&nbsp;</b>
                  <span className={style.swatch} style={{ backgroundColor: currentGroup.xColors[0] }} />
                  {cents(currentGroup.csmdv[0])}
                </span>
              </div>
            ) : (
              <Graph
                yData={currentGroup.yData}
                step={1} // Step is always 1 since x values are the analyzed atoms
                xAxisLabel={'Atom'}
                xTooltip={tooltip}
                yAxisLabel={'Chemical shift (ppm)'}
                type={'dots'}
                xColors={currentGroup.xColors}
                onSelect={handleSelect}
                marks={marks}
                fullPrecision={true}
                className={style.graph}
              />
            )}
            {/* Over the graph, in the blank space left by the axis labels */}
            {!isSingleAtom && <div className={style.floatinglegend}>{legend}</div>}
          </Card>
          <Card className={style.graphcard}>
            {selected ? (
              <>
                <Typography variant="subtitle2" className={style.title}>
                  {`Chemical shift along the trajectory: ${getAtomLabel(selected.atomIndex)}`}
                </Typography>
                <Graph
                  key={selected.payloadIndex}
                  yData={temporalData}
                  step={1} // Step is always 1 since x values are the frame ranges
                  xAxisLabel={'Frames'}
                  xAxisValues={rangeLabels}
                  xTooltip={temporalTooltip}
                  yAxisLabel={'Chemical shift (ppm)'}
                  type={'line'}
                  areaStdDev={true}
                  yPadding={temporalPadding}
                  onSelect={handleFrameSelection}
                  fullPrecision={true}
                  className={style.graph}
                  ref={temporalGraphRef}
                />
              </>
            ) : (
              <div className={style.placeholder}>
                <Typography variant="h6">No atom selected</Typography>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Suspense>
  );
};

export default ChemicalShifts;
