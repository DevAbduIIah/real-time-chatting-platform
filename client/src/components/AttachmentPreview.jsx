import { getAssetUrl } from '../lib/api';
import { formatFileSize } from '../lib/formatters';

function resolveAttachmentUrl(attachment) {
  return getAssetUrl(attachment.previewUrl || attachment.url || null);
}

function AttachmentPreview({ attachment, variant = 'message', onRemove = null }) {
  const attachmentUrl = resolveAttachmentUrl(attachment);
  const attachmentName = attachment.originalName || attachment.name || 'Attachment';
  const attachmentSize = formatFileSize(attachment.size);
  const isImage = attachment.kind === 'image';

  if (isImage && attachmentUrl) {
    if (variant === 'composer') {
      return (
        <div className="relative overflow-hidden rounded-2xl border theme-border">
          <img
            src={attachmentUrl}
            alt={attachmentName}
            className="h-24 w-24 object-cover"
          />
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white transition hover:bg-black/75"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      );
    }

    return (
      <a
        href={attachmentUrl}
        target="_blank"
        rel="noreferrer"
        className="block max-w-full overflow-hidden rounded-2xl border transition hover:opacity-95 theme-border"
      >
        <img
          src={attachmentUrl}
          alt={attachmentName}
          className="block max-h-72 w-full max-w-full object-cover"
        />
      </a>
    );
  }

  const content = (
    <div className={`theme-surface-muted theme-border flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
      variant === 'composer' ? 'min-w-[12rem]' : ''
    }`}>
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h10M7 11h10M7 15h6m-7 6h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="theme-text truncate text-sm font-medium">{attachmentName}</p>
        <p className="theme-muted truncate text-xs">
          {attachmentSize || attachment.mimeType || 'File'}
        </p>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="theme-muted rounded-full p-1 transition hover:bg-slate-200/70 hover:text-slate-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );

  if (!attachmentUrl || variant === 'composer') {
    return content;
  }

  return (
    <a href={attachmentUrl} target="_blank" rel="noreferrer" className="block max-w-full">
      {content}
    </a>
  );
}

export default AttachmentPreview;
