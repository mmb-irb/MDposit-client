// Inject the reduced membrane atom subset in the components
// Every component sharing the main component topology gets the subset, since they all share the same
// (reduced) topology and their trajectories must match it
// Components with their own topology or atom subset are left as they are
export const getMembraneReducedComponents = (components, atomIndices) => {
  const mainTopologyURL = components[0].topologyURL;
  return components.map(comp => {
    if (comp.topologyURL !== mainTopologyURL) return comp;
    if (comp.atomIndices || comp.resIndices || comp.chainIndices || comp.atomSelection) return comp;
    return { ...comp, atomIndices };
  });
};
