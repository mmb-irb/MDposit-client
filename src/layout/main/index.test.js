import React from 'react';
import { render } from '@testing-library/react';

import Main from '.';

describe('<Main />', () => {
  it('should render its children inside a <main> element', () => {
    const { container } = render(
      <Main>
        <section>content</section>
      </Main>,
    );
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main.querySelector('section')).not.toBeNull();
  });
});
