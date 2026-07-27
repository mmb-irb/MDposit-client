import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Contact from '.';

describe('<Contact />', () => {
  it('should render the "Get in touch" heading', () => {
    // Animated cards require a router context to re-animate on every location change
    render(<MemoryRouter><Contact /></MemoryRouter>);
    expect(screen.getByText('Get in touch')).toBeInTheDocument();
  });
});
