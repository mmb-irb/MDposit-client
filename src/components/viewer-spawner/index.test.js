import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import ViewerSpawner from '.';

// Esto ha cambiado mucho. hay que probarlo
describe('<ViewerSpawner />', () => {
  it('should render without crashing when there is no viewer to spawn', () => {
    const { container } = render(
      // Animated cards require a router context to re-animate on every location change
      <MemoryRouter>
        <ViewerSpawner
          accession="MCNS00001"
          analysis="fluctuation"
          requestedFrame="1"
        />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
