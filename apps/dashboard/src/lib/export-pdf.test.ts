import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSave = vi.fn();
const mockText = vi.fn();
const mockSetFontSize = vi.fn();
const mockAutoTable = vi.fn();
const mockGetY = vi.fn(() => 20);

vi.mock('jspdf', () => {
  class JsPDFMock {
    text = mockText;
    setFontSize = mockSetFontSize;
    save = mockSave;
    autoTable = mockAutoTable;
    lastAutoTable = { finalY: 50 };
    internal = { pageSize: { getWidth: () => 210 } };
  }
  return { default: JsPDFMock, jsPDF: JsPDFMock };
});

vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}));

import { generateProjectReport, type ProjectReportData } from './export-pdf';

describe('generateProjectReport', () => {
  const sampleData: ProjectReportData = {
    projectName: 'TestProject',
    generatedAt: '2026-03-10',
    windowDays: 30,
    healthTrend: [
      { date: '2026-03-08', score: 85 },
      { date: '2026-03-09', score: 90 },
    ],
    regressionTrend: [
      { date: '2026-03-08', count: 2 },
      { date: '2026-03-09', count: 1 },
    ],
    teamMetrics: {
      meanTimeToApproveMs: 3600000,
      approvalVelocity: 0.5,
      totalApprovals: 15,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates document with correct title', () => {
    generateProjectReport(sampleData);

    expect(mockText).toHaveBeenCalledWith(
      'Sentinel Project Report - TestProject',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('calls autoTable for each data section', () => {
    generateProjectReport(sampleData);

    // Should have 3 autoTable calls: health trend, regression trend, team metrics
    expect(mockAutoTable).toHaveBeenCalledTimes(3);
  });

  it('calls save with expected filename', () => {
    generateProjectReport(sampleData);

    expect(mockSave).toHaveBeenCalledWith('sentinel-report-TestProject-2026-03-10.pdf');
  });

  it('handles null meanTimeToApproveMs', () => {
    const dataWithNull = {
      ...sampleData,
      teamMetrics: { ...sampleData.teamMetrics, meanTimeToApproveMs: null },
    };

    generateProjectReport(dataWithNull);

    expect(mockSave).toHaveBeenCalled();
  });
});
