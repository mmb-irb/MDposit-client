import React from 'react';
import { render } from '@testing-library/react';

import ViewerSpawner from '.';

// Esto ha cambiado mucho. hay que probarlo
describe('<ViewerSpawner />', () => {
  it('should render without crashing when there is no viewer to spawn', () => {
    const { container } = render(
      <ViewerSpawner
        accession="MCNS00001"
        analysis="fluctuation"
        requestedFrame="1"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
