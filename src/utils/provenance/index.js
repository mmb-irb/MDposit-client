import prettyBytes from 'pretty-bytes';

// Provenance of the simulation: the steps which produced the MD files and the files they read and wrote
// The steps common to all MDs come in the project metadata and the steps of this MD only come apart
// Files are identified by their cksum, so the same file read and written by several steps is a single node

// Roles of the MD files in the workflow, as they are named in the provenance
const MD_FILE_ROLES = [
  ['topology', 'Topology'],
  ['structure', 'Structure'],
  ['trajectories', 'Trajectory'],
];

// Check if there is provenance for this MD
export const hasProvenance = metadata => Boolean(metadata && metadata.PROVENANCE);

// Join the common and the MD specific parts of the provenance
// Every step remembers if it is common to all MDs or specific of this MD
export const joinProvenance = (projectPart, mdPart) => {
  const steps = new Map();
  const files = new Map();
  const addPart = (part, scope) => {
    if (!part) return;
    for (const step of part.steps) steps.set(step.id, { ...step, scope });
    for (const file of part.files) files.set(file.id, file);
  };
  addPart(projectPart, 'project');
  addPart(mdPart, 'md');
  // Find which files are the ones used by the MD
  // The same file may have several roles (e.g. a tpr used both as topology and structure)
  const mdFileRoles = new Map();
  const mdFiles = (mdPart && mdPart.md_files) || {};
  for (const [key, label] of MD_FILE_ROLES) {
    const value = mdFiles[key];
    if (!value) continue;
    for (const fileId of Array.isArray(value) ? value : [value]) {
      if (!mdFileRoles.has(fileId)) mdFileRoles.set(fileId, []);
      mdFileRoles.get(fileId).push(label);
    }
  }
  // Find which steps write and read every file
  const producers = new Map();
  const consumers = new Map();
  for (const step of steps.values()) {
    for (const fileId of step.outputs) {
      if (!producers.has(fileId)) producers.set(fileId, []);
      producers.get(fileId).push(step.id);
    }
    for (const fileId of step.inputs) {
      if (!consumers.has(fileId)) consumers.set(fileId, []);
      consumers.get(fileId).push(step.id);
    }
  }
  const provenance = { steps, files, mdFileRoles, producers, consumers };
  provenance.branchDepths = getBranchDepths(provenance);
  return provenance;
};

// Steps which are hidden by default
const isRedundant = step => Boolean(step.redundant);
const isBranch = step => Boolean(step.branch);
const isMain = step => !isRedundant(step) && !isBranch(step);

// Find the depth of every branch step, which is how many steps it is away from the main tree
// A branch step reading a file of the main tree (MD files included) has depth 1
// A branch step reading the output of a branch step of depth N has depth N + 1
// Thus the depth 0 means no branch at all and every depth makes the branches one step longer
export const getBranchDepths = ({ steps, mdFileRoles, producers }) => {
  // Find the files of the main tree by walking back from the MD files through the main steps
  const mainFiles = new Set(mdFileRoles.keys());
  let current = [...mainFiles];
  while (current.length > 0) {
    const next = [];
    for (const fileId of current) {
      for (const stepId of producers.get(fileId) || []) {
        const step = steps.get(stepId);
        if (!isMain(step)) continue;
        for (const inputId of step.inputs) {
          if (mainFiles.has(inputId)) continue;
          mainFiles.add(inputId);
          next.push(inputId);
        }
      }
    }
    current = next;
  }
  const branchDepths = new Map();
  const pending = [...steps.values()].filter(isBranch);
  let progress = true;
  while (pending.length > 0 && progress) {
    progress = false;
    for (let i = pending.length - 1; i >= 0; i--) {
      const step = pending[i];
      const inputDepths = step.inputs.map(inputId => {
        if (mainFiles.has(inputId)) return 1;
        const branchProducers = (producers.get(inputId) || [])
          .filter(stepId => branchDepths.has(stepId));
        if (branchProducers.length === 0) return null;
        return Math.min(...branchProducers.map(stepId => branchDepths.get(stepId))) + 1;
      }).filter(value => value !== null);
      if (inputDepths.length === 0) continue;
      branchDepths.set(step.id, Math.min(...inputDepths));
      pending.splice(i, 1);
      progress = true;
    }
  }
  // Branches with no link to the main tree start from scratch
  for (const step of pending) branchDepths.set(step.id, 1);
  return branchDepths;
};

// Get the depth of the longest branch
export const getMaxBranchDepth = ({ branchDepths }) => Math.max(0, ...branchDepths.values());

