import { useEffect, useRef, useState } from 'react';
import AttachmentPreview from './AttachmentPreview';

const QUICK_EMOJIS = ['😀', '😂', '😍', '🥳', '👍', '🙏', '🔥', '🎉', '❤️', '🤝', '😎', '🤔'];
const MAX_ATTACHMENTS = 4;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function createLocalAttachment(file) {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    kind: file.type.startsWith('image/') ? 'image' : 'file',
    url: URL.createObjectURL(file),
    file,
    isLocal: true,
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
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const textAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachmentsRef = useRef([]);

  useEffect(() => {
    attachmentsRef.current = selectedAttachments;
  }, [selectedAttachments]);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, [conversationId, editingMessage?.id]);

  useEffect(() => () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (isTypingRef.current && onStopTyping) {
      onStopTyping();
    }

    attachmentsRef.current.forEach((attachment) => {
      if (attachment.isLocal) {
        URL.revokeObjectURL(attachment.url);
      }
    });
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

  const handleChange = (event) => {
    setMessage(event.target.value);

    if (onTyping) {
      onTyping();
    }

    isTypingRef.current = true;
    scheduleTypingStop();
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

  const clearAttachment = (attachmentId) => {
    setSelectedAttachments((prev) => {
      const nextAttachments = prev.filter((attachment) => attachment.id !== attachmentId);
      const removedAttachment = prev.find((attachment) => attachment.id === attachmentId);

      if (removedAttachment?.isLocal) {
        URL.revokeObjectURL(removedAttachment.url);
      }

      return nextAttachments;
    });
  };

  const handleSelectFiles = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    const nextAttachments = [];

    files.forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        return;
      }

      nextAttachments.push(createLocalAttachment(file));
    });

    setSelectedAttachments((prev) => {
      const merged = [...prev, ...nextAttachments].slice(0, MAX_ATTACHMENTS);
      const discarded = [...prev, ...nextAttachments].slice(MAX_ATTACHMENTS);

      discarded.forEach((attachment) => {
        if (attachment.isLocal) {
          URL.revokeObjectURL(attachment.url);
        }
      });

      return merged;
    });

    event.target.value = '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if ((!message.trim() && selectedAttachments.length === 0) || isSending) {
      return;
    }

    setIsSending(true);

    try {
      await onSend({
        content: message,
        attachments: selectedAttachments,
      });
      emitStopTyping();
      setIsEmojiPickerOpen(false);

      if (!editingMessage) {
        setMessage('');
        setSelectedAttachments((prev) => {
          prev.forEach((attachment) => {
            if (attachment.isLocal) {
              URL.revokeObjectURL(attachment.url);
            }
          });

          return [];
        });
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const composerLabel = editingMessage
    ? 'Editing your message'
    : replyToMessage
      ? `Replying to ${replyToMessage.senderName}`
      : null;

  const composerPreview = editingMessage
    ? editingMessage.content
    : replyToMessage?.deletedAt
      ? 'Message deleted'
      : replyToMessage?.content;

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

      {selectedAttachments.length > 0 && !editingMessage && (
        <div className="mb-3 flex flex-wrap gap-3">
          {selectedAttachments.map((attachment) => (
            <div key={attachment.id} className="relative">
              <AttachmentPreview attachment={attachment} compact />
              <button
                type="button"
                onClick={() => clearAttachment(attachment.id)}
                className="absolute right-2 top-2 rounded-full bg-slate-950/70 p-1 text-white transition hover:bg-slate-950"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-3">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleSelectFiles}
          accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,application/x-zip-compressed"
        />

        <button
          type="button"
          disabled={Boolean(editingMessage)}
          onClick={() => fileInputRef.current?.click()}
          className="mb-1 flex-shrink-0 rounded-full p-2 transition hover:bg-slate-200/70 disabled:cursor-not-allowed disabled:opacity-50"
          title={editingMessage ? 'Attachments are only available for new messages' : 'Attach files'}
        >
          <svg className="theme-muted h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        <div className="relative flex-1">
          <textarea
            ref={textAreaRef}
            rows={1}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={emitStopTyping}
            placeholder={editingMessage ? 'Update your message...' : 'Type a message...'}
            className="theme-input max-h-40 min-h-[3.25rem] w-full resize-none rounded-[1.5rem] px-4 py-3 text-sm leading-6 outline-none transition"
          />

          {isEmojiPickerOpen && (
            <div className="theme-surface theme-border absolute bottom-[calc(100%+0.75rem)] right-0 z-20 rounded-2xl border p-3 shadow-lg">
              <div className="grid grid-cols-6 gap-1.5">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-slate-200/70"
                  >
                    <span className="relative -translate-x-px text-[1.35rem] leading-none">
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
          className="mb-1 flex-shrink-0 rounded-full p-2 transition hover:bg-slate-200/70"
        >
          <svg className="theme-muted h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        <button
          type="submit"
          disabled={(!message.trim() && selectedAttachments.length === 0) || isSending}
          className="mb-1 flex-shrink-0 rounded-full bg-indigo-600 p-2.5 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </form>
  );
}

export default MessageInput;
