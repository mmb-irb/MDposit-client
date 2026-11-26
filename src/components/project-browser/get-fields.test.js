import { BROWSER_GET_QUERY } from './get-fields';
import { Project } from '../../utils/project-manager';

vi.mock('ngl', () => ({ autoLoad: vi.fn() }));
vi.mock('../../utils/topology-manager', () => ({ Topology: vi.fn() }));

describe('browser get fields', () => {
  it('builds repeated get arguments', () => {
    expect(BROWSER_GET_QUERY.split('&').every(arg => arg.startsWith('get='))).toBe(true);
  });

  it('are enough to build the Project of a table row', () => {
    // A formatted project with only the requested fields, as the API returns it
    const project = new Project({
      identifier: 'A0001', accession: 'A0001', published: true, mdNumber: 1,
      metadata: { NAME: 'Some protein', METHOD: 'Classical MD', REFERENCES: ['P30613'] },
      analyses: ['rmsds'], mds: ['r1', 'r2 (removed)'], files: ['structure.pdb'],
    });
    expect(project.mdCount).toBe(1);
    expect(project.accessionAndMdNumber).toBe('A0001.1');
    expect(project.directions.rmsds).toBe(true);
  });
});
