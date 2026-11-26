import { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { event, select, zoom, zoomIdentity, zoomTransform } from 'd3';
import prettyBytes from 'pretty-bytes';

// Project data context
import { ProjectCtx } from '../../../contexts';

// Visual components
import Card from '../../../components/animated-card';
import { CardContent, Chip, FormControlLabel, Slider, Switch } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import {
  getAnchorNode,
  getBackboneIds,
  getEnvironmentRows,
  getFileLabel,
  getMaxBranchDepth,
  getRunSummary,
  getToolName,
  getToolPackage,
  getVisibleProvenance,
  joinProvenance,
  layoutProvenance,
} from '../../../utils/provenance';

// CSS style
import style from './style.module.css';

// Set the explanations of the step flags
const RECORDED_EXPLANATION = 'Recorded afterwards from its outputs (BioBB restart), so its execution times are unknown';
const REDUNDANT_EXPLANATION = 'All its outputs are identical to some of its inputs';
const BRANCH_EXPLANATION = 'Its outputs do not lead to the files of this MD';

// Distance (in graph units) the view may go beyond the edges of the graph
const PAN_MARGIN = 100;

// Get a vertical curve through all the points of an edge
const getEdgePath = points => {
  let path = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const middle = (y0 + y1) / 2;
    path += ` C${x0},${middle} ${x1},${middle} ${x1},${y1}`;
  }
  return path;
};

// Distance (in graph units) from the separator of a workflow to the first node below it
// The layout leaves extra space above these nodes (WORKFLOW_GAP) so the name of the workflow fits
const SEPARATOR_GAP = 56;
// Palettes of the theme the sections of the workflows alternate between
const SECTION_PALETTES = ['primary', 'secondary'];

// Distance (in graph units) the backgrounds and lines of the workflows reach, so they fill the whole view
const SECTION_EXTENT = 100000;
// Opacity of the background colour of the workflow sections
const SECTION_OPACITY = 0.18;
// Size and distances (in pixels) of the floating chip with the name of the workflow
const CHIP_HEIGHT = 24;
const CHIP_MARGIN = 8;
const CHIP_OFFSET = 6;

// Get the separators of the workflows: a line above the first step of every workflow, with its name
// The first one has no line, only the name
// Workflows starting at the same height share the separator
// The first separator goes above the whole graph, so the first inputs belong to the first workflow
const getWorkflowSeparators = (provenance, layout) => {
  const firstTops = new Map();
  for (const node of layout.nodes) {
    if (node.type !== 'step') continue;
    const workflow = provenance.steps.get(node.id).workflow;
    const top = node.y - node.height / 2;
    if (!firstTops.has(workflow) || top < firstTops.get(workflow)) firstTops.set(workflow, top);
  }
  const byTop = new Map();
  for (const [workflow, top] of firstTops) {
    if (!byTop.has(top)) byTop.set(top, []);
    byTop.get(top).push(workflow || 'No workflow');
  }
  const separators = [...byTop.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([top, names]) => ({ y: top - SEPARATOR_GAP, label: names.join(', ') }));
  if (separators.length > 0) {
    const graphTop = Math.min(...layout.nodes.map(node => node.y - node.height / 2));
    separators[0].y = graphTop - SEPARATOR_GAP;
  }
  return separators;
};

