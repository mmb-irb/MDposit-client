import { renderHook, act } from '@testing-library/react';

import useAPI from '../../hooks/use-api';
import { Project } from '.';

// Replace useAPI with a fake whose response the test sets
jest.mock('../../hooks/use-api', () => ({ __esModule: true, default: jest.fn() }));
// NGL is not needed to check problems and it does not load in jsdom
jest.mock('ngl', () => ({ autoLoad: jest.fn() }));
// The topology manager is not needed either
jest.mock('../topology-manager', () => ({ Topology: jest.fn() }));
// Problems are only checked in the global client
jest.mock('../constants', () => {
  const actual = jest.requireActual('../constants');
  return { ...actual, HOST_CONFIG: { ...actual.HOST_CONFIG, global: true } };
});

const loading = { loading: true };
const answered = { loading: false, payload: { atom_names: [] }, error: null };

// The response every useAPI call returns, changed by the tests
let apiResponse;

beforeEach(() => {
  jest.useFakeTimers();
  apiResponse = loading;
  useAPI.mockReset();
  useAPI.mockImplementation(() => apiResponse);
});

afterEach(() => {
  jest.useRealTimers();
});

const newProject = () => new Project({
  accession: 'TEST1', mds: ['replica 1'], mdNumber: 1, metadata: {}, analyses: [],
});

// Render checkProblems as a hook, the way the accession page uses it
const renderCheck = () => {
  const project = newProject();
  return renderHook(() => project.checkProblems());
};

// Let time pass and let React process the timer updates
const wait = ms => act(() => { jest.advanceTimersByTime(ms); });

describe('Project.checkProblems', () => {
  it('asks for the topology without a timeout, since this request is shared with the real topology loads', () => {
    renderCheck();
    expect(useAPI).toHaveBeenCalled();
    const [url, , timeout] = useAPI.mock.calls[0];
    expect(url).toMatch(/\/projects\/TEST1\.1\/topology$/);
    expect(timeout).toBeFalsy();
  });

  it('reports no problem while the node has been answering for less than 5 seconds', () => {
    const { result } = renderCheck();
    wait(4900);
    expect(result.current).toBeUndefined();
  });

  it('reports the node as not responding when it takes more than 5 seconds', () => {
    const { result } = renderCheck();
    wait(5100);
    expect(result.current).toEqual(expect.objectContaining({ noResponse: true }));
  });

  it('stops reporting the problem when the slow node finally answers', () => {
    const { result, rerender } = renderCheck();
    wait(5100);
    expect(result.current).toEqual(expect.objectContaining({ noResponse: true }));
    apiResponse = answered;
    rerender();
    expect(result.current).toBeUndefined();
  });

  it('reports no problem when the node answers in time', () => {
    const { result, rerender } = renderCheck();
    wait(1000);
    apiResponse = answered;
    rerender();
    wait(10000);
    expect(result.current).toBeUndefined();
  });

  it('reports the error when the node answers with an error', () => {
    const { result, rerender } = renderCheck();
    const error = { message: 'Not found', response: { status: 404, data: 'Not found' } };
    apiResponse = { loading: false, payload: null, error };
    rerender();
    expect(result.current).toBe(error);
  });
});

describe('Project ligand references', () => {
  // References as stored by different workflow versions
  const makeReferences = () => [
    // Old ligand reference, which is the ligand data itself with the PubChem id as a string (inria A00KJ)
    { name: 'ZINC', pubchem: '23994', inchikey: 'HCHKCACWOHOZIP-UHFFFAOYSA-N', ref_type: 'ligands' },
    // InChI key reference with ligand data
    { inchikey: 'LIGAND-KEY', ligand: { name: 'Ligand', pubchem: '1' }, swisslipids: null, lipidmaps: null,
      ref_type: 'inchikeys' },
    // Old InChI key reference with the ligand data as 'pubchem'
    { inchikey: 'OLD-KEY', pubchem: { name: 'Old ligand', pubchem: '2' }, swisslipids: false, lipidmaps: false,
      ref_type: 'inchikeys' },
    // Lipid missing in every database (e.g. MC3)
    { inchikey: 'MC3-KEY', ligand: null, swisslipids: null, lipidmaps: null, lipid: { category: 'FA', forced: false },
      ref_type: 'inchikeys' },
  ];
  const renderReferences = getter => {
    apiResponse = { loading: false, payload: makeReferences(), error: null };
    const project = newProject();
    return renderHook(() => project[getter]).result.current;
  };

  it('reads old ligand references, whose PubChem id is a string', () => {
    const ligandReferences = renderReferences('ligandReferences');
    expect(ligandReferences.map(ref => [ref.name, ref.pubchem])).toEqual(
      [['ZINC', '23994'], ['Ligand', '1'], ['Old ligand', '2']]);
    expect(ligandReferences.map(ref => ref.inchiRef.inchikey)).toEqual(
      ['HCHKCACWOHOZIP-UHFFFAOYSA-N', 'LIGAND-KEY', 'OLD-KEY']);
  });

  it('lists ligands and lipids, leaving lipids with no name in any database unnamed', () => {
    const references = renderReferences('ligandAndLipidReferences');
    expect(references.map(ref => ref.name)).toEqual(['ZINC', 'Ligand', 'Old ligand', undefined]);
    expect(references[3].inchiRef.lipid.category).toBe('FA');
  });
});
