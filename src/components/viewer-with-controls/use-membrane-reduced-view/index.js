import { useState, useCallback, useMemo, useEffect } from 'react';

import getDefaultRepresentations from '../../../utils/topology-manager/get-default-reprensetations';
import { getMembraneReducedComponents } from '../membrane-reduced-components';

// Reduced membrane view
// For heavy membrane trajectories (lots of lipid tails, water, ions), load only protein/solute +
// membrane headgroups. Lives here rather than in the parent page / Domains so toggling reloads only
// the viewer's data (via the ManagedViewer remount, see viewerReloadKey) instead of the whole page.
// It is available in every viewer, so the system looks the same in every page.
//
// Inputs:
//   topology, metadata: from the project
//   components: the viewer components, before applying the reduced view
//   representations, setRepresentations: the representations state, which this hook keeps in sync with the view
//   defaultRepresentations: the default representations of the topology (undefined until it is ready)
//
// Returns:
//   canReduceMembrane: whether the reduced view is available (shows the toggle)
//   membraneReduced, setMembraneReduced: the current mode and its setter (called with a function updater)
//   waitForTopology: whether the viewer must not mount before the topology is ready
//   effectiveComponents: the components to load (with the reduced atom subset when the view is on)
//   viewerReloadKey: key to remount the viewer when the mode changes
const useMembraneReducedView = ({
  topology,
  metadata,
  components: finalComponents,
  representations: finalRepresentations,
  setRepresentations: setFinalRepresentations,
  defaultRepresentations,
}) => {
  // The reduced atom subset for this topology, or null when it is not a membrane simulation
  const membraneSelection = topology && topology.membraneViewerSelection;
  // Components already restricted to a subset of atoms (e.g. PCA projections) are not reduced
  const firstComponent = finalComponents && finalComponents[0];
  const isSubsetComponent = !!firstComponent && !!(firstComponent.atomIndices
    || firstComponent.resIndices || firstComponent.chainIndices || firstComponent.atomSelection);
  // Whether the reduced view is available at all (an actual membrane simulation with the whole system)
  const canReduceMembrane = !!membraneSelection && !isSubsetComponent;
  // Default on for very large membranes, where loading every lipid atom is too heavy
  // Read from the metadata (the same value as topology.lipidAtomsCount), so it is known before the topology
  const membraneReducedDefault = !!(metadata && metadata.LIPIATS > 100000);
  // The viewer must wait for the topology only when it may start in the reduced view, since the atom subset
  // to download comes from it. Otherwise the viewer starts at once and downloads the structure and the
  // trajectory while the topology is still downloading: the reduced view is off until the user asks for it.
  const waitForTopology = membraneReducedDefault && !isSubsetComponent;
  // Store only the user's explicit choice (null until they toggle) and derive the effective value,
  // so it stays correct as soon as the topology (and its default) arrives.
  const [membraneReducedOverride, setMembraneReducedOverride] = useState(null);
  const membraneReduced = canReduceMembrane && (membraneReducedOverride ?? membraneReducedDefault);
  // Toggle setter passed to SettingsControls (it always calls it with a function updater).
  // Resolve the null "untouched" override to the effective default before handing it to the updater.
  const setMembraneReduced = useCallback(updater =>
    setMembraneReducedOverride(previous => updater(previous ?? membraneReducedDefault)),
    [membraneReducedDefault]);

  // The default representations restricted to the reduced subset, with the membrane as spacefill
  const membraneReducedRepresentations = useMemo(() => {
    if (!canReduceMembrane) return null;
    return getDefaultRepresentations(topology, membraneSelection.residueIndices).map(representation =>
      representation.name.toLowerCase().includes('lipid')
        ? { ...representation, type: 'spacefill', opacity: 0.3 }
        : representation);
  }, [canReduceMembrane, topology, membraneSelection]);

  // Selections of the default lipid representations
  // Representations with these selections show lipids, even if pages customize them (e.g. color)
  const lipidSelections = useMemo(() => {
    if (!canReduceMembrane || !defaultRepresentations) return null;
    return new Set(defaultRepresentations
      .filter(representation => representation.name.toLowerCase().includes('lipid'))
      .map(representation => representation.selection));
  }, [canReduceMembrane, defaultRepresentations]);

  // Keep representations in sync with the reduced view.
  // Default representations (e.g. Domains always emits the FULL default set for "Overall") are swapped
  // to the reduced set (and back) on toggle or re-selection. We match by name + selection + type (the
  // fields distinguishing the two default sets) so other domains and manual edits (opacity, color, show)
  // are left alone.
  // Other representations (e.g. default representations recolored by an analysis page) are kept, but
  // lipid representations are shown as low-opacity spacefill, since only lipid headgroups are loaded.
  // Their original type and opacity are saved to restore them when the full view is back.
  useEffect(() => {
    if (!canReduceMembrane) return;
    if (!finalRepresentations || !defaultRepresentations || !membraneReducedRepresentations) return;
    const repsMatch = (reps, other) =>
      reps.length === other.length && reps.every((rep, r) =>
        rep.name === other[r].name
        && rep.selection === other[r].selection
        && rep.type === other[r].type);
    const currentIsFull = repsMatch(finalRepresentations, defaultRepresentations);
    const currentIsReduced = repsMatch(finalRepresentations, membraneReducedRepresentations);
    // Swap default sets, only when they are not already in the toggled mode
    if (currentIsFull || currentIsReduced) {
      if (membraneReduced ? currentIsReduced : currentIsFull) return;
      const target = membraneReduced ? membraneReducedRepresentations : defaultRepresentations;
      setFinalRepresentations(target.map(rep => ({ ...rep })));
      return;
    }
    // Adapt lipid representations in any other set
    let changed = false;
    const adapted = finalRepresentations.map(rep => {
      if (membraneReduced && !rep.unreducedStyle && lipidSelections.has(rep.selection)) {
        changed = true;
        return {
          ...rep,
          type: 'spacefill',
          opacity: 0.3,
          unreducedStyle: { type: rep.type, opacity: rep.opacity },
        };
      }
      if (!membraneReduced && rep.unreducedStyle) {
        changed = true;
        const { unreducedStyle, ...restored } = rep;
        return { ...restored, ...unreducedStyle };
      }
      return rep;
    });
    if (changed) setFinalRepresentations(adapted);
  }, [
    canReduceMembrane,
    membraneReduced,
    finalRepresentations,
    defaultRepresentations,
    membraneReducedRepresentations,
    lipidSelections,
    setFinalRepresentations,
  ]);

  // The components actually loaded by the viewer. When the reduced view is on we inject the reduced
  // atom subset into the main component (and the ones sharing its topology) so only those atoms are
  // downloaded and displayed.
  const effectiveComponents = useMemo(() => {
    if (!finalComponents || !membraneReduced) return finalComponents;
    return getMembraneReducedComponents(finalComponents, membraneSelection.atomIndices);
  }, [finalComponents, membraneReduced, membraneSelection]);

  // Key remounting the ManagedViewer to reload the data when the atom subset changes (i.e. on toggle).
  // WARNING: depend only on the membrane mode, never on finalComponents. Keying on the components would
  // flip on the initial null -> ready transition and remount mid-load; useViewerData transitively holds
  // useAPI subscriptions (fileDescriptors) that a remount tears down and can't re-establish
  // while a request is in flight, leaving fileDescriptors stuck loading so the trajectory never downloads.
  const viewerReloadKey = membraneReduced ? 'membrane-reduced' : 'full';

  return {
    canReduceMembrane,
    membraneReduced,
    setMembraneReduced,
    waitForTopology,
    effectiveComponents,
    viewerReloadKey,
  };
};

export default useMembraneReducedView;
