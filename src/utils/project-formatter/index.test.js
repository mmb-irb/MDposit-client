import { BROWSER_RETURN_QUERY, formatRawProject } from '.';
import { Project } from '../project-manager';

vi.mock('ngl', () => ({ autoLoad: vi.fn() }));
vi.mock('../topology-manager', () => ({ Topology: vi.fn() }));

// A raw project as the API returns it when fields are requested
const rawProject = {
  _id: '69c1291c7e3aaddcb7a94e63',
  accession: 'A0001',
  published: true,
  mdref: 1,
  metadata: { NAME: 'Some protein', METHOD: 'Classical MD', REFERENCES: ['P30613'] },
  analyses: [{ name: 'mem-map' }],
  mds: [
    { name: 'r1', analyses: [{ name: 'rmsds' }], files: [{ name: 'a.pdb' }] },
    { name: 'r2', removed: true, analyses: [{ name: 'rgyr' }, { name: 'sasa' }], files: [{ name: 'b.pdb' }] },
  ],
};

describe('formatRawProject', () => {
  it('keeps the reference MD data and the names of the rest', () => {
    const project = formatRawProject(rawProject);
    expect(project.identifier).toBe('A0001');
    expect(project.mdNumber).toBe(2);
    expect(project.analyses).toEqual(['mem-map', 'rgyr', 'sasa']);
    expect(project.files).toEqual(['b.pdb']);
    expect(project.mds).toEqual(['r1', 'r2 (removed)']);
    expect(project._id).toBeUndefined();
  });

  it('is understood by the Project class', () => {
    const project = new Project(formatRawProject(rawProject));
    expect(project.mdCount).toBe(1);
    expect(project.directions.rgyr).toBe(true);
    expect(project.directions.rmsds).toBe(false);
    expect(project.metadata.NAME).toBe('Some protein');
  });

  it('uses the _id as identifier when there is no accession', () => {
    expect(formatRawProject({ ...rawProject, accession: undefined }).identifier).toBe(rawProject._id);
  });

  it('returns errors the way the API does', () => {
    expect(formatRawProject({ ...rawProject, deleted: true }).error).toMatch(/deleted/);
    expect(formatRawProject({ ...rawProject, mds: undefined }).error).toMatch(/missing mds/);
    expect(formatRawProject({ ...rawProject, metadata: undefined }).error).toMatch(/missing metadata/);
    expect(formatRawProject({ ...rawProject, mdref: 5 }).error).toMatch(/does not exist/);
  });
});

describe('BROWSER_RETURN_QUERY', () => {
  it('is a list of return arguments', () => {
    expect(BROWSER_RETURN_QUERY.split('&').every(arg => arg.startsWith('return='))).toBe(true);
  });
});
