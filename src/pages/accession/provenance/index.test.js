import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { ProjectCtx } from '../../../contexts';
import { Project } from '../../../utils/project-manager';
import Provenance from '.';

afterEach(cleanup);

const file = (id, name) => ({ id, names: [name], size: 100 });
const PROVENANCE = {
  steps: [
    { id: 'tpr', tool: 'biobb_gromacs Grompp', version: '5.3.2', status: 'recorded', workflow: 'Setup',
      inputs: ['system'], outputs: ['topology'], parameters: { 'grompp.mdp': { dt: 0.002 } } },
    { id: 'image', tool: 'biobb_analysis GMXImage', status: 'recorded', workflow: 'Setup', redundant: true,
      inputs: ['system'], outputs: ['system'], parameters: {} },
  ],
  files: [file('system', 'system.gro'), file('topology', 'md.tpr')],
};
const MD_PROVENANCE = {
  steps: [{ id: 'run', tool: 'biobb_gromacs Mdrun', status: 'completed', workflow: 'Production',
    inputs: ['topology'], outputs: ['trajectory'], parameters: {} }],
  files: [file('trajectory', 'md.xtc')],
  md_files: { topology: 'topology', structure: 'topology', trajectories: ['trajectory'] },
};

const renderPage = value => render(
  <MemoryRouter>
    <ProjectCtx.Provider value={value}>
      <Provenance />
    </ProjectCtx.Provider>
  </MemoryRouter>,
);

describe('<Provenance />', () => {
  it('tells when there is no provenance', () => {
    renderPage({ metadata: {} });
    expect(screen.getByText(/There is no provenance for this MD/)).toBeTruthy();
  });

  it('draws the steps and hides the redundant ones until asked', () => {
    renderPage({ metadata: { PROVENANCE }, provenance: MD_PROVENANCE });
    expect(screen.getByText('Grompp')).toBeTruthy();
    expect(screen.getByText('Mdrun')).toBeTruthy();
    expect(screen.queryByText('GMXImage')).toBeNull();
    fireEvent.click(screen.getByLabelText(/Show redundant steps/));
    expect(screen.getByText('GMXImage')).toBeTruthy();
  });

  it('shows the details of the clicked step', () => {
    renderPage({ metadata: { PROVENANCE }, provenance: MD_PROVENANCE });
    fireEvent.click(screen.getByText('Grompp'));
    expect(screen.getByText('Common to all MDs')).toBeTruthy();
    expect(screen.getByText('1 parameters')).toBeTruthy();
  });

  it('is available only when there is provenance', () => {
    const project = metadata => new Project({ accession: 'A0001', metadata, analyses: [], files: [] });
    expect(project({ PROVENANCE }).directions.provenance).toBe(true);
    expect(project({}).directions.provenance).toBeUndefined();
  });
});
