import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { ProjectCtx } from '../../../contexts';
import { Project } from '../../../utils/project-manager';
import PbcContacts from '.';

// The viewer is not rendered in these tests, but useInView needs an IntersectionObserver
beforeAll(() => {
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(cleanup);

describe('<PbcContacts />', () => {
  it('tells when there are no contacts across periodic boundaries', () => {
    render(
      <MemoryRouter>
        <ProjectCtx.Provider value={{ metadata: { WARNINGS: [{ tag: 'other', message: 'Other' }] } }}>
          <PbcContacts />
        </ProjectCtx.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/No contacts across periodic boundaries have been registered/)).toBeTruthy();
  });

  it('is always an available page', () => {
    const project = new Project({ accession: 'A0001', metadata: {}, analyses: [], files: [] });
    expect(project.directions.pbcontacts).toBe(true);
  });
});
