import {
  getAnchorNode,
  getBackboneIds,
  getEnvironmentRows,
  getRunSummary,
  getMaxBranchDepth,
  getVisibleProvenance,
  hasProvenance,
  joinProvenance,
  layoutProvenance,
} from '.';

// A small provenance: a setup common to all MDs and the production of this MD
// 'image' only writes again its input and 'check' and 'view' do not lead to the MD files
const file = (id, name) => ({ id, names: [name], size: 100 });
const step = (id, inputs, outputs, extra = {}) => ({
  id, tool: `biobb ${id}`, status: 'recorded', inputs, outputs, parameters: {}, ...extra });
const projectPart = {
  steps: [
    step('build', ['raw'], ['system'], { workflow: 'Setup' }),
    step('image', ['system'], ['system'], { workflow: 'Setup', redundant: true }),
    step('check', ['system'], ['report'], { workflow: 'Setup', branch: true }),
    step('tpr', ['system', 'mdp'], ['topology'], { workflow: 'Setup' }),
  ],
  files: [file('raw', 'raw.pdb'), file('system', 'system.gro'), file('report', 'report.txt'),
    file('mdp', 'md.mdp'), file('topology', 'md.tpr')],
};
const mdPart = {
  steps: [
    step('run', ['topology'], ['trajectory'], { workflow: 'Production', user: 'Jane Doe',
      environment: { cpu_count: 64, hostname: 'node1', slurm_cluster_name: 'cluster', memory_bytes: 2048, gpu: 'A100' } }),
    step('view', ['trajectory'], ['view'], { workflow: 'Production', branch: true }),
    step('view2', ['view'], ['view2'], { workflow: 'Production', branch: true }),
  ],
  files: [file('trajectory', 'md.xtc'), file('view', 'view.xtc'), file('view2', 'view2.xtc')],
  md_files: { topology: 'topology', structure: 'topology', trajectories: ['trajectory'] },
};

describe('provenance', () => {
  it('is available only when the metadata has it', () => {
    expect(hasProvenance({ PROVENANCE: projectPart })).toBe(true);
    expect(hasProvenance({})).toBe(false);
  });

  it('joins the common and the MD steps', () => {
    const provenance = joinProvenance(projectPart, mdPart);
    expect(provenance.steps.size).toBe(7);
    expect(provenance.steps.get('build').scope).toBe('project');
    expect(provenance.steps.get('run').scope).toBe('md');
    expect(provenance.mdFileRoles.get('topology')).toEqual(['Topology', 'Structure']);
    expect(provenance.producers.get('trajectory')).toEqual(['run']);
  });

  it('finds how many steps every branch step is away from the main tree', () => {
    const provenance = joinProvenance(projectPart, mdPart);
    // 'view' reads the trajectory, which is an MD file
    expect(provenance.branchDepths.get('view')).toBe(1);
    // 'view2' reads the output of 'view', so it is one step further
    expect(provenance.branchDepths.get('view2')).toBe(2);
    // 'check' reads the system, which is in the main tree
    expect(provenance.branchDepths.get('check')).toBe(1);
    expect(getMaxBranchDepth(provenance)).toBe(2);
  });

  it('hides the redundant steps and the branches by default', () => {
    const provenance = joinProvenance(projectPart, mdPart);
    const ids = options => getVisibleProvenance(provenance, options).steps.map(step => step.id).sort();
    expect(ids({ showRedundant: false, branchDepth: 0 })).toEqual(['build', 'run', 'tpr']);
    expect(ids({ showRedundant: true, branchDepth: 0 })).toEqual(['build', 'image', 'run', 'tpr']);
    expect(ids({ showRedundant: false, branchDepth: 1 })).toEqual(['build', 'check', 'run', 'tpr', 'view']);
    expect(ids({ showRedundant: false, branchDepth: 2 })).toEqual(['build', 'check', 'run', 'tpr', 'view', 'view2']);
    // Files of hidden steps are hidden too
    const fileIds = getVisibleProvenance(provenance, { showRedundant: false, branchDepth: 0 }).fileIds;
    expect(fileIds).not.toContain('report');
  });

  it('places every node below the nodes pointing to it', () => {
    const provenance = joinProvenance(projectPart, mdPart);
    const visible = getVisibleProvenance(provenance, { showRedundant: true, branchDepth: 2 });
    const layout = layoutProvenance(provenance, visible);
    const y = new Map(layout.nodes.map(node => [node.id, node.y]));
    for (const edge of layout.edges) expect(y.get(edge.source)).toBeLessThan(y.get(edge.target));
    // The step writing again its input has no edge to it, so there is no loop
    expect(layout.edges.some(edge => edge.source === 'image')).toBe(false);
    // Input files are placed right above the step reading them, not in the first layer
    expect(y.get('mdp')).toBe(y.get('system'));
    expect(y.get('mdp')).toBeGreaterThan(y.get('raw'));
    // Nodes in the same layer do not overlap
    const byLayer = new Map();
    for (const node of layout.nodes) {
      if (!byLayer.has(node.y)) byLayer.set(node.y, []);
      byLayer.get(node.y).push(node);
    }
    for (const nodes of byLayer.values()) {
      nodes.sort((a, b) => a.x - b.x);
      for (let i = 1; i < nodes.length; i++)
        expect(nodes[i].x - nodes[i].width / 2).toBeGreaterThanOrEqual(nodes[i - 1].x + nodes[i - 1].width / 2);
    }
  });

  it('finds the backbone and its top left node, which is in every layout', () => {
    const provenance = joinProvenance(projectPart, mdPart);
    const backbone = getBackboneIds(provenance);
    expect([...backbone].sort()).toEqual(['build', 'mdp', 'raw', 'run', 'system', 'topology', 'tpr', 'trajectory']);
    const layouts = [{ showRedundant: false, branchDepth: 0 }, { showRedundant: true, branchDepth: 2 }]
      .map(options => layoutProvenance(provenance, getVisibleProvenance(provenance, options)));
    const anchors = layouts.map(layout => getAnchorNode(layout, backbone));
    expect(anchors[0].id).toBe(anchors[1].id);
    expect(anchors[0].y).toBe(Math.min(...layouts[0].nodes.filter(node => backbone.has(node.id)).map(node => node.y)));
  });

  it('shows who ran the steps and where', () => {
    const provenance = joinProvenance(projectPart, mdPart);
    expect(getRunSummary([...provenance.steps.values()])).toEqual({ users: ['Jane Doe'], machines: ['node1 (cluster)'] });
    expect(getEnvironmentRows(provenance.steps.get('run').environment)).toEqual([
      ['Host', 'node1'], ['Cluster', 'cluster'], ['CPUs', '64'], ['Memory', '2.05 kB'], ['gpu', 'A100']]);
    expect(getEnvironmentRows(undefined)).toEqual([]);
  });
});
