"use client";

import { useState } from "react";

export interface FilePreviewProps {
  /** File name (e.g. "screenshot.png", "report.pdf"). */
  name: string;
  /** URL or data-URI for the file. */
  url: string;
  /** MIME type or inferred category. */
  type: "image" | "pdf" | "text" | "other";
  /** File size in bytes, if known. */
  sizeBytes?: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Parse an assistant message looking for inline images or file references.
 * Returns null when no file content is detected.
 */
export function parseFileContent(content: string): FilePreviewProps | null {
  // Markdown image: ![alt](url)
  const imgMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(content.trim());
  if (imgMatch) {
    const url = imgMatch[2] ?? "";
    // Only allow safe URL schemes
    if (/^(https?:|data:image\/|blob:|\/)/i.test(url)) {
      return { name: imgMatch[1] || "image", url, type: "image" };
    }
  }

  // JSON file result: { type: "file", name: "...", url: "...", size: 1234 }
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object") {
      const p = parsed as Record<string, unknown>;
      if (p["type"] === "file" && typeof p["name"] === "string" && typeof p["url"] === "string") {
        const ext = (p["name"] as string).split(".").pop()?.toLowerCase() ?? "";
        const type: FilePreviewProps["type"] =
          ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)
            ? "image"
            : ext === "pdf"
              ? "pdf"
              : ["txt", "md", "csv", "log"].includes(ext)
                ? "text"
                : "other";
        return {
          name: p["name"] as string,
          url: p["url"] as string,
          type,
          sizeBytes: typeof p["size"] === "number" ? p["size"] : undefined,
        };
      }
    }
  } catch {
    // Not JSON
  }

  return null;
}

export function FilePreview({ name, url, type, sizeBytes }: FilePreviewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (type === "image") {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="block max-w-sm my-2 rounded-xl overflow-hidden border border-border-subtle hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Open image: ${name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={name} className="w-full h-auto object-contain" />
        </button>

        {lightboxOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Image: ${name}`}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              type="button"
              className="absolute top-4 right-4 text-on-surface hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close lightbox"
            >
              <span className="material-symbols-outlined text-[2rem]" aria-hidden="true">close</span>
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={name}
              className="max-w-full max-h-full object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </>
    );
  }

  // Non-image: show download card
  const icon =
    type === "pdf" ? "picture_as_pdf" : type === "text" ? "description" : "attach_file";

  return (
    <a
      href={url}
      download={name}
      className="inline-flex items-center gap-3 px-4 py-3 my-2 rounded-xl border border-border-subtle bg-surface-container hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`Download ${name}${sizeBytes !== undefined ? ` (${formatBytes(sizeBytes)})` : ""}`}
    >
      <span className="material-symbols-outlined text-primary text-[1.5rem]" aria-hidden="true">
        {icon}
      </span>
      <div>
        <div className="text-[0.9375rem] font-semibold text-on-surface">{name}</div>
        {sizeBytes !== undefined && (
          <div className="text-[0.75rem] text-text-muted">{formatBytes(sizeBytes)}</div>
        )}
      </div>
      <span className="material-symbols-outlined text-text-muted ml-auto" aria-hidden="true">
        download
      </span>
    </a>
  );
}
