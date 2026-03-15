import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from './DataTable';

interface TestItem {
  id: string;
  name: string;
  value: number;
}

const columns = [
  { key: 'name', header: 'Name', render: (item: TestItem) => item.name },
  { key: 'value', header: 'Value', render: (item: TestItem) => String(item.value) },
];

const data: TestItem[] = [
  { id: '1', name: 'Alpha', value: 10 },
  { id: '2', name: 'Beta', value: 20 },
];

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable data={data} columns={columns} rowKey={(item) => item.id} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('renders rows with data', () => {
    render(<DataTable data={data} columns={columns} rowKey={(item) => item.id} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('calls onRowClick when row is clicked', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable data={data} columns={columns} rowKey={(item) => item.id} onRowClick={onRowClick} />
    );

    await user.click(screen.getByText('Alpha'));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });

  it('shows empty message when data is empty', () => {
    render(<DataTable data={[]} columns={columns} rowKey={(item: TestItem) => item.id} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows default "No data" when data is empty and no emptyMessage', () => {
    render(<DataTable data={[]} columns={columns} rowKey={(item: TestItem) => item.id} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});
