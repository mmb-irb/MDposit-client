import React from 'react';
import { render, screen } from '@testing-library/react';

import StatisticsTable from '.';

describe('<StatisticsTable />', () => {
  it('should render just the header row when there is no data', () => {
    render(<StatisticsTable />);
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('mean')).toBeInTheDocument();
    expect(screen.getByText('standard deviation')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });

  it('should render a formatted row per analysis', () => {
    render(
      <StatisticsTable
        y={{
          rgyr: { average: Math.PI, stddev: 1 },
          'other-analysis': { average: 2, stddev: 2 },
        }}
      />,
    );
    expect(screen.getAllByRole('row')).toHaveLength(3);

    const rgyrRow = screen.getByText('Radius of gyration').closest('tr');
    expect(rgyrRow.textContent).toContain('3.1416');
    expect(rgyrRow.textContent).toContain('1.0000');

    const otherRow = screen.getByText('other-analysis').closest('tr');
    expect(otherRow.textContent).toContain('2.0000');
  });
});
