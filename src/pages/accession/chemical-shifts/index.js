// This analysis has been integrated by Claude

import React, { lazy, Suspense, useState, useContext, useMemo, useCallback } from 'react';

import { CardContent, Typography } from '@mui/material';

import { interpolateTurbo } from 'd3';

import Card from '../../../components/animated-card';
import ViewerSpawner from '../../../components/viewer-spawner';
import Loading from '../../../components/loading';

import useAPI from '../../../hooks/use-api';

import { ProjectCtx } from '../../../contexts';

import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import style from './style.module.css';

const Graph = lazy(() =>
  import(/* webpackChunkName: 'graph' */ '../../../components/graph'),
);

// Set the elements to be displayed first and their nice names
// Any other element in the analysis is displayed after these ones
const ELEMENT_ORDER = ['C', 'N', 'H'];
const ELEMENT_NAMES = { C: 'Carbon', N: 'Nitrogen', H: 'Hydrogen' };

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

const cents = num => Math.round(num * 100) / 100;

const ChemicalShifts = () => {
  // Get the current project data
  const { accessionAndMdNumber, topology } = useContext(ProjectCtx);

  // Send a request to the API with the url of the chemical shifts analysis
  const { loading, payload, error } = useAPI(
    `${BASE_PATH_PROJECTS}/${accessionAndMdNumber}/analyses/chemical-shifts`,
  );

  // Set the atom selected in the graph, if any
  // It includes the element (i.e. the graph), the graph index and the actual atom index
  const [selected, setSelected] = useState(null);

  // Split analysis data in one group per atom element
  // Also find the minimum and maximum csmdv values to set the color scale
  const { groups, minCsmdv, maxCsmdv } = useMemo(() => {
    if (!payload || !topology) return {};
    const { atom_indices, csav, csdv, csmdv } = payload;
    const groupsByElement = {};
    atom_indices.forEach((atomIndex, i) => {
      const element = topology.atomElements[atomIndex];
      let group = groupsByElement[element];
      if (!group) {
        group = { element, atomIndices: [], csav: [], csdv: [], csmdv: [] };
        groupsByElement[element] = group;
      }
      group.atomIndices.push(atomIndex);
      group.csav.push(csav[i]);
      group.csdv.push(csdv[i]);
      group.csmdv.push(csmdv[i]);
    });
    // Sort groups according to the element order
    const getOrder = element => {
      const order = ELEMENT_ORDER.indexOf(element);
      return order === -1 ? ELEMENT_ORDER.length : order;
    };
    const groups = Object.values(groupsByElement).sort(
      (a, b) => getOrder(a.element) - getOrder(b.element));
    // Set the graph data for every group
    // Every dot is colored according to its csmdv
    const minCsmdv = Math.min(...csmdv);
    const maxCsmdv = Math.max(...csmdv);
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
    return { groups, minCsmdv, maxCsmdv };
  }, [payload, topology]);

  // Set the tooltip generator for when the mouse hovers a graph
  // Display an atom label based on the x index
  const getTooltip = useCallback(group => (_, xIndex) => {
    const atomIndex = group.atomIndices[xIndex];
    if (atomIndex === undefined) return '';
    const atom = topology.getAtomByIndex(atomIndex);
    const tag = 'atom ' + (atomIndex + 1);
    const atomName = atom.name;
    if (!atomName) return tag;
    const residueName = atom.residue.name;
    const label = residueName ? `${residueName} - ${atomName}` : atomName;
    return `${tag} (${label}) σ ${cents(group.csdv[xIndex])} | Models deviation: ${cents(group.csmdv[xIndex])}`;
  }, [topology]);

  // Set one tooltip and one selection handler for every group
  const { tooltips, selectHandlers } = useMemo(() => {
    if (!groups) return {};
    const tooltips = {};
    const selectHandlers = {};
    groups.forEach(group => {
      tooltips[group.element] = getTooltip(group);
      selectHandlers[group.element] = graphIndex => setSelected({
        element: group.element,
        graphIndex,
        atomIndex: group.atomIndices[graphIndex],
      });
    });
    return { tooltips, selectHandlers };
  }, [groups, getTooltip]);

  // Set the mark for the selected atom in its graph
  const marks = useMemo(() => {
    if (!groups) return {};
    const marks = {};
    groups.forEach(group => {
      marks[group.element] = selected && selected.element === group.element
        ? [{ x: selected.graphIndex, attr: { fill: '#c8c8c8' } }]
        : [];
    });
    return marks;
  }, [groups, selected]);

  // Set the new viewer to be spawned for the selected atom
  // It is memoized so the viewer does not refocus the selected atom on every render
  const newViewer = useMemo(() => {
    if (!selected) return null;
    return {
      selectedAtoms: [selected.atomIndex],
      // This is used only as a tag for the onNail and onClose functions below
      // It has no effect on the viewer
      selection: selected,
    };
  }, [selected]);

  // Handle when the viewer is closed or nailed
  // If we close/nail the current active viewer then reset the selection
  const handleCloseViewer = useCallback(viewer => {
    setSelected(currentSelected =>
      viewer.selection === currentSelected ? null : currentSelected);
  }, []);

  // Render loading or error messages according with the API response
  if (loading) return <Loading />;
  else if (error) return error.toString();
  else if (!payload) return 'Something bad happened with the analysis data';

  if (!topology || !groups) return <Loading />;

  // Render
  return (
    <Suspense fallback={<Loading />}>
      <Card className={style.card}>
        <CardContent>
          <Typography variant="body2">
            Click any atom in the graphs to display it in the viewer. Atoms in the graphs are
            colored according to how reliable their predicted chemical shift is.
          </Typography>
          <div className={style.legend}>
            <span>{`${cents(minCsmdv)} (reliable)`}</span>
            <span className={style.gradient} style={{ background: LEGEND_GRADIENT }} />
            <span>{`${cents(maxCsmdv)} (not reliable)`}</span>
          </div>
        </CardContent>
      </Card>
      {groups.map(group => (
        <Card className={style.card} key={group.element}>
          <CardContent>
            <Typography variant="h6">
              {`${ELEMENT_NAMES[group.element] || group.element} (${group.atomIndices.length} atoms)`}
            </Typography>
            <Graph
              yData={group.yData}
              step={1} // Step is always 1 since x values are the analyzed atoms
              xAxisLabel={'Atom'}
              xTooltip={tooltips[group.element]}
              yAxisLabel={'Chemical shift (ppm)'}
              type={'dots'}
              xColors={group.xColors}
              onSelect={selectHandlers[group.element]}
              marks={marks[group.element]}
              fullPrecision={true}
            />
          </CardContent>
        </Card>
      ))}
      <ViewerSpawner
        newViewer={newViewer}
        // If the nailed/closed viewer is the current viewer then reset the selection
        onNail={handleCloseViewer}
        onClose={handleCloseViewer}
      />
    </Suspense>
  );
};

export default ChemicalShifts;
