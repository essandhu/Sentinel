import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportButton } from './ExportButton';

describe('ExportButton', () => {
  const onExportPdf = vi.fn();
  const onExportCsv = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderButton(loading = false) {
    return render(
      <ExportButton onExportPdf={onExportPdf} onExportCsv={onExportCsv} loading={loading} />,
    );
  }

  it('opens dropdown and shows options on click', async () => {
    renderButton();

    expect(screen.queryByText('Download PDF Report')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /export/i }));

    expect(screen.getByText('Download PDF Report')).toBeInTheDocument();
    expect(screen.getByText('Export CSV Data')).toBeInTheDocument();
  });

  it('calls onExportPdf when PDF option is clicked', async () => {
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: /export/i }));
    await userEvent.click(screen.getByText('Download PDF Report'));

    expect(onExportPdf).toHaveBeenCalledTimes(1);
    expect(onExportCsv).not.toHaveBeenCalled();
  });

  it('calls onExportCsv when CSV option is clicked', async () => {
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: /export/i }));
    await userEvent.click(screen.getByText('Export CSV Data'));

    expect(onExportCsv).toHaveBeenCalledTimes(1);
    expect(onExportPdf).not.toHaveBeenCalled();
  });

  it('closes dropdown after option is clicked', async () => {
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: /export/i }));
    expect(screen.getByText('Download PDF Report')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Download PDF Report'));
    expect(screen.queryByText('Download PDF Report')).not.toBeInTheDocument();
  });

  it('shows spinner when loading', () => {
    renderButton(true);
    expect(screen.getByTestId('export-spinner')).toBeInTheDocument();
  });
});
