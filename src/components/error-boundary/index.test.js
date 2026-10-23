import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router';

import ErrorBoundary from '.';

const ERROR_TEXT = /An error happened/;

const Crash = ({ error = new Error('Crash') }) => { throw error; };

// Mimic how the app uses the boundary: around the routes, reset by the current path
const App = ({ error }) => {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate('/good')}>good</button>
      <button onClick={() => navigate('/other-good')}>other good</button>
      <ErrorBoundary resetKey={location.pathname}>
        <Routes>
          <Route path="/bad" element={<Crash error={error} />} />
          <Route path="/good" element={'Good page'} />
          <Route path="/other-good" element={'Other good page'} />
        </Routes>
      </ErrorBoundary>
    </>
  );
};

const renderAt = (path, error) => render(
  <MemoryRouter initialEntries={[path]}>
    <App error={error} />
  </MemoryRouter>
);

const originalLocation = window.location;

beforeEach(() => {
  // React and the boundary log caught errors; keep the test output readable
  jest.spyOn(console, 'error').mockImplementation(() => {});
  // jsdom does not let us spy on location.reload, so replace the whole location
  delete window.location;
  window.location = { ...originalLocation, reload: jest.fn() };
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  window.location = originalLocation;
  jest.restoreAllMocks();
});

describe('<ErrorBoundary />', () => {
  it('shows the error message when a child crashes', () => {
    renderAt('/bad');
    expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument();
  });

  it('keeps showing the error while the user stays on the same page', () => {
    const { rerender } = renderAt('/bad');
    rerender(<MemoryRouter initialEntries={['/bad']}><App /></MemoryRouter>);
    expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument();
  });

  it('shows the next page again once the user navigates away', () => {
    renderAt('/bad');
    fireEvent.click(screen.getByText('good'));
    expect(screen.queryByText(ERROR_TEXT)).not.toBeInTheDocument();
    expect(screen.getByText('Good page')).toBeInTheDocument();
    // And it keeps working on further navigation
    fireEvent.click(screen.getByText('other good'));
    expect(screen.getByText('Other good page')).toBeInTheDocument();
  });

  describe('when a piece of the app code cannot be downloaded', () => {
    const chunkError = () => Object.assign(new Error('Loading chunk 7 failed'), { name: 'ChunkLoadError' });

    it('reloads the page without flashing the error message first', () => {
      renderAt('/bad', chunkError());
      expect(window.location.reload).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(ERROR_TEXT)).not.toBeInTheDocument();
    });

    it('does not reload again if the error comes back right after reloading', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);
      renderAt('/bad', chunkError());
      expect(window.location.reload).toHaveBeenCalledTimes(1);
      cleanup();
      // The "reloaded" page hits the same error 3 seconds later
      Date.now.mockReturnValue(1003000);
      renderAt('/bad', chunkError());
      expect(window.location.reload).toHaveBeenCalledTimes(1);
      expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument();
    });

    it('reloads again if the error comes back much later (e.g. another release)', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000);
      renderAt('/bad', chunkError());
      cleanup();
      Date.now.mockReturnValue(1000000 + 60 * 60 * 1000);
      renderAt('/bad', chunkError());
      expect(window.location.reload).toHaveBeenCalledTimes(2);
    });
  });
});
