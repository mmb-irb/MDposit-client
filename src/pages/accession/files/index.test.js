import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { ProjectCtx } from '../../../contexts';
import { BASE_PATH_PROJECTS } from '../../../utils/constants';

import Files from '.';

afterEach(cleanup);

const STORED_TRAJECTORY = {
  filename: 'trajectory.bin',
  length: 1200,
  metadata: { atoms: 100, frames: 10 },
};

const renderFiles = files =>
  render(
    <MemoryRouter>
      <ProjectCtx.Provider
        value={{
          accessionAndMdNumber: 'A0001.1',
          metadata: { SYSTATS: 100 },
          fileDescriptors: { loading: false, payload: files },
        }}
      >
        <Files />
      </ProjectCtx.Provider>
    </MemoryRouter>,
  );

const downloadHref = () =>
  screen
    .getAllByText('Download')
    .map(button => button.closest('a').getAttribute('href'));

describe('<Files />', () => {
  // The API exports them, so they are offered in any format whatever is stored
  it('offers the structure as mmCIF and the trajectory as XTC by default', () => {
    renderFiles([
      STORED_TRAJECTORY,
      { filename: 'structure.pdb' },
      { filename: 'trajectory.xtc' },
    ]);
    expect(downloadHref()).toEqual([
      `${BASE_PATH_PROJECTS}/A0001.1/structure?format=cif`,
      `${BASE_PATH_PROJECTS}/A0001.1/trajectory?format=xtc`,
    ]);
    // Stored copies of the main structure and trajectory are not suggested again
    expect(screen.queryByText('Other interesting files')).toBeNull();
  });

  it('tells the atoms of the structure and the atoms and frames of the trajectory', () => {
    renderFiles([STORED_TRAJECTORY]);
    expect(screen.getByText('100 atoms')).toBeTruthy();
    expect(screen.getByText('100 atoms in 10 frames')).toBeTruthy();
  });

  it('downloads the chosen format', () => {
    renderFiles([STORED_TRAJECTORY]);
    fireEvent.click(screen.getByRole('button', { name: 'PDB' }));
    fireEvent.click(screen.getByRole('button', { name: 'DCD' }));
    expect(downloadHref()).toEqual([
      `${BASE_PATH_PROJECTS}/A0001.1/structure?format=pdb`,
      `${BASE_PATH_PROJECTS}/A0001.1/trajectory?format=dcd`,
    ]);
  });

  it('does not offer a trajectory when there is none', () => {
    renderFiles([]);
    expect(downloadHref()).toEqual([
      `${BASE_PATH_PROJECTS}/A0001.1/structure?format=cif`,
    ]);
    expect(screen.queryByText('Main Trajectory')).toBeNull();
  });
});
