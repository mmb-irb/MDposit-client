import React, { Suspense } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router';

import useAPI from '../../hooks/use-api';
import Accession from '.';

// The API answer for each URL, set by each test
let answers;
vi.mock('../../hooks/use-api', () => ({ default: vi.fn() }));

// A minimal stand-in for the project model, with just what the accession page reads
vi.mock('../../utils/project-manager', () => ({
  Project: class {
    constructor (data) {
      this.accession = data.accession;
      this.accessionAndMdNumber = data.accession + '.1';
      this.mdCount = 1;
      this.mdIndex = 0;
      this.mds = [{ name: 'replica 1' }];
      this.metadata = {};
      this.collectionReferences = [];
      this.directions = { overview: true };
    }
    checkProblems () { return null; }
  }
}));
vi.mock('../../components/project-menu', () => ({ default: () => null }));
vi.mock('./overview', () => ({ default: () => 'Overview content' }));
vi.mock('./data-viewer', () => ({ default: () => null }));

const Navigation = () => {
  const navigate = useNavigate();
  return <>
    <button onClick={() => navigate('/id/A0001/overview')}>good entry</button>
    <button onClick={() => navigate('/id/WRONG/overview')}>wrong entry</button>
  </>;
};

const renderAt = path => render(
  <MemoryRouter initialEntries={[path]}>
    <Navigation />
    <Suspense fallback={null}>
      <Routes>
        <Route path="/id/:accession/:page/*" element={<Accession />} />
      </Routes>
    </Suspense>
  </MemoryRouter>
);

const notFound = Object.assign(new Error('Request failed with status code 404'), {
  response: { status: 404, data: 'Project WRONG was not found' }
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  answers = {
    A0001: { loading: false, payload: { accession: 'A0001' }, error: null },
    WRONG: { loading: false, payload: undefined, error: notFound },
  };
  useAPI.mockImplementation(url => (url && answers[url.split('/').slice(-2)[0]]) ||
    { loading: false, payload: undefined, error: null });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('<Accession />', () => {
  it('shows the error for an entry which does not exist', async () => {
    renderAt('/id/WRONG/overview');
    expect(await screen.findByText(/Project WRONG was not found/)).toBeInTheDocument();
  });

  it('shows the right entry again after visiting one which does not exist', async () => {
    renderAt('/id/A0001/overview');
    expect(await screen.findByText('Overview content')).toBeInTheDocument();
    fireEvent.click(screen.getByText('wrong entry'));
    expect(await screen.findByText(/Project WRONG was not found/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('good entry'));
    expect(await screen.findByText('Overview content')).toBeInTheDocument();
    expect(screen.queryByText(/Project WRONG was not found/)).not.toBeInTheDocument();
  });
});
