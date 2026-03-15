import { useState, useRef } from 'react';
import { useAuth } from '@clerk/react';

interface SketchUploadResponse {
  success: true;
  artboards: Array<{ name: string; artboardId: string }>;
  baselineCount: number;
}

interface SketchUploadCardProps {
  onMessage: (msg: { type: 'success' | 'error'; text: string }) => void;
}

export function SketchUploadCard({ onMessage }: SketchUploadCardProps) {
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    artboards: Array<{ name: string; artboardId: string }>;
    baselineCount: number;
  } | null>(null);

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  function validateAndSetFile(selectedFile: File) {
    if (!selectedFile.name.endsWith('.sketch')) {
      onMessage({ type: 'error', text: 'Please select a .sketch file' });
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      onMessage({ type: 'error', text: 'File exceeds 50MB limit' });
      return;
    }
    setFile(selectedFile);
    setUploadResult(null);
  }

  function handleUpload() {
    if (!file || !projectId.trim()) return;

    setUploadProgress(0);
    setUploadResult(null);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/sketch/upload');

    // Auth token is set asynchronously
    getToken().then((token) => {
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId.trim());

      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        setUploadProgress(null);
        if (xhr.status === 200) {
          const data: SketchUploadResponse = JSON.parse(xhr.responseText);
          setUploadResult({
            artboards: data.artboards,
            baselineCount: data.baselineCount,
          });
          onMessage({
            type: 'success',
            text: `Uploaded ${data.baselineCount} baselines from ${data.artboards.length} artboards`,
          });
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            onMessage({ type: 'error', text: err.error ?? 'Upload failed' });
          } catch {
            onMessage({ type: 'error', text: 'Upload failed' });
          }
        }
      };

      xhr.onerror = () => {
        setUploadProgress(null);
        onMessage({ type: 'error', text: 'Network error during upload' });
      };

      xhr.send(formData);
    });
  }

  const isUploading = uploadProgress !== null;

  return (
    <div className="s-glass mb-4 rounded-lg p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--s-text-primary)' }}>Sketch Upload</h3>
      </div>

      {/* Project ID input */}
      <div className="mb-3">
        <label className="s-input-label mb-1 block">
          Project ID
        </label>
        <input
          type="text"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="Enter project UUID"
          className="s-input w-full rounded-md px-3 py-2 text-sm"
        />
      </div>

      {/* Drop zone */}
      <div
        data-testid="drop-zone"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const droppedFile = e.dataTransfer.files[0];
          if (droppedFile) {
            validateAndSetFile(droppedFile);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className="mb-3 cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors"
        style={
          isDragging
            ? { borderColor: 'var(--s-accent)', background: 'var(--s-accent-dim)' }
            : { borderColor: 'var(--s-border-strong)' }
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".sketch"
          className="hidden"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0];
            if (selectedFile) {
              validateAndSetFile(selectedFile);
            }
          }}
        />
        {file ? (
          <p className="text-sm" style={{ color: 'var(--s-text-primary)' }}>{file.name}</p>
        ) : (
          <p className="text-sm" style={{ color: 'var(--s-text-secondary)' }}>
            Drag & drop a .sketch file here, or click to browse
          </p>
        )}
      </div>

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={!file || !projectId.trim() || isUploading}
        className="s-btn s-btn-primary"
      >
        {isUploading ? 'Uploading...' : 'Upload'}
      </button>

      {/* Progress bar */}
      {uploadProgress !== null && (
        <div className="mt-3">
          <div className="h-2 w-full rounded-full" style={{ background: 'var(--s-bg-raised)' }}>
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${uploadProgress}%`, background: 'var(--s-accent)' }}
            />
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--s-text-secondary)' }}>{uploadProgress}%</p>
        </div>
      )}

      {/* Upload result */}
      {uploadResult && (
        <div className="mt-3 rounded-md p-3" style={{ background: 'var(--s-success-dim)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--s-success)' }}>
            Uploaded {uploadResult.baselineCount} baselines from{' '}
            {uploadResult.artboards.length} artboards
          </p>
          <ul className="mt-2 list-inside list-disc text-sm" style={{ color: 'var(--s-success)' }}>
            {uploadResult.artboards.map((ab) => (
              <li key={ab.artboardId}>{ab.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
