import React, { Suspense, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Count how many times the Mol* viewer module is evaluated
// Mol* is a ~3 MB chunk, so it must only be loaded once the user switches to it
let mockMolstarLoads = 0;
vi.mock('../../molstar-viewer', async () => {
  mockMolstarLoads += 1;
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => <div>molstar stub</div>) };
});
vi.mock('../../ngl-viewer', async () => {
  const { forwardRef, memo } = await import('react');
  return { default: memo(forwardRef(() => <div>ngl stub</div>)) };
});

// Keep the imports below the mocks for readability (vi.mock calls are hoisted anyway)
const SettingsControls = (await import('.')).default;
const NGLViewer = (await import('../../ngl-viewer')).default;

// Mimic how viewer-with-controls holds the backend and renders it
const Harness = ({ noTrajectory = true }) => {
  const [Viewer, setViewer] = useState(NGLViewer);
  return (
    <>
      <SettingsControls
        viewerRef={{ current: { totalExpectedFrames: 10 } }}
        noTrajectory={noTrajectory}
        smooth
        Viewer={Viewer}
        setViewer={setViewer}
        allowMolstar
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

  // Mol* can not interpolate between frames, so the toggle would do nothing
  it('disables smooth interpolation in Mol*', async () => {
    render(<Harness noTrajectory={false} />);
    expect(screen.getByTitle('Toggle smooth interpolation off')).toBeEnabled();
    fireEvent.click(screen.getByTitle('Switch viwer to MolStar'));
    await screen.findByText('molstar stub');
    expect(screen.getByTitle('Toggle smooth interpolation off')).toBeDisabled();
  });

  // e.g. thickness, which needs something Mol* lacks
  it('hides the switch when the page opts out of Mol*', () => {
    render(
      <SettingsControls
        viewerRef={{ current: null }}
        noTrajectory
        Viewer={NGLViewer}
        setViewer={() => {}}
        allowMolstar={false}
      />,
    );
    expect(screen.queryByTitle('Switch viwer to MolStar')).not.toBeInTheDocument();
  });
});

describe('<SettingsControls /> frames number', () => {
  // Without the frames selector the number is read from the viewer
  const renderFramesNumber = viewerRef =>
    render(
      <SettingsControls
        viewerRef={viewerRef}
        framesSelect={false}
        Viewer={NGLViewer}
        setViewer={() => {}}
      />,
    );

  it('shows the total expected frames of the viewer', () => {
    renderFramesNumber({ current: { totalExpectedFrames: 20 } });
    expect(screen.getByText('Frames: 20')).toBeInTheDocument();
  });

  // The lazy Mol* viewer has no ref while its chunk is still loading
  it('renders while the viewer is not mounted yet', () => {
    renderFramesNumber({ current: null });
    expect(screen.getByText('Frames:')).toBeInTheDocument();
  });
});
