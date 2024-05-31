import React from 'react';
import { shallow } from 'enzyme';

import ViewerSpawner from '.';
// Esto ha cambiado mucho. hay que probarlo
describe('<ViewerSpawner />', () => {
  it('should render', () => {
    expect(
      shallow(
        <ViewerSpawner
          accession="MCNS00001"
          analysis="fluctuation"
          requestedFrame="1"
        />,
      ),
    ).toMatchSnapshot();
  });
});