// Get the steps and files to be shown
// Redundant steps are shown only if asked
// Branches are shown only up to the requested depth
export const getVisibleProvenance = (provenance, { showRedundant, branchDepth }) => {
  const { steps, branchDepths } = provenance;
  const visibleSteps = [...steps.values()].filter(step => {
    if (isRedundant(step)) return showRedundant;
    if (isBranch(step)) return branchDepths.get(step.id) <= branchDepth;
    return true;
  });
  const visibleFileIds = new Set();
  for (const step of visibleSteps) {
    for (const fileId of step.inputs) visibleFileIds.add(fileId);
    for (const fileId of step.outputs) visibleFileIds.add(fileId);
  }
  // MD files are always shown
  for (const fileId of provenance.mdFileRoles.keys()) visibleFileIds.add(fileId);
  return { steps: visibleSteps, fileIds: [...visibleFileIds] };
};

// Get the ids of the nodes which are always shown, whatever the options are
// They are the MD files and the main steps with the files they read and write
export const getBackboneIds = ({ steps, mdFileRoles }) => {
  const ids = new Set(mdFileRoles.keys());
  for (const step of steps.values()) {
    if (!isMain(step)) continue;
    ids.add(step.id);
    for (const fileId of step.inputs) ids.add(fileId);
    for (const fileId of step.outputs) ids.add(fileId);
  }
  return ids;
};

// Get the node of the backbone which is at the top of the layout and then at the left
// It is used as a reference to keep the view in the same place when the layout changes
export const getAnchorNode = (layout, backboneIds) => layout.nodes
  .filter(node => backboneIds.has(node.id))
  .reduce((best, node) => {
    if (!best) return node;
    if (node.y !== best.y) return node.y < best.y ? node : best;
    return node.x < best.x ? node : best;
  }, null);

// Set the size of the nodes, which depends on their text
const CHARACTER_WIDTH = 7;
const STEP_HEIGHT = 44;
const FILE_HEIGHT = 26;
const NODE_PADDING = 24;
const HORIZONTAL_GAP = 24;
const LAYER_GAP = 56;
// Extra space above the layer where a workflow starts, to leave room for its name
const WORKFLOW_GAP = 48;

// Get the short name of the tool: the last word
// e.g. 'biobb_gromacs Grompp' -> 'Grompp'
export const getToolName = tool => tool.split(' ').slice(-1)[0];
// Get the package of the tool: everything but the last word
export const getToolPackage = tool => tool.split(' ').slice(0, -1).join(' ');

// Get the label of a file: its first name and how many other names it has
export const getFileLabel = file => file.names.length > 1
  ? `${file.names[0]} (+${file.names.length - 1})`
  : file.names[0];

// Names of the fields of the machine where a step ran, in the order they are shown
// Other fields are shown after these ones with their raw name
const ENVIRONMENT_FIELDS = [
  ['hostname', 'Host'],
  ['slurm_cluster_name', 'Cluster'],
  ['slurm_job_nodelist', 'Nodes'],
  ['operating_system', 'Operating system'],
  ['architecture', 'Architecture'],
  ['cpu_model', 'CPU'],
  ['cpu_count', 'CPUs'],
  ['memory_bytes', 'Memory'],
  ['python_version', 'Python'],
];
const ENVIRONMENT_LABELS = new Map(ENVIRONMENT_FIELDS);

// Get the rows to show the machine where a step ran: [label, value]
export const getEnvironmentRows = environment => {
  if (!environment) return [];
  const keys = [
    ...ENVIRONMENT_FIELDS.map(([key]) => key).filter(key => key in environment),
    ...Object.keys(environment).filter(key => !ENVIRONMENT_LABELS.has(key)),
  ];
  return keys.map(key => [
    ENVIRONMENT_LABELS.get(key) || key,
    key === 'memory_bytes' ? prettyBytes(Number(environment[key])) : String(environment[key]),
  ]);
};

// Get who ran the steps and where, without repeats
export const getRunSummary = steps => {
  const users = new Set();
  const machines = new Set();
  for (const step of steps) {
    if (step.user) users.add(step.user);
    const environment = step.environment || {};
    const host = environment.hostname;
    const cluster = environment.slurm_cluster_name;
    if (host) machines.add(cluster ? `${host} (${cluster})` : host);
  }
  return { users: [...users], machines: [...machines] };
};

