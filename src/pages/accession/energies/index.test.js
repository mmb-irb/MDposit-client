import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ProjectCtx } from '../../../contexts';

// Mock the API hook so we can drive every request response from the test
vi.mock('../../../hooks/use-api', () => ({
  __esModule: true,
  default: url => global.__apiResponder(url),
}));

// Mock the heavy components which are not the target of this test
// Note that the graph exposes both its marks and a way to select a point in the x axis
vi.mock('../../../components/graph', () => ({
  __esModule: true,
  default: ({ title, xAxisValues, onSelect, marks }) => (
    <div
      data-testid="graph"
      data-title={title}
      data-xtags={xAxisValues.join(',')}
      data-marks={JSON.stringify((marks || []).map(mark => mark.x))}
    >
      <button data-testid="select-x" onClick={() => onSelect(0)} />
    </div>
  ),
}));
// Note that the viewer spawner exposes whether it was given a viewer to spawn
vi.mock('../../../components/viewer-spawner', () => ({
  __esModule: true,
  default: ({ newViewer }) => (
    <div data-testid="viewer-spawner" data-open={newViewer ? 'true' : 'false'} />
  ),
}));
// Mock the interaction selector so we can select interactions by index
vi.mock('../../../components/interaction-selector', () => ({
  __esModule: true,
  default: ({ interactions, setSelectedInteraction }) => (
    <div>
      {interactions.map((interaction, index) => (
        <button
          key={index}
          data-testid={`select-interaction-${index}`}
          onClick={() => setSelectedInteraction(index)}
        />
      ))}
    </div>
  ),
}));

import Energies from '.';

// --- Fake project data -----------------------------------------------------

// A minimal topology manager mock
// Note that atoms 0-1 belong to residue 0 and atoms 2-3 belong to residue 1
const ATOM_RESIDUES = [0, 0, 1, 1];
const fakeTopology = {
  defaultRepresentations: [{ name: 'Default', type: 'cartoon', selection: 'all' }],
  atom2residueIndices: atomIndices =>
    [...new Set(atomIndices.map(index => ATOM_RESIDUES[index]))],
  atomIndices2Ngl: atomIndices => `@${atomIndices.join(',')}`,
  getResidueByIndex: residueIndex => ({ standardLabel: `R${residueIndex}` }),
  getAtomByIndex: atomIndex => ({
    label: `A${atomIndex}`,
    residueIndex: ATOM_RESIDUES[atomIndex],
    residue: { standardLabel: `R${ATOM_RESIDUES[atomIndex]}` },
  }),
};

// Build an interaction whose host covers every atom in the fake topology
const fakeInteraction = (name, strongBonds = []) => ({
  name,
  atom_indices_1: [0, 1, 2, 3],
  atom_indices_2: [0, 1, 2, 3],
  interface_atom_indices_1: [0, 1],
  interface_atom_indices_2: [2, 3],
  strong_bonds: strongBonds,
});

const TWO_INTERACTIONS = [fakeInteraction('first'), fakeInteraction('second')];
const ONE_INTERACTION = [fakeInteraction('first')];

// Energies values, one per residue
const agentData = () => ({
  es: [-1, -2],
  ies: [-1, -2],
  fes: [-1, -2],
  vdw: [-3, -4],
  ivdw: [-3, -4],
  fvdw: [-3, -4],
  both: [-4, -6],
  iboth: [-4, -6],
  fboth: [-4, -6],
});

const energiesAnalysis = name => ({
  version: '0.0.0',
  name,
  agent1: agentData(),
  agent2: agentData(),
});

// A loaded project, as seen by the components through the ProjectCtx
const loadedProject = (accessionAndMdNumber, interactions = TWO_INTERACTIONS) => ({
  accessionAndMdNumber,
  hasInteractions: true,
  topology: fakeTopology,
  interactionsIndex: interactions.map(interaction => ({ name: interaction.name })),
  getInteraction: index => interactions[index],
  loading: false,
});

// A project which is still downloading its data
// This is what the context looks like right after switching replica: the Project
// instance is new, so all its getters return undefined while data is downloaded
// Note that the project 'loading' getter can not be trusted to detect this
const loadingProject = accessionAndMdNumber => ({
  accessionAndMdNumber,
  hasInteractions: true,
  topology: undefined,
  interactionsIndex: undefined,
  getInteraction: () => undefined,
  loading: false,
});

// --- API responders --------------------------------------------------------

// Every analysis request is answered as if data was already available
const respondLoaded = url => {
  if (!url) return { loading: false, payload: null, error: null };
  if (url.endsWith('/analyses/energies'))
    return {
      loading: false,
      payload: [
        { name: 'first', analysis: 'energies-first' },
        { name: 'second', analysis: 'energies-second' },
      ],
      error: null,
    };
  const name = url.endsWith('energies-second') ? 'second' : 'first';
  return { loading: false, payload: energiesAnalysis(name), error: null };
};

// Every request is answered as still loading
// This is what the API hook returns as soon as the requested URL changes, since
// it never returns a response which does not belong to the current URL
const respondLoading = () => ({ loading: true });

// --- Helpers ---------------------------------------------------------------

const renderEnergies = async project => {
  let wrapper;
  await act(async () => {
    wrapper = render(
      <MemoryRouter>
        <ProjectCtx.Provider value={project}>
          <Energies />
        </ProjectCtx.Provider>,
      </MemoryRouter>
    );
  });
  return wrapper;
};

// Click a point in the graph, which is what spawns a viewer
const selectGraphPoint = async wrapper => {
  await act(async () => {
    fireEvent.click(wrapper.getAllByTestId('select-x')[0]);
  });
};

