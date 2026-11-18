import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import Warnings from '.';

afterEach(cleanup);

describe('<Warnings />', () => {
  it('shows the description only after clicking "See more"', () => {
    render(<Warnings warnings={[{
      tag: 'pbcontacts',
      message: 'Cross-PBC contacts detected in 1/134 frames',
      description: 'Non-PBC molecules appear to contact each other.\nFrame 25 has the most atoms in contact (2).',
    }]} />);
    expect(screen.getByText('Cross-PBC contacts detected in 1/134 frames')).toBeTruthy();
    expect(screen.queryByText(/Non-PBC molecules/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'See more' }));
    expect(screen.getByText(/Non-PBC molecules/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'See less' })).toBeTruthy();
  });

  it('shows no button for warnings without description', () => {
    render(<Warnings warnings={[{ tag: 'old', message: 'Old style warning' }]} />);
    expect(screen.getByText('Old style warning')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('links only the first PBC contacts warning when the URL is passed', () => {
    const warning = { tag: 'pbcontacts', message: 'Cross-PBC contacts' };
    render(
      <MemoryRouter>
        <Warnings
          warnings={[{ tag: 'old', message: 'Old style warning' }, warning, { ...warning, message: 'Repeated' }]}
          pbcContactsUrl="/id/A0001/pbcontacts"
        />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole('link', { name: 'See contacts' });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/id/A0001/pbcontacts');
  });

  it('shows no link when the URL is missing', () => {
    render(<Warnings warnings={[{ tag: 'pbcontacts', message: 'Cross-PBC contacts' }]} />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
