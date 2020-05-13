import React from 'react';
import { render, cleanup } from '@testing-library/react';

import Graph from '.';

const y = { value: { data: [1, 2] } };

describe('<Graph />', () => {
  let wrapper;

  afterEach(() => wrapper && wrapper.unmount());

  afterAll(cleanup);

  it('renders without crashing', () => {
    expect(
      () => (wrapper = render(<Graph y={y} xLabel="x" yLabel="y" />)),
    ).not.toThrow();
    expect(
      () => (wrapper = render(<Graph y={y} selected={1} />)),
    ).not.toThrow();
    expect(
      () => (wrapper = render(<Graph y={y} selected={new Set([1])} />)),
    ).not.toThrow();
    expect(
      () => (wrapper = render(<Graph y={y} defaultPrecision={1} />)),
    ).not.toThrow();
    expect(
      () => (wrapper = render(<Graph y={y} defaultPrecision={2} />)),
    ).not.toThrow();
    expect(
      () =>
        (wrapper = render(<Graph y={y} type="dash" selected={new Set()} />)),
    ).not.toThrow();
    expect(() => (wrapper = render(<Graph y={y} type="dash" />))).not.toThrow();
  });
});
