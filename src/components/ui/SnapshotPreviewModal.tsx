'use client';

// =============================================================================
// SnapshotPreviewModal — Screenshot preview with copy/save actions
// =============================================================================
// Shows a rendered portfolio snapshot in a modal dialog.
// Provides clipboard copy and PNG download buttons.
// Follows SymbolSearchModal backdrop/content animation pattern.
// =============================================================================

import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { downloadBlob, copyBlobToClipboard } from '@/utils/portfolioSnapshot';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SnapshotPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  blob: Blob | null;
  filename: string;
}

// -----------------------------------------------------------------------------
// Blob → data: URL conversion (avoids CSP blob: restriction on img-src)
// FileReader callback is async, so setState only fires in the callback — not
// synchronously within the effect body — satisfying react-hooks/set-state-in-effect.
// -----------------------------------------------------------------------------

function useBlobDataUrl(blob: Blob | null): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      // Schedule null via microtask to avoid synchronous setState in effect
      const id = requestAnimationFrame(() => setDataUrl(null));
      return () => cancelAnimationFrame(id);
    }
    let aborted = false;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (!aborted) {
        setDataUrl(reader.result as string);
      }
    };
    reader.readAsDataURL(blob);
    return () => {
      aborted = true;
    };
  }, [blob]);

  return dataUrl;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const SnapshotPreviewModal = memo(function SnapshotPreviewModal({
  isOpen,
  onClose,
  blob,
  filename,
}: SnapshotPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewDataUrl = useBlobDataUrl(blob);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleClose = useCallback(() => {
    setCopied(false);
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = null;
    }
    onClose();
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose],
  );

  const handleCopy = useCallback(async () => {
    if (!blob) return;
    try {
      await copyBlobToClipboard(blob);
      setCopied(true);
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = setTimeout(() => {
        setCopied(false);
        copiedTimerRef.current = null;
      }, 1500);
    } catch {
      console.error('[SnapshotPreviewModal] Failed to copy to clipboard');
    }
  }, [blob]);

  const handleSave = useCallback(() => {
    if (!blob) return;
    downloadBlob(blob, filename);
  }, [blob, filename]);

  if (!isOpen || !blob) return null;

  return (
    <div
      className="animate-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot preview"
    >
      <div className="animate-modal-content border-border bg-background-secondary mx-4 flex w-full max-w-sm flex-col overflow-hidden rounded-xl border shadow-2xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <span className="text-foreground text-sm font-medium">Screenshot Preview</span>
          <button
            type="button"
            onClick={handleClose}
            className="text-foreground-tertiary hover:text-foreground cursor-pointer rounded p-1 transition-colors"
            aria-label="Close"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Image Preview — data: URL for CSP compatibility, next/image doesn't support data: */}
        <div className="flex justify-center p-4">
          {previewDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewDataUrl}
              alt="Portfolio snapshot"
              className="border-border max-h-[60vh] w-auto rounded-lg border"
            />
          )}
        </div>

        {/* Action Buttons */}
        <div className="border-border flex gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={handleCopy}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
              copied
                ? 'bg-buy/10 text-buy'
                : 'bg-background-tertiary text-foreground hover:bg-background-tertiary/80'
            }`}
          >
            {copied ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="bg-accent/10 text-accent hover:bg-accent/20 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Save
          </button>
        </div>
      </div>
    </div>
  );
});