// The graph of steps and files, which may be zoomed and dragged
const ProvenanceGraph = ({ provenance, layout, backboneIds, selected, onSelect }) => {
  const theme = useTheme();
  const svgRef = useRef(null);
  const groupRef = useRef(null);
  const zoomRef = useRef(null);
  const previousLayoutRef = useRef(null);
  // Current position of the view, to place the floating names of the workflows
  const [transform, setTransform] = useState(zoomIdentity);

  // Set the zoom: the mouse wheel scrolls and the mouse wheel with control (or command) zooms
  // Layout effects are used so the view is already in place when the new graph is painted
  useLayoutEffect(() => {
    const svg = select(svgRef.current);
    const graphZoom = zoom()
      .scaleExtent([0.1, 3])
      .extent(() => [[0, 0], [svgRef.current.clientWidth, svgRef.current.clientHeight]])
      .filter(() => !event.button && event.type !== 'wheel')
      .on('zoom', () => {
        select(groupRef.current).attr('transform', event.transform);
        setTransform(event.transform);
      });
    svg.call(graphZoom);
    svg.on('wheel', () => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        graphZoom.scaleBy(svg, Math.pow(2, -event.deltaY * 0.002), [event.offsetX, event.offsetY]);
      } else {
        const scale = zoomTransform(svgRef.current).k;
        graphZoom.translateBy(svg, -event.deltaX / scale, -event.deltaY / scale);
      }
    });
    zoomRef.current = graphZoom;
    return () => svg.on('.zoom', null).on('wheel', null);
  }, []);

  // Do not allow to move further than a margin away from the graph, so it can never get lost
  useLayoutEffect(() => {
    zoomRef.current.translateExtent([
      [-PAN_MARGIN, -PAN_MARGIN],
      [layout.width + PAN_MARGIN, layout.height + PAN_MARGIN],
    ]);
  }, [layout]);

  // Fit the graph width in the view, starting from the top
  const fit = () => {
    const svg = select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const margin = 20;
    // The top margin leaves room for the name of the first workflow
    const topMargin = CHIP_MARGIN + CHIP_HEIGHT + 12;
    const scale = Math.min(1, (width - 2 * margin) / layout.width);
    const x = (width - layout.width * scale) / 2;
    svg.call(zoomRef.current.transform, zoomIdentity.translate(x, topMargin).scale(scale));
  };
  // Move the view so the anchor node (the highest and leftmost node of the backbone) stays where it was
  // The anchor of the previous layout is always in the new one since the backbone is always shown
  // Moving by 0 makes the zoom to keep the view inside the limits
  const keepPosition = previousLayout => {
    const svg = select(svgRef.current);
    const previousAnchor = getAnchorNode(previousLayout, backboneIds);
    const anchor = previousAnchor && layout.nodes.find(node => node.id === previousAnchor.id);
    if (!anchor) return fit();
    const { x, y, k } = zoomTransform(svgRef.current);
    const screenX = x + k * previousAnchor.x;
    const screenY = y + k * previousAnchor.y;
    svg.call(zoomRef.current.transform, zoomIdentity.translate(screenX - k * anchor.x, screenY - k * anchor.y).scale(k));
    svg.call(zoomRef.current.translateBy, 0, 0);
  };
  // Fit the first graph and keep the position in the next ones
  useLayoutEffect(() => {
    const previousLayout = previousLayoutRef.current;
    previousLayoutRef.current = layout;
    if (previousLayout) keepPosition(previousLayout);
    else fit();
  }, [layout]);

  // Find the edges of the selected node
  const isSelectedEdge = edge => edge.source === selected || edge.target === selected;
  const edgeColor = theme.palette.text.disabled;
  const selectedEdgeColor = theme.palette.primary.main;
  const separators = getWorkflowSeparators(provenance, layout);

  return (
    <div className={style['graph-container']}>
      <svg ref={svgRef} className={style.graph} onClick={() => onSelect(null)}>
        <defs>
          {[['arrow', edgeColor], ['arrow-selected', selectedEdgeColor]].map(([id, fill]) => (
            <marker key={id} id={id} viewBox="0 0 10 10" refX="10" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={fill} />
            </marker>
          ))}
        </defs>
        <g ref={groupRef}>
          {separators.map(({ y }, index) => {
            const bottom = index + 1 < separators.length ? separators[index + 1].y : SECTION_EXTENT;
            const palette = theme.palette[SECTION_PALETTES[index % SECTION_PALETTES.length]];
            return (
              <rect
                key={y}
                x={-SECTION_EXTENT} width={2 * SECTION_EXTENT}
                y={index === 0 ? -SECTION_EXTENT : y} height={bottom - (index === 0 ? -SECTION_EXTENT : y)}
                fill={palette.main} fillOpacity={SECTION_OPACITY}
              />
            );
          })}
          {separators.slice(1).map(({ y }, index) => (
            <line
              key={y}
              x1={-SECTION_EXTENT} x2={SECTION_EXTENT} y1={y} y2={y}
              stroke={theme.palette[SECTION_PALETTES[(index + 1) % SECTION_PALETTES.length]].main}
              strokeWidth={2} strokeDasharray="8 6"
            />
          ))}
          {layout.edges.map(edge => {
            const isSelected = isSelectedEdge(edge);
            return (
              <path
                key={`${edge.source}-${edge.target}`}
                d={getEdgePath(edge.points)}
                fill="none"
                stroke={isSelected ? selectedEdgeColor : edgeColor}
                strokeWidth={isSelected ? 2.5 : 1.2}
                markerEnd={`url(#${isSelected ? 'arrow-selected' : 'arrow'})`}
              />
            );
          })}
          {layout.nodes.map(node => {
            const isSelected = node.id === selected;
            const onClick = clickEvent => {
              clickEvent.stopPropagation();
              onSelect(node.id);
            };
            const left = node.x - node.width / 2;
            const top = node.y - node.height / 2;
            if (node.type === 'step') {
              const step = provenance.steps.get(node.id);
              const isHiddenByDefault = step.redundant || step.branch;
              return (
                <g key={node.id} className={style.node} onClick={onClick}>
                  <title>{step.tool}</title>
                  <rect
                    x={left} y={top} width={node.width} height={node.height} rx={6}
                    fill={theme.palette.background.paper}
                    stroke={step.redundant ? theme.palette.error.main : theme.palette.text.secondary}
                    strokeWidth={isSelected ? 3.5 : 1.5}
                    strokeDasharray={isHiddenByDefault ? '6 4' : null}
                    opacity={isHiddenByDefault ? 0.8 : 1}
                  />
                  <text x={node.x} y={node.y - 4} textAnchor="middle" className={style['step-name']}
                    fill={theme.palette.text.primary}>
                    {getToolName(step.tool)}
                  </text>
                  <text x={node.x} y={node.y + 13} textAnchor="middle" className={style['step-package']}
                    fill={theme.palette.text.secondary}>
                    {[getToolPackage(step.tool), step.version].filter(Boolean).join(' ')}
                  </text>
                </g>
              );
            }
            const file = provenance.files.get(node.id);
            const roles = provenance.mdFileRoles.get(node.id);
            return (
              <g key={node.id} className={style.node} onClick={onClick}>
                <title>{file.names.join('\n')}</title>
                <rect
                  x={left} y={top} width={node.width} height={node.height} rx={node.height / 2}
                  fill={roles ? theme.palette.warning.light : theme.palette.background.paper}
                  stroke={roles ? theme.palette.warning.dark : theme.palette.text.disabled}
                  strokeWidth={isSelected ? 3.5 : roles ? 2.5 : 1}
                />
                <text x={node.x} y={node.y + 4} textAnchor="middle" className={style['file-name']}
                  fill={roles ? theme.palette.warning.contrastText : theme.palette.text.primary}>
                  {getFileLabel(file) + (roles ? ` ⇒ ${roles.join(', ')}` : '')}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {separators.map(({ y, label }, index) => {
        // The chip goes right below its line and stays at the top of the view when scrolling down
        // until the line of the next workflow pushes it away
        const lineY = transform.y + transform.k * y;
        let top = Math.max(lineY + CHIP_OFFSET, CHIP_MARGIN);
        const next = separators[index + 1];
        if (next) top = Math.min(top, transform.y + transform.k * next.y - CHIP_HEIGHT - CHIP_OFFSET);
        return (
          <Chip key={y} size="small" label={label} className={style['workflow-chip']}
            color={SECTION_PALETTES[index % SECTION_PALETTES.length]}
            style={{ top, left: CHIP_MARGIN, height: CHIP_HEIGHT }} />
        );
      })}
    </div>
  );
};

// A clickable reference to a file or a step in the details
const NodeLink = ({ id, label, onSelect }) => (
  <button type="button" className={style['node-link']} onClick={() => onSelect(id)}>{label}</button>
);

// Show the value of a parameter
// Parameters with several values (e.g. the parameters of an mdp file) are shown in a table
const ParameterValue = ({ value }) => {
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    return (
      <details>
        <summary>{entries.length} parameters</summary>
        <table className={style.parameters}>
          <tbody>
            {entries.map(([key, subvalue]) => (
              <tr key={key}><td>{key}</td><td>{String(subvalue)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    );
  }
  return String(value);
};

// Show the details of the selected step
const StepDetails = ({ provenance, step, onSelect }) => {
  const fileLink = fileId => (
    <li key={fileId}>
      <NodeLink id={fileId} label={getFileLabel(provenance.files.get(fileId))} onSelect={onSelect} />
    </li>
  );
  const parameters = Object.entries(step.parameters || {});
  const environmentRows = getEnvironmentRows(step.environment);
  return (
    <>
      <div className={style.title}>{getToolName(step.tool)}</div>
      <p className={style.subtitle}>
        {[getToolPackage(step.tool), step.version].filter(Boolean).join(' ')}
        {step.url && <> · <a href={step.url} target="_blank" rel="noreferrer noopener">documentation</a></>}
      </p>
      <div className={style.chips}>
        {step.workflow && <Chip size="small" label={step.workflow} />}
        <Chip size="small" label={step.scope === 'project' ? 'Common to all MDs' : 'Only in this MD'} />
        <Chip size="small" label={step.status} title={step.status === 'recorded' ? RECORDED_EXPLANATION : null} />
        {step.redundant && <Chip size="small" color="error" variant="outlined" label="Redundant"
          title={REDUNDANT_EXPLANATION} />}
        {step.branch && <Chip size="small" variant="outlined" label="Side branch" title={BRANCH_EXPLANATION} />}
      </div>
      {step.status === 'recorded' && <p>{RECORDED_EXPLANATION}.</p>}
      {step.redundant && <p>{REDUNDANT_EXPLANATION}.</p>}
      {step.branch && <p>{BRANCH_EXPLANATION}.</p>}
      {(step.start || step.end) && (
        <p>
          {step.start && <>Start: {new Date(step.start).toLocaleString()}<br /></>}
          {step.end && <>End: {new Date(step.end).toLocaleString()}</>}
        </p>
      )}
      {step.user && <p>Run by: {step.user}</p>}
      {environmentRows.length > 0 && (
        <details>
          <summary>Machine: {step.environment.hostname || 'unknown host'}</summary>
          <table className={style.parameters}>
            <tbody>
              {environmentRows.map(([label, value]) => <tr key={label}><td>{label}</td><td>{value}</td></tr>)}
            </tbody>
          </table>
        </details>
      )}
      <div className={style.columns}>
        <div>
          <b>Inputs</b>
          <ul>{step.inputs.map(fileLink)}</ul>
        </div>
        <div>
          <b>Outputs</b>
          <ul>{step.outputs.map(fileLink)}</ul>
        </div>
      </div>
      {parameters.length > 0 && (
        <>
          <b>Parameters</b>
          <table className={style.parameters}>
            <tbody>
              {parameters.map(([key, value]) => (
                <tr key={key}><td>{key}</td><td><ParameterValue value={value} /></td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
};

// Show the details of the selected file
const FileDetails = ({ provenance, file, onSelect }) => {
  const stepLink = stepId => {
    const step = provenance.steps.get(stepId);
    return (
      <li key={stepId}>
        <NodeLink id={stepId} label={getToolName(step.tool)} onSelect={onSelect} />
        {step.workflow && <span className={style.grey}> ({step.workflow})</span>}
      </li>
    );
  };
  const roles = provenance.mdFileRoles.get(file.id);
  const producers = provenance.producers.get(file.id) || [];
  const consumers = provenance.consumers.get(file.id) || [];
  return (
    <>
      <div className={style.title}>{file.names.join(', ')}</div>
      <p className={style.subtitle}>
        {prettyBytes(file.size)}
        {file.format && <> · <a href={file.format} target="_blank" rel="noreferrer noopener">format</a></>}
      </p>
      {roles && <p>This file is the {roles.join(' and ').toLowerCase()} of this MD.</p>}
      <div className={style.columns}>
        <div>
          <b>Written by</b>
          <ul>{producers.length > 0 ? producers.map(stepLink) : <li>None: it is an input of the workflow</li>}</ul>
        </div>
        <div>
          <b>Read by</b>
          <ul>{consumers.length > 0 ? consumers.map(stepLink) : <li>None</li>}</ul>
        </div>
      </div>
    </>
  );
};

// Show the provenance of the MD: the steps which produced its files
const Provenance = () => {
  const { metadata, provenance: mdProvenance } = useContext(ProjectCtx);
  const projectProvenance = metadata && metadata.PROVENANCE;

  // Set the options to show the steps which are hidden by default
  const [showRedundant, setShowRedundant] = useState(false);
  const [branchDepth, setBranchDepth] = useState(0);
  const [selected, setSelected] = useState(null);

  // Join the common steps and the steps of this MD
  const provenance = useMemo(() => projectProvenance && joinProvenance(projectProvenance, mdProvenance),
    [projectProvenance, mdProvenance]);
  const maxBranchDepth = useMemo(() => provenance ? getMaxBranchDepth(provenance) : 0, [provenance]);
  const backboneIds = useMemo(() => provenance && getBackboneIds(provenance), [provenance]);
  const layout = useMemo(() => provenance &&
    layoutProvenance(provenance, getVisibleProvenance(provenance, { showRedundant, branchDepth })),
  [provenance, showRedundant, branchDepth]);

  if (!provenance) return (
    <Card className={style.card}>
      <CardContent>
        <div className={style.title}>Provenance</div>
        <p>There is no provenance for this MD.</p>
      </CardContent>
    </Card>
  );

  const steps = [...provenance.steps.values()];
  const runSummary = getRunSummary(steps);
  const redundantCount = steps.filter(step => step.redundant).length;
  const branchCount = steps.filter(step => step.branch).length;
  const shownBranchCount = steps.filter(step => step.branch && provenance.branchDepths.get(step.id) <= branchDepth).length;
  const selectedStep = selected && provenance.steps.get(selected);
  const selectedFile = selected && provenance.files.get(selected);
  // Unselect nodes which are no longer shown
  const isSelectedVisible = selected && layout.nodes.some(node => node.id === selected);

  return (
    <>
      <Card className={style.card}>
        <CardContent>
          <div className={style.title}>Provenance</div>
          <p>
            Steps of the workflow which produced the files of this MD, from the first inputs at the top to the
            MD files at the bottom (highlighted). Boxes are steps and rounded labels are files. Dashed lines mark where every workflow starts. Files with
            the same content are shown once, with all their names. Click on any step or file to see its details.
            Drag to move the graph, scroll to move it up and down and use the mouse wheel with the control key to zoom.
          </p>
          <p>
            Some steps are hidden by default. Redundant steps write again files identical to their inputs.
            Side branches are steps whose outputs do not lead to the MD files. Move the depth to show them:
            depth 1 shows the first step of every branch, depth 2 also the second step, and so on.
          </p>
          {(runSummary.users.length > 0 || runSummary.machines.length > 0) && (
            <p>
              {runSummary.users.length > 0 && <>Run by: {runSummary.users.join(', ')}<br /></>}
              {runSummary.machines.length > 0 && <>Machines: {runSummary.machines.join(', ')}</>}
            </p>
          )}
          <div className={style.controls}>
            {redundantCount > 0 && (
              <FormControlLabel
                control={<Switch checked={showRedundant} onChange={changeEvent => setShowRedundant(changeEvent.target.checked)} />}
                label={`Show redundant steps (${redundantCount})`}
                title={REDUNDANT_EXPLANATION}
              />
            )}
            {branchCount > 0 && (
              <div className={style.slider}>
                <span>
                  Side branches: {branchDepth === 0
                    ? 'hidden'
                    : shownBranchCount}
                </span>
                <Slider
                  value={branchDepth}
                  min={0}
                  max={maxBranchDepth}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  onChange={(changeEvent, value) => setBranchDepth(value)}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Card className={style['graph-card']}>
        <ProvenanceGraph
          provenance={provenance}
          layout={layout}
          backboneIds={backboneIds}
          selected={isSelectedVisible ? selected : null}
          onSelect={setSelected}
        />
      </Card>
      {isSelectedVisible && (selectedStep || selectedFile) && (
        <Card className={style.card}>
          <CardContent>
            {selectedStep
              ? <StepDetails provenance={provenance} step={selectedStep} onSelect={setSelected} />
              : <FileDetails provenance={provenance} file={selectedFile} onSelect={setSelected} />}
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default Provenance;
