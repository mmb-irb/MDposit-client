import React from 'react';
import { render, screen } from '@testing-library/react';

import Contact from '.';

describe('<Contact />', () => {
  it('should render the "Get in touch" heading', () => {
    render(<Contact />);
    expect(screen.getByText('Get in touch')).toBeInTheDocument();
  });
});
