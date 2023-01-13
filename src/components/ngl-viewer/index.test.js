import React from 'react';
import { shallow } from 'enzyme';

import { ProjectCtx, PdbCtx } from '../../contexts';
import NGLViewer from '.';

const renderWrapped = children =>
  shallow(
    <ProjectCtx.Provider value={{ metadata: {} }}>
      <PdbCtx.Provider value={{}}>{children}</PdbCtx.Provider>
    </ProjectCtx.Provider>,
  );

describe('<NGLViewer />', () => {
  it('should render without crashing', () => {
    expect(() => renderWrapped(<NGLViewer />)).not.toThrow();
  });
});
