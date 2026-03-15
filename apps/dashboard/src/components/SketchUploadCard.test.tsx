import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Clerk
vi.mock('@clerk/react', () => ({
  useAuth: () => ({ getToken: vi.fn(() => Promise.resolve('test-token')) }),
}));

// Mock XMLHttpRequest
const mockXHRInstance = {
  open: vi.fn(),
  send: vi.fn(),
  setRequestHeader: vi.fn(),
  upload: {} as { onprogress?: (e: ProgressEvent) => void },
  onload: null as ((e: Event) => void) | null,
  onerror: null as ((e: Event) => void) | null,
  status: 200,
  responseText: '',
};

class MockXMLHttpRequest {
  get open() { return mockXHRInstance.open; }
  get send() { return mockXHRInstance.send; }
  get setRequestHeader() { return mockXHRInstance.setRequestHeader; }
  get upload() { return mockXHRInstance.upload; }
  set upload(val) { mockXHRInstance.upload = val; }
  get onload() { return mockXHRInstance.onload; }
  set onload(fn) { mockXHRInstance.onload = fn; }
  get onerror() { return mockXHRInstance.onerror; }
  set onerror(fn) { mockXHRInstance.onerror = fn; }
  get status() { return mockXHRInstance.status; }
  get responseText() { return mockXHRInstance.responseText; }
}

beforeEach(() => {
  vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);
  // Reset instance state
  mockXHRInstance.open.mockClear();
  mockXHRInstance.send.mockClear();
  mockXHRInstance.setRequestHeader.mockClear();
  mockXHRInstance.upload = {};
  mockXHRInstance.onload = null;
  mockXHRInstance.onerror = null;
  mockXHRInstance.status = 200;
  mockXHRInstance.responseText = '';
});

import { SketchUploadCard } from './SketchUploadCard';

describe('SketchUploadCard', () => {
  const mockOnMessage = vi.fn();

  beforeEach(() => {
    mockOnMessage.mockClear();
  });

  it('renders drag-drop zone with instructional text and file input', () => {
    render(<SketchUploadCard onMessage={mockOnMessage} />);

    expect(
      screen.getByText(/drag & drop a \.sketch file here, or click to browse/i),
    ).toBeInTheDocument();

    const fileInput = document.querySelector(
      'input[type="file"][accept=".sketch"]',
    ) as HTMLInputElement;
    expect(fileInput).toBeTruthy();
  });

  it('rejects non-.sketch files with error message', () => {
    render(<SketchUploadCard onMessage={mockOnMessage} />);

    const dropZone = screen.getByTestId('drop-zone');

    // Simulate dropping a non-.sketch file
    const badFile = new File(['data'], 'design.png', { type: 'image/png' });
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [badFile] },
    });

    expect(mockOnMessage).toHaveBeenCalledWith({
      type: 'error',
      text: 'Please select a .sketch file',
    });
  });

  it('shows progress bar during upload', async () => {
    const user = userEvent.setup();
    render(<SketchUploadCard onMessage={mockOnMessage} />);

    // Set a projectId
    const projectIdInput = screen.getByPlaceholderText(/enter project uuid/i);
    await user.type(projectIdInput, 'test-project-id');

    // Select a valid file
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const sketchFile = new File(['sketch-data'], 'design.sketch', {
      type: 'application/octet-stream',
    });
    await user.upload(fileInput, sketchFile);

    // Click upload
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    await user.click(uploadButton);

    // Wait for getToken() promise to resolve and XHR handlers to be set
    await waitFor(() => {
      expect(mockXHRInstance.send).toHaveBeenCalled();
    });

    // Simulate progress event
    const progressHandler = mockXHRInstance.upload.onprogress;
    expect(progressHandler).toBeDefined();
    progressHandler!({
      lengthComputable: true,
      loaded: 50,
      total: 100,
    } as ProgressEvent);

    // Should show progress bar with 50%
    await waitFor(() => {
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  it('shows success message with artboard and baseline counts on successful upload', async () => {
    const user = userEvent.setup();
    render(<SketchUploadCard onMessage={mockOnMessage} />);

    // Set projectId and file
    const projectIdInput = screen.getByPlaceholderText(/enter project uuid/i);
    await user.type(projectIdInput, 'test-project-id');

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const sketchFile = new File(['sketch-data'], 'design.sketch', {
      type: 'application/octet-stream',
    });
    await user.upload(fileInput, sketchFile);

    // Click upload
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    await user.click(uploadButton);

    // Wait for getToken() promise to resolve and XHR handlers to be set
    await waitFor(() => {
      expect(mockXHRInstance.send).toHaveBeenCalled();
    });

    // Simulate successful response
    mockXHRInstance.status = 200;
    mockXHRInstance.responseText = JSON.stringify({
      success: true,
      artboards: [
        { name: 'Login Screen', artboardId: 'ab-1' },
        { name: 'Dashboard', artboardId: 'ab-2' },
      ],
      baselineCount: 5,
    });
    mockXHRInstance.onload!({} as Event);

    await waitFor(() => {
      expect(
        screen.getByText(/uploaded 5 baselines from 2 artboards/i),
      ).toBeInTheDocument();
      expect(screen.getByText('Login Screen')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('shows error message on upload failure', async () => {
    const user = userEvent.setup();
    render(<SketchUploadCard onMessage={mockOnMessage} />);

    // Set projectId and file
    const projectIdInput = screen.getByPlaceholderText(/enter project uuid/i);
    await user.type(projectIdInput, 'test-project-id');

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const sketchFile = new File(['sketch-data'], 'design.sketch', {
      type: 'application/octet-stream',
    });
    await user.upload(fileInput, sketchFile);

    // Click upload
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    await user.click(uploadButton);

    // Wait for getToken() promise to resolve and XHR handlers to be set
    await waitFor(() => {
      expect(mockXHRInstance.send).toHaveBeenCalled();
    });

    // Simulate network error
    mockXHRInstance.onerror!({} as Event);

    await waitFor(() => {
      expect(mockOnMessage).toHaveBeenCalledWith({
        type: 'error',
        text: 'Network error during upload',
      });
    });
  });

  it('disables upload button when projectId is empty', () => {
    render(<SketchUploadCard onMessage={mockOnMessage} />);

    const uploadButton = screen.getByRole('button', { name: /upload/i });
    expect(uploadButton).toBeDisabled();
  });

  it('changes border styling on drag over', () => {
    render(<SketchUploadCard onMessage={mockOnMessage} />);

    const dropZone = screen.getByText(
      /drag & drop a \.sketch file here, or click to browse/i,
    ).closest('[data-testid="drop-zone"]')!;

    // Initially should have default border (via inline style)
    expect(dropZone).toBeInTheDocument();

    // Simulate drag over - inline style changes to accent
    fireEvent.dragOver(dropZone, { dataTransfer: { files: [] } });

    expect((dropZone as HTMLElement).style.borderColor).toContain('var(--s-accent)');

    // Simulate drag leave - reverts
    fireEvent.dragLeave(dropZone);

    expect((dropZone as HTMLElement).style.borderColor).toContain('var(--s-border-strong)');
  });
});
