import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';

import useMembraneReducedView from '.';

// The reduced default representations come from the topology manager, which needs a real topology
vi.mock('../../../utils/topology-manager/get-default-reprensetations', () => ({
  default: vi.fn(),
}));
import getDefaultRepresentations from '../../../utils/topology-manager/get-default-reprensetations';

const defaultRepresentations = [
  { name: 'protein', selection: ':A', type: 'cartoon', opacity: 1 },
  { name: 'lipid', selection: ':L', type: 'licorice', opacity: 1 },
];
const reducedDefaults = [
  { name: 'protein', selection: ':A and @0-9', type: 'cartoon', opacity: 1 },
  { name: 'lipid', selection: ':L and @0-9', type: 'licorice', opacity: 1 },
];
const membraneSelection = { atomIndices: [0, 1, 2], residueIndices: [0] };
const membraneTopology = { membraneViewerSelection: membraneSelection };
const components = [{ name: 'main', topologyURL: '/structure' }];

// Hold the representations state, as the viewer does
const useHarness = ({ topology, metadata = {}, components: comps = components, start = defaultRepresentations }) => {
  const [representations, setRepresentations] = useState(start);
  const view = useMembraneReducedView({
    topology, metadata, components: comps, representations, setRepresentations, defaultRepresentations,
  });
  return { ...view, representations };
};

describe('useMembraneReducedView', () => {
  beforeEach(() => { getDefaultRepresentations.mockReturnValue(reducedDefaults) });

  it('is unavailable without a membrane', () => {
    const { result } = renderHook(() => useHarness({ topology: { membraneViewerSelection: null } }));
    expect(result.current.canReduceMembrane).toBe(false);
    expect(result.current.membraneReduced).toBe(false);
    expect(result.current.effectiveComponents).toBe(components);
    expect(result.current.viewerReloadKey).toBe('full');
  });

  it('waits for the topology only when the reduced view is on by default', () => {
    const wait = metadata => renderHook(() => useHarness({ topology: undefined, metadata })).result.current.waitForTopology;
    expect(wait({ LIPIATS: 100000 })).toBe(false);
    expect(wait({ LIPIATS: 100001 })).toBe(true);
  });

  it('does not wait for the topology when the components are already an atom subset', () => {
    const subset = [{ name: 'pca', topologyURL: '/structure', atomIndices: [1, 2] }];
    const { result } = renderHook(() => useHarness({
      topology: undefined, metadata: { LIPIATS: 200000 }, components: subset,
    }));
    expect(result.current.waitForTopology).toBe(false);
  });

  it('starts reduced by default for very large membranes', () => {
    const { result } = renderHook(() => useHarness({ topology: membraneTopology, metadata: { LIPIATS: 200000 } }));
    expect(result.current.membraneReduced).toBe(true);
    expect(result.current.viewerReloadKey).toBe('membrane-reduced');
    expect(result.current.effectiveComponents[0].atomIndices).toEqual([0, 1, 2]);
  });

  it('toggles the atom subset and swaps the default representations', () => {
    const { result } = renderHook(() => useHarness({ topology: membraneTopology }));
    expect(result.current.membraneReduced).toBe(false);
    expect(result.current.representations).toEqual(defaultRepresentations);

    act(() => result.current.setMembraneReduced(reduced => !reduced));
    expect(result.current.membraneReduced).toBe(true);
    expect(result.current.effectiveComponents[0].atomIndices).toEqual([0, 1, 2]);
    expect(result.current.representations).toEqual([
      reducedDefaults[0],
      { ...reducedDefaults[1], type: 'spacefill', opacity: 0.3 },
    ]);

    act(() => result.current.setMembraneReduced(reduced => !reduced));
    expect(result.current.membraneReduced).toBe(false);
    expect(result.current.representations).toEqual(defaultRepresentations);
  });

  it('shows lipids of customized representations as spacefill and restores them', () => {
    const custom = [
      { name: 'protein', selection: ':A', type: 'cartoon', opacity: 1, color: 'red' },
      { name: 'lipid', selection: ':L', type: 'licorice', opacity: 0.8, color: 'red' },
      { name: 'ligand', selection: ':X', type: 'ball+stick', opacity: 1, color: 'red' },
    ];
    const { result } = renderHook(() => useHarness({ topology: membraneTopology, start: custom }));
    act(() => result.current.setMembraneReduced(reduced => !reduced));
    // Not a default set, so the representations are kept and only the lipids are adapted
    expect(result.current.representations[0]).toEqual(custom[0]);
    expect(result.current.representations[2]).toEqual(custom[2]);
    expect(result.current.representations[1]).toMatchObject({
      type: 'spacefill', opacity: 0.3, unreducedStyle: { type: 'licorice', opacity: 0.8 },
    });
    act(() => result.current.setMembraneReduced(reduced => !reduced));
    expect(result.current.representations).toEqual(custom);
  });
});