// Get the x positions of the marks handed to the first graph
const getMarks = wrapper =>
  JSON.parse(wrapper.getAllByTestId('graph')[0].dataset.marks);

const rerenderEnergies = async (wrapper, project) => {
  await act(async () => {
    wrapper.rerender(
      <MemoryRouter>
        <ProjectCtx.Provider value={project}>
          <Energies />
        </ProjectCtx.Provider>,
      </MemoryRouter>
    );
  });
};

describe('<Energies />', () => {
  afterEach(cleanup);

  it('should render the graphs when everything is loaded', async () => {
    global.__apiResponder = respondLoaded;
    const wrapper = await renderEnergies(loadedProject('MD-A004VX.1'));
    const graphs = wrapper.getAllByTestId('graph');
    expect(graphs.length).toBe(3);
    expect(graphs[0].dataset.xtags).toBe('R0,R1');
  });

  it('should show the loading indicator while a new MD is being requested', async () => {
    global.__apiResponder = respondLoaded;
    const wrapper = await renderEnergies(loadedProject('MD-A004VX.1'));
    expect(wrapper.getAllByTestId('graph').length).toBe(3);

    // Now change MD: both the project data and the analyses are requested again
    global.__apiResponder = respondLoading;
    await rerenderEnergies(wrapper, loadingProject('MD-A004VX.2'));

    // The component must not have thrown and must not keep the previous graphs
    expect(wrapper.queryAllByTestId('graph').length).toBe(0);
    expect(wrapper.getByTitle('loading...')).toBeInTheDocument();
  });

  it('should show the loading indicator when the project data is not ready yet', async () => {
    // The energies analyses may be downloaded before the topology, in which case
    // the API responses are ready but the project data is still missing
    global.__apiResponder = respondLoaded;
    const wrapper = await renderEnergies(loadingProject('MD-A004VX.2'));
    expect(wrapper.queryAllByTestId('graph').length).toBe(0);
    expect(wrapper.getByTitle('loading...')).toBeInTheDocument();
  });

  it('should render the graphs once the new MD data is available', async () => {
    global.__apiResponder = respondLoaded;
    const wrapper = await renderEnergies(loadedProject('MD-A004VX.1'));
    global.__apiResponder = respondLoading;
    await rerenderEnergies(wrapper, loadingProject('MD-A004VX.2'));
    global.__apiResponder = respondLoaded;
    await rerenderEnergies(wrapper, loadedProject('MD-A004VX.2'));
    expect(wrapper.getAllByTestId('graph').length).toBe(3);
  });

  it('should mark the selected point and spawn a viewer when the graph is clicked', async () => {
    global.__apiResponder = respondLoaded;
    const wrapper = await renderEnergies(loadedProject('MD-A004VX.1'));
    expect(getMarks(wrapper)).toEqual([]);
    expect(wrapper.getByTestId('viewer-spawner').dataset.open).toBe('false');

    await selectGraphPoint(wrapper);

    expect(getMarks(wrapper)).toEqual([0]);
    expect(wrapper.getByTestId('viewer-spawner').dataset.open).toBe('true');
  });

  it('should keep the strong bond marks along with the selected mark', async () => {
    // Atoms 0 and 2 are covalently bonded, and they belong to residues 0 and 1
    const strongBonded = [fakeInteraction('first', [[0, 2]])];
    global.__apiResponder = respondLoaded;
    const wrapper = await renderEnergies(loadedProject('MD-A004VX.1', strongBonded));
    expect(getMarks(wrapper)).toEqual([0, 1]);

    // The selected mark is added on top of the strong bond ones
    await selectGraphPoint(wrapper);
    expect(getMarks(wrapper)).toEqual([0, 0, 1]);
  });

  it('should not crash when changing MD while a viewer is open', async () => {
    global.__apiResponder = respondLoaded;
    const wrapper = await renderEnergies(loadedProject('MD-A004VX.1'));

    // Select a point in the graph so a viewer is spawned
    // This keeps the 'selectedX' set, which used to break the marks on MD change
    await selectGraphPoint(wrapper);
    expect(wrapper.getByTestId('viewer-spawner').dataset.open).toBe('true');

    // Now change MD, so both the project data and the analyses are requested again
    // The dataset is retained meanwhile, but the topology derived data is gone
    global.__apiResponder = respondLoading;
    await rerenderEnergies(wrapper, loadingProject('MD-A004VX.2'));

    // The component must survive and just display the loading indicator
    expect(wrapper.queryAllByTestId('graph').length).toBe(0);
    expect(wrapper.getByTitle('loading...')).toBeInTheDocument();

    // And it must recover once the new MD data is available
    global.__apiResponder = respondLoaded;
    await rerenderEnergies(wrapper, loadedProject('MD-A004VX.2'));
    expect(wrapper.getAllByTestId('graph').length).toBe(3);
  });

  it('should keep loading with a viewer open when only the topology is ready', async () => {
    global.__apiResponder = respondLoaded;
    const wrapper = await renderEnergies(loadedProject('MD-A004VX.1'));
    await selectGraphPoint(wrapper);

    // The topology and the interactions are downloaded apart, so the topology may
    // be ready while the interactions are still missing
    global.__apiResponder = respondLoading;
    await rerenderEnergies(wrapper, {
      ...loadingProject('MD-A004VX.2'),
      topology: fakeTopology,
    });

    expect(wrapper.queryAllByTestId('graph').length).toBe(0);
    expect(wrapper.getByTitle('loading...')).toBeInTheDocument();
  });

});
