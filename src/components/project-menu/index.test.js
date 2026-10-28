import React from 'react';
import { render, cleanup, act } from '@testing-library/react';

import { HashRouter as Router } from 'react-router';

import ProjectMenu from '.';

afterAll(cleanup);

let fetchMock;
beforeAll(() => {
  fetchMock = vi.spyOn(global, 'fetch');
});

afterAll(() => {
  fetchMock.mockRestore();
});

describe('<ProjectMenu />', () => {
  let wrapper;

  afterEach(() => wrapper.unmount());

  // try to figure out which is the best way to test that
  it.skip('should render with data', () => {
    fetchMock.mockImplementation(() => ({ json: () => ['rgyr', 'pca'] }));
    wrapper = render(
      <Router>
        <ProjectMenu params={{ accession: 'MCNS00001', subPage: 'overview' }} />
      </Router>,
    );
    expect(wrapper.container.querySelectorAll('a').length).toBe(5);
  });
});
