import React, { Suspense, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Count how many times the Mol* viewer module is evaluated
// Mol* is a ~3 MB chunk, so it must only be loaded once the user switches to it
let mockMolstarLoads = 0;
jest.mock('../../molstar-viewer', () => {
  mockMolstarLoads += 1;
  const { forwardRef } = require('react');
  return forwardRef(() => <div>molstar stub</div>);
});
jest.mock('../../ngl-viewer', () => {
  const { forwardRef, memo } = require('react');
  return memo(forwardRef(() => <div>ngl stub</div>));
});

// Keep the imports below the mocks for readability (jest hoists the mocks anyway)
const SettingsControls = require('.').default;
const NGLViewer = require('../../ngl-viewer');

// Mimic how viewer-with-controls holds the backend and renders it
const Harness = () => {
  const [Viewer, setViewer] = useState(NGLViewer);
  return (
    <>
      <SettingsControls
        viewerRef={{ current: null }}
        noTrajectory
        Viewer={Viewer}
        setViewer={setViewer}
      />
      <Suspense fallback={null}>
        <Viewer />
      </Suspense>
    </>
  );
};

describe('<SettingsControls /> viewer switch', () => {
  it('does not load the Mol* viewer module until the user switches to it', () => {
    render(<Harness />);
    expect(screen.getByText('ngl stub')).toBeInTheDocument();
    expect(mockMolstarLoads).toBe(0);
  });

  it('switches to Mol* and back to NGL, loading Mol* only once', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTitle('Switch viwer to MolStar'));
    expect(await screen.findByText('molstar stub')).toBeInTheDocument();
    expect(mockMolstarLoads).toBe(1);

    fireEvent.click(screen.getByTitle('Switch viwer to NGL'));
    expect(screen.getByText('ngl stub')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Switch viwer to MolStar'));
    expect(await screen.findByText('molstar stub')).toBeInTheDocument();
    expect(mockMolstarLoads).toBe(1);
  });
});
