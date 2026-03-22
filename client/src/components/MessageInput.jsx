import { useEffect, useRef, useState } from 'react';
import AttachmentPreview from './AttachmentPreview';

const QUICK_EMOJIS = ['😀', '😂', '😍', '🥳', '👍', '🙏', '🔥', '🎉', '❤️', '🤝', '😎', '🤔'];
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const allowedAttachmentMimeTypes = new Set([
  'application/json',
  'application/msword',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
  'text/csv',
  'text/plain',
]);

function isAllowedAttachmentFile(file) {
  return file.type.startsWith('image/') || allowedAttachmentMimeTypes.has(file.type);
}

function createComposerAttachment(file) {
  const attachmentId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id: attachmentId,
    file,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    kind: file.type.startsWith('image/') ? 'image' : 'file',
    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
  };
}

function MessageInput({
  conversationId,
  onSend,
  onTyping,
  onStopTyping,
  replyToMessage,
  editingMessage,
  onCancelReply,
  onCancelEdit,
}) {
  const [message, setMessage] = useState(() => editingMessage?.content || '');
  const [attachments, setAttachments] = useState([]);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const textAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachmentsRef = useRef([]);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, [conversationId, editingMessage?.id]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => () => {
    attachmentsRef.current.forEach((attachment) => {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (isTypingRef.current && onStopTyping) {
        onStopTyping();
      }
    };
  }, [onStopTyping]);

  const emitStopTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (isTypingRef.current && onStopTyping) {
      onStopTyping();
    }

    isTypingRef.current = false;
  };

  const scheduleTypingStop = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      emitStopTyping();
    }, 1200);
  };

  const clearAttachments = () => {
    setAttachments((currentAttachments) => {
      currentAttachments.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });

      return [];
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (attachmentId) => {
    setAttachments((currentAttachments) => currentAttachments.filter((attachment) => {
      if (attachment.id !== attachmentId) {
        return true;
      }

      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }

      return false;
    }));
  };

  const handleChange = (event) => {
    setMessage(event.target.value);

    if (onTyping) {
      onTyping();
    }

    isTypingRef.current = true;

    scheduleTypingStop();
  };

  const handleAttachmentSelection = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) {
      return;
    }

    setAttachmentError('');

    setAttachments((currentAttachments) => {
      const nextAttachments = [...currentAttachments];

      for (const file of selectedFiles) {
        if (nextAttachments.length >= MAX_ATTACHMENTS) {
          setAttachmentError(`You can attach up to ${MAX_ATTACHMENTS} files at once.`);
          break;
        }

        if (!isAllowedAttachmentFile(file)) {
          setAttachmentError('Only images, documents, text files, JSON, CSV, and zip files are supported.');
          continue;
        }

        if (file.size > MAX_ATTACHMENT_SIZE) {
          setAttachmentError('Each file must be 10 MB or smaller.');
          continue;
        }

        nextAttachments.push(createComposerAttachment(file));
      }

      return nextAttachments;
    });

    event.target.value = '';
  };

  const insertEmoji = (emoji) => {
    const target = textAreaRef.current;

    if (!target) {
      setMessage((prev) => `${prev}${emoji}`);
      return;
    }

    const start = target.selectionStart ?? message.length;
    const end = target.selectionEnd ?? message.length;
    const nextValue = `${message.slice(0, start)}${emoji}${message.slice(end)}`;

    setMessage(nextValue);

    requestAnimationFrame(() => {
      target.focus();
      const cursorPosition = start + emoji.length;
      target.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if ((!message.trim() && attachments.length === 0) || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setAttachmentError('');

    try {
      await onSend({
        content: message,
        attachments: attachments.map((attachment) => attachment.file),
      });

      emitStopTyping();
      setIsEmojiPickerOpen(false);

      if (!editingMessage) {
        setMessage('');
        clearAttachments();
      }
    } catch (error) {
      setAttachmentError(error.message || 'Unable to send this message right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit(event);
    }
  };

  const composerLabel = editingMessage
    ? 'Editing your message'
    : replyToMessage
      ? `Replying to ${replyToMessage.senderName}`
      : null;

  const composerPreview = editingMessage
    ? editingMessage.previewText || editingMessage.content
    : replyToMessage?.deletedAt
      ? 'Message deleted'
      : replyToMessage?.previewText || replyToMessage?.content;

  return (
    <form onSubmit={handleSubmit} className="theme-surface border-t px-4 py-4 sm:px-5 theme-border">
      {(replyToMessage || editingMessage) && (
        <div className="theme-surface-muted theme-border mb-3 flex items-start justify-between gap-3 rounded-2xl border px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-600">
              {composerLabel}
            </p>
            <p className="theme-muted mt-1 truncate text-sm">{composerPreview}</p>
          </div>
          <button
            type="button"
            onClick={editingMessage ? onCancelEdit : onCancelReply}
            className="theme-muted rounded-full p-1.5 transition hover:bg-slate-200/70 hover:text-slate-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {!editingMessage && attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-3">
          {attachments.map((attachment) => (
            <AttachmentPreview
              key={attachment.id}
              attachment={attachment}
              variant="composer"
              onRemove={() => removeAttachment(attachment.id)}
            />
          ))}
        </div>
      )}

      {attachmentError && (
        <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {attachmentError}
        </div>
      )}

      <div className="flex items-end gap-3">
        {!editingMessage && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,.pdf,.txt,.csv,.json,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              onChange={handleAttachmentSelection}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              className="mb-1 flex-shrink-0 rounded-full p-2 transition hover:bg-slate-200/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="theme-muted h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
          </>
        )}

        <div className="relative flex-1">
          <textarea
            ref={textAreaRef}
            rows={1}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={emitStopTyping}
            placeholder={editingMessage ? 'Update your message...' : attachments.length > 0 ? 'Add a caption...' : 'Type a message...'}
            className="theme-input max-h-40 min-h-[3.25rem] w-full resize-none rounded-[1.5rem] px-4 py-3 text-sm leading-6 outline-none transition"
            disabled={isSubmitting}
          />

          {isEmojiPickerOpen && (
            <div className="theme-card theme-border absolute bottom-[calc(100%+0.75rem)] right-0 z-20 rounded-2xl border p-2 shadow-xl">
              <div className="grid grid-cols-[repeat(6,2.5rem)] justify-center gap-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="group flex h-10 w-10 items-center justify-center rounded-full leading-none transition"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full text-[1.35rem] leading-none transition group-hover:bg-slate-200/70">
                      {emoji}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
          disabled={isSubmitting}
          className="mb-1 flex-shrink-0 rounded-full p-2 transition hover:bg-slate-200/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="theme-muted h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        <button
          type="submit"
          disabled={(!message.trim() && attachments.length === 0) || isSubmitting}
          className="mb-1 flex-shrink-0 rounded-full bg-indigo-600 p-2.5 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}

export default MessageInput;
