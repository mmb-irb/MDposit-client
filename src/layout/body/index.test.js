import React from 'react';
import { render } from '@testing-library/react';

import Body from '.';

describe('<Body />', () => {
  it('should render its children inside a <div>', () => {
    const { container } = render(
      <Body>
        <section>content</section>
      </Body>,
    );
    const div = container.firstChild;
    expect(div.tagName).toBe('DIV');
    expect(div.querySelector('section')).not.toBeNull();
  });
});