// Place the nodes in layers from top to bottom, following the direction of the edges
// Edges spanning several layers go through dummy nodes, so they are taken into account when ordering
export const layoutProvenance = (provenance, visible) => {
  const { files, mdFileRoles } = provenance;
  // Set the nodes
  const nodes = new Map();
  for (const step of visible.steps) {
    const subtitle = [getToolPackage(step.tool), step.version].filter(Boolean).join(' ');
    const characters = Math.max(getToolName(step.tool).length + 2, subtitle.length);
    nodes.set(step.id, { id: step.id, type: 'step', width: characters * CHARACTER_WIDTH + NODE_PADDING,
      height: STEP_HEIGHT });
  }
  for (const fileId of visible.fileIds) {
    const file = files.get(fileId);
    const roles = mdFileRoles.get(fileId);
    const label = getFileLabel(file) + (roles ? ` ⇒ ${roles.join(', ')}` : '');
    nodes.set(fileId, { id: fileId, type: 'file', width: label.length * CHARACTER_WIDTH + NODE_PADDING,
      height: FILE_HEIGHT });
  }
  // Set the edges
  // A step which writes again one of its inputs would make a loop, so this edge is not drawn
  const edges = [];
  for (const step of visible.steps) {
    for (const fileId of step.inputs) edges.push({ source: fileId, target: step.id });
    for (const fileId of step.outputs) {
      if (step.inputs.includes(fileId)) continue;
      edges.push({ source: step.id, target: fileId });
    }
  }
  const successors = new Map([...nodes.keys()].map(id => [id, []]));
  const predecessors = new Map([...nodes.keys()].map(id => [id, []]));
  for (const edge of edges) {
    successors.get(edge.source).push(edge.target);
    predecessors.get(edge.target).push(edge.source);
  }
  // Sort the nodes so every node goes after the nodes pointing to it
  const order = [];
  const inDegree = new Map([...nodes.keys()].map(id => [id, predecessors.get(id).length]));
  const ready = [...nodes.keys()].filter(id => inDegree.get(id) === 0);
  while (ready.length > 0) {
    const id = ready.shift();
    order.push(id);
    for (const next of successors.get(id)) {
      inDegree.set(next, inDegree.get(next) - 1);
      if (inDegree.get(next) === 0) ready.push(next);
    }
  }
  // Nodes in a loop are added at the end, so they are still shown
  const ordered = new Set(order);
  for (const id of nodes.keys()) if (!ordered.has(id)) order.push(id);
  const position = new Map(order.map((id, index) => [id, index]));
  const isForward = (source, target) => position.get(source) < position.get(target);
  // Set the layer of every node: one below the lowest node pointing to it
  const layers = new Map();
  for (const id of order) {
    const previous = predecessors.get(id).filter(source => isForward(source, id));
    layers.set(id, previous.length === 0 ? 0 : Math.max(...previous.map(source => layers.get(source))) + 1);
  }
  // Move nodes down right above the highest node they point to, so edges are shorter
  // e.g. an input file read only by the last step is placed right above it
  for (const id of [...order].reverse()) {
    const next = successors.get(id).filter(target => isForward(id, target));
    if (next.length === 0) continue;
    layers.set(id, Math.max(layers.get(id), Math.min(...next.map(target => layers.get(target))) - 1));
  }
  // Split long edges with dummy nodes, one per layer in between
  const layerNodes = [];
  const addToLayer = (id, layer) => {
    while (layerNodes.length <= layer) layerNodes.push([]);
    layerNodes[layer].push(id);
  };
  for (const id of order) addToLayer(id, layers.get(id));
  const links = new Map([...nodes.keys()].map(id => [id, { up: [], down: [] }]));
  const routes = [];
  for (const edge of edges) {
    const { source, target } = edge;
    if (!isForward(source, target)) continue;
    const route = [source];
    for (let layer = layers.get(source) + 1; layer < layers.get(target); layer++) {
      const dummyId = `dummy-${source}-${target}-${layer}`;
      nodes.set(dummyId, { id: dummyId, type: 'dummy', width: 0, height: 0 });
      links.set(dummyId, { up: [], down: [] });
      layers.set(dummyId, layer);
      addToLayer(dummyId, layer);
      route.push(dummyId);
    }
    route.push(target);
    for (let i = 1; i < route.length; i++) {
      links.get(route[i - 1]).down.push(route[i]);
      links.get(route[i]).up.push(route[i - 1]);
    }
    routes.push({ ...edge, route });
  }
  // Order the nodes in every layer by the average position of their neighbours
  // Sweep down and up several times to reduce the edge crossings
  const indexes = new Map();
  const updateIndexes = layer => layer.forEach((id, index) => indexes.set(id, index));
  layerNodes.forEach(updateIndexes);
  const sortLayer = (layer, direction) => {
    const barycenters = new Map(layer.map(id => {
      const neighbours = links.get(id)[direction];
      if (neighbours.length === 0) return [id, indexes.get(id)];
      return [id, neighbours.reduce((sum, other) => sum + indexes.get(other), 0) / neighbours.length];
    }));
    layer.sort((a, b) => barycenters.get(a) - barycenters.get(b));
    updateIndexes(layer);
  };
  for (let sweep = 0; sweep < 8; sweep++) {
    if (sweep % 2 === 0) layerNodes.slice(1).forEach(layer => sortLayer(layer, 'up'));
    else layerNodes.slice(0, -1).reverse().forEach(layer => sortLayer(layer, 'down'));
  }
  // Set the horizontal positions
  // Start with the nodes side by side and then move every node towards its neighbours without overlapping
  const xs = new Map();
  for (const layer of layerNodes) {
    let x = 0;
    for (const id of layer) {
      const width = nodes.get(id).width;
      xs.set(id, x + width / 2);
      x += width + HORIZONTAL_GAP;
    }
  }
  const placeLayer = (layer, direction) => {
    // Find where every node would like to be
    const wanted = layer.map(id => {
      const neighbours = links.get(id)[direction];
      if (neighbours.length === 0) return xs.get(id);
      return neighbours.reduce((sum, other) => sum + xs.get(other), 0) / neighbours.length;
    });
    // Place them in order without overlapping, from left to right and then from right to left
    const placed = [...wanted];
    const minimumDistance = (a, b) => (nodes.get(a).width + nodes.get(b).width) / 2 + HORIZONTAL_GAP;
    for (let i = 1; i < layer.length; i++)
      placed[i] = Math.max(placed[i], placed[i - 1] + minimumDistance(layer[i - 1], layer[i]));
    // Shift the whole layer back so it is centered where its nodes wanted to be
    const shift = (wanted.reduce((a, b) => a + b, 0) - placed.reduce((a, b) => a + b, 0)) / layer.length;
    layer.forEach((id, i) => xs.set(id, placed[i] + shift));
  };
  for (let sweep = 0; sweep < 8; sweep++) {
    if (sweep % 2 === 0) layerNodes.slice(1).forEach(layer => placeLayer(layer, 'up'));
    else layerNodes.slice(0, -1).reverse().forEach(layer => placeLayer(layer, 'down'));
  }
  // Set the vertical positions
  // Every layer is as tall as its tallest node
  // Layers where a workflow starts (but the first one) are moved down to leave room for its name
  const workflowOf = new Map(visible.steps.map(step => [step.id, step.workflow]));
  const seenWorkflows = new Set();
  const ys = [];
  let y = 0;
  for (const layer of layerNodes) {
    const starting = new Set(layer.filter(id => workflowOf.has(id)).map(id => workflowOf.get(id))
      .filter(workflow => !seenWorkflows.has(workflow)));
    if (starting.size > 0 && seenWorkflows.size > 0) y += WORKFLOW_GAP;
    starting.forEach(workflow => seenWorkflows.add(workflow));
    const height = Math.max(FILE_HEIGHT, ...layer.map(id => nodes.get(id).height));
    ys.push(y + height / 2);
    y += height + LAYER_GAP;
  }
  // Move everything so the left border is at 0
  const left = Math.min(...[...nodes.values()].map(node => xs.get(node.id) - node.width / 2));
  const right = Math.max(...[...nodes.values()].map(node => xs.get(node.id) + node.width / 2));
  for (const node of nodes.values()) {
    node.x = xs.get(node.id) - left;
    node.y = ys[layers.get(node.id)];
  }
  // Set the points of every edge, from the bottom of the source to the top of the target
  const paths = routes.map(({ source, target, route }) => {
    const points = route.map(id => [nodes.get(id).x, nodes.get(id).y]);
    points[0] = [points[0][0], points[0][1] + nodes.get(source).height / 2];
    const last = points.length - 1;
    points[last] = [points[last][0], points[last][1] - nodes.get(target).height / 2];
    return { source, target, points };
  });
  const realNodes = [...nodes.values()].filter(node => node.type !== 'dummy');
  return { nodes: realNodes, edges: paths, width: right - left, height: Math.max(0, y - LAYER_GAP) };
};
