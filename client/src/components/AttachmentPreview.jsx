import { getAssetUrl } from '../lib/api';

function formatFileSize(size) {
  if (!size) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}

function AttachmentPreview({ attachment, compact = false }) {
  const attachmentUrl = getAssetUrl(attachment.url);

  if (attachment.kind === 'image') {
    return (
      <a
        href={attachmentUrl}
        target="_blank"
        rel="noreferrer"
        className={`block overflow-hidden rounded-2xl ring-1 ring-white/10 ${compact ? 'max-w-[11rem]' : 'max-w-[22rem]'}`}
      >
        <img
          src={attachmentUrl}
          alt={attachment.originalName}
          className={`w-full object-cover ${compact ? 'h-28' : 'max-h-80'}`}
        />
      </a>
    );
  }

  return (
    <a
      href={attachmentUrl}
      target="_blank"
      rel="noreferrer"
      className="theme-surface-muted flex items-center gap-3 rounded-2xl px-3 py-3 ring-1 ring-[color:var(--border-subtle)] transition hover:bg-slate-200/60"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h10M7 11h10M7 15h6m5 6H6a2 2 0 01-2-2V5a2 2 0 012-2h7.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="theme-text truncate text-sm font-medium">{attachment.originalName}</p>
        <p className="theme-muted text-xs">{formatFileSize(attachment.size)}</p>
      </div>
    </a>
  );
}

export default AttachmentPreview;
