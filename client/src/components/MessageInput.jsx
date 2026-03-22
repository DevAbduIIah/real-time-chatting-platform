import { useEffect, useRef, useState } from 'react';

const QUICK_EMOJIS = ['😀', '😂', '😍', '🥳', '👍', '🙏', '🔥', '🎉', '❤️', '🤝', '😎', '🤔'];

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
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const textAreaRef = useRef(null);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, [conversationId, editingMessage?.id]);

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
    setIsEmojiPickerOpen(false);

    requestAnimationFrame(() => {
      target.focus();
      const cursorPosition = start + emoji.length;
      target.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!message.trim()) {
      return;
    }

    onSend(message);
    emitStopTyping();
    setIsEmojiPickerOpen(false);

    if (!editingMessage) {
      setMessage('');
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const composerLabel = editingMessage
    ? `Editing your message`
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

      <div className="flex items-end gap-3">
        <button
          type="button"
          className="mb-1 flex-shrink-0 rounded-full p-2 transition hover:bg-slate-200/70"
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
            <div className="theme-surface theme-border absolute bottom-[calc(100%+0.75rem)] right-0 z-20 w-56 rounded-2xl border p-3 shadow-lg">
              <div className="grid grid-cols-6 gap-2">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="rounded-xl p-2 text-xl transition hover:bg-slate-200/70"
                  >
                    {emoji}
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
          disabled={!message.trim()}
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
