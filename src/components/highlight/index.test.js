import React from 'react';
import { render } from '@testing-library/react';

import Highlight from '.';

describe('<Highlight />', () => {
  it('renders nothing when there are no children', () => {
    expect(render(<Highlight />).container).toBeEmptyDOMElement();
    expect(render(<Highlight highlight="h" />).container).toBeEmptyDOMElement();
    expect(
      render(<Highlight highlight="h">{''}</Highlight>).container,
    ).toBeEmptyDOMElement();
  });

  it('renders children as-is when there is no highlight to apply', () => {
    expect(render(<Highlight>hello</Highlight>).container.textContent).toBe(
      'hello',
    );
    expect(
      render(<Highlight highlight="">hello</Highlight>).container.textContent,
    ).toBe('hello');
  });

  it('renders non-string/non-number children unchanged', () => {
    const { container } = render(
      <Highlight highlight="he">
        <span>hello</span>
      </Highlight>,
    );
    expect(container.innerHTML).toBe('<span>hello</span>');
  });

  it('wraps the matching fragment in <mark> and the rest in <span>', () => {
    const { container } = render(<Highlight highlight="ll">hello</Highlight>);
    const wrapper = container.firstChild;
    expect(wrapper.textContent).toBe('hello');
    expect(wrapper.querySelectorAll('mark')).toHaveLength(1);
    expect(wrapper.querySelector('mark').textContent).toBe('ll');
  });

  it('highlights every matching occurrence, case-insensitively', () => {
    const { container } = render(
      <Highlight highlight="he">hello hello</Highlight>,
    );
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(2);
    marks.forEach(mark => expect(mark.textContent).toBe('he'));
  });

  it('stringifies numeric children before highlighting', () => {
    const { container } = render(<Highlight highlight="2">{1234}</Highlight>);
    expect(container.textContent).toBe('1234');
    expect(container.querySelectorAll('mark')).toHaveLength(1);
    expect(container.querySelector('mark').textContent).toBe('2');
  });

  it('accepts a numeric highlight', () => {
    const { container } = render(<Highlight highlight={2}>{1234}</Highlight>);
    expect(container.textContent).toBe('1234');
    expect(container.querySelectorAll('mark')).toHaveLength(1);
  });
});
