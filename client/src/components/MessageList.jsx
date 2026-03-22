import { useEffect, useMemo, useRef } from 'react';
import EmptyState from './EmptyState';
import { MessageListSkeleton } from './LoadingSkeletons';
import UserAvatar from './UserAvatar';
import {
  formatMessageDateLabel,
  formatMessageTime,
} from '../lib/formatters';

function getReceiptLabel(message) {
  if (!message.isOwn) {
    return '';
  }

  switch (message.status) {
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
    case 'seen':
      return 'Seen';
    case 'delivered':
      return 'Delivered';
    default:
      return 'Sent';
  }
}

function buildTimelineItems(messages) {
  const items = [];
  let lastDateLabel = null;

  messages.forEach((message) => {
    const dateLabel = formatMessageDateLabel(message.createdAt);

    if (dateLabel !== lastDateLabel) {
      items.push({
        id: `separator-${dateLabel}-${message.id}`,
        type: 'separator',
        label: dateLabel,
      });
      lastDateLabel = dateLabel;
    }

    items.push({
      id: message.id,
      type: 'message',
      message,
    });
  });

  return items;
}

function MessageList({
  messages,
  isTyping,
  isLoading,
  activeConversationId,
  onReply,
  onEdit,
  onDelete,
  onRetry,
}) {
  const messagesEndRef = useRef(null);
  const previousConversationIdRef = useRef(activeConversationId);
  const previousMessageCountRef = useRef(messages.length);

  const timelineItems = useMemo(() => buildTimelineItems(messages), [messages]);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (isLoading) return;

    const conversationChanged = previousConversationIdRef.current !== activeConversationId;
    const appendedMessage = messages.length > previousMessageCountRef.current;

    if (conversationChanged) {
      scrollToBottom('auto');
    } else if (appendedMessage || isTyping) {
      scrollToBottom('smooth');
    }

    previousConversationIdRef.current = activeConversationId;
    previousMessageCountRef.current = messages.length;
  }, [activeConversationId, isLoading, isTyping, messages]);

  if (isLoading) {
    return <MessageListSkeleton />;
  }

  if (messages.length === 0) {
    return (
      <div className="theme-surface-muted flex-1">
        <EmptyState
          title="No messages yet"
          description="Send the first message to kick off this conversation."
          icon={(
            <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M7 8h10M7 12h7m-7 4h5m-3.5 4H6a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2h-3.5L12 21l-3.5-3z" />
            </svg>
          )}
        />
      </div>
    );
  }

  return (
    <div className="theme-surface-muted flex-1 overflow-y-auto px-4 py-5 sm:px-6">
      {timelineItems.map((item) => {
        if (item.type === 'separator') {
          return (
            <div key={item.id} className="mb-4 mt-2 flex justify-center">
              <span className="theme-surface theme-border theme-muted rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] shadow-sm">
                {item.label}
              </span>
            </div>
          );
        }

        const { message } = item;
        const canReply = message.status !== 'pending';
        const canEdit = message.isOwn && !message.deletedAt && message.status !== 'pending' && message.status !== 'failed';
        const canDelete = message.isOwn && !message.deletedAt && message.status !== 'pending';
        const canRetry = message.isOwn && message.status === 'failed';
        const receiptLabel = getReceiptLabel(message);

        return (
          <div
            key={message.id}
            className={`group mb-4 flex ${message.isOwn ? 'justify-end' : 'justify-start'} animate-fadeIn`}
          >
            {!message.isOwn && (
              <div className="mr-3 mt-auto">
                <UserAvatar
                  name={message.senderName}
                  avatarUrl={message.senderAvatarUrl}
                  size="sm"
                />
              </div>
            )}

            <div className="max-w-[min(88%,42rem)]">
              <div
                className={`
                  rounded-3xl px-4 py-3 shadow-sm ring-1
                  ${message.isOwn
                    ? 'rounded-br-lg bg-indigo-600 text-white ring-indigo-500'
                    : 'theme-surface rounded-bl-lg theme-text ring-[color:var(--border-subtle)]'
                  }
                  ${message.status === 'failed' ? 'ring-rose-300' : ''}
                `}
              >
                {message.replyToMessage && (
                  <div
                    className={`mb-3 rounded-2xl px-3 py-2 text-sm ${
                      message.isOwn
                        ? 'bg-indigo-500/70 text-indigo-50'
                        : 'theme-surface-muted theme-muted'
                    }`}
                  >
                    <p className="font-semibold">
                      {message.replyToMessage.senderName}
                    </p>
                    <p className="mt-1 truncate">
                      {message.replyToMessage.deletedAt ? 'Message deleted' : message.replyToMessage.content}
                    </p>
                  </div>
                )}

                {message.deletedAt ? (
                  <p className={`text-sm italic ${message.isOwn ? 'text-indigo-100/90' : 'text-slate-400'}`}>
                    Message deleted
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-6">
                    {message.content}
                  </p>
                )}

                <div
                  className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium ${
                    message.isOwn ? 'text-indigo-100/90' : 'text-slate-400'
                  }`}
                >
                  <span>{formatMessageTime(message.createdAt)}</span>
                  {message.editedAt && <span>Edited</span>}
                  {receiptLabel && <span>{receiptLabel}</span>}
                </div>
              </div>

              <div className={`mt-2 flex flex-wrap gap-2 text-xs ${message.isOwn ? 'justify-end' : 'justify-start'}`}>
                {canReply && (
                  <button
                    type="button"
                    onClick={() => onReply(message)}
                    className="theme-surface theme-border theme-muted rounded-full border px-2.5 py-1 font-medium transition hover:bg-slate-200/70"
                  >
                    Reply
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(message)}
                    className="theme-surface theme-border theme-muted rounded-full border px-2.5 py-1 font-medium transition hover:bg-slate-200/70"
                  >
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(message)}
                    className="theme-surface theme-border theme-muted rounded-full border px-2.5 py-1 font-medium transition hover:bg-slate-200/70"
                  >
                    Delete
                  </button>
                )}
                {canRetry && (
                  <button
                    type="button"
                    onClick={() => onRetry(message)}
                    className="rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-100"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {isTyping && (
        <div className="flex justify-start">
          <div className="theme-surface theme-text rounded-3xl rounded-bl-lg px-4 py-3 shadow-sm ring-1 ring-[color:var(--border-subtle)]">
            <div className="flex gap-1">
              <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageList;
