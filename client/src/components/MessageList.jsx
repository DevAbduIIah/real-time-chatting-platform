import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import EmptyState from './EmptyState';
import { MessageListSkeleton } from './LoadingSkeletons';
import UserAvatar from './UserAvatar';
import AttachmentPreview from './AttachmentPreview';
import {
  formatMessageDateLabel,
  formatMessageTime,
} from '../lib/formatters';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🔥', '🎉', '😮'];
const URL_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedText(content, searchQuery) {
  if (!searchQuery) {
    return content;
  }

  const pattern = new RegExp(`(${escapeRegExp(searchQuery)})`, 'gi');
  const normalizedQuery = searchQuery.toLowerCase();

  return content.split(pattern).map((part, index) => (
    part.toLowerCase() === normalizedQuery ? (
      <mark
        key={`${part}-${index}`}
        className="rounded bg-amber-200/80 px-0.5 text-inherit"
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  ));
}

function normalizeHref(value) {
  try {
    const candidate = value.startsWith('www.') ? `https://${value}` : value;
    const url = new URL(candidate);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function renderMessageContent(content, searchQuery) {
  URL_PATTERN.lastIndex = 0;
  const parts = content.split(URL_PATTERN);

  return parts.map((part, index) => {
    if (!part) {
      return null;
    }

    const href = normalizeHref(part);
    if (!href) {
      return <span key={`${part}-${index}`}>{renderHighlightedText(part, searchQuery)}</span>;
    }

    return (
      <a
        key={`${part}-${index}`}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="font-medium underline decoration-current/40 underline-offset-4 transition hover:decoration-current"
      >
        {renderHighlightedText(part, searchQuery)}
      </a>
    );
  });
}

function buildCopyText(message) {
  if (message.content?.trim()) {
    return message.content.trim();
  }

  if (message.attachments?.length) {
    return message.attachments
      .map((attachment) => attachment.url || attachment.originalName)
      .join('\n');
  }

  return message.previewText || '';
}

function MessageList({
  messages,
  isTyping,
  isLoading,
  isLoadingOlder,
  hasMoreMessages,
  activeConversationId,
  searchQuery,
  onLoadOlder,
  onReply,
  onEdit,
  onDelete,
  onRetry,
  onToggleReaction,
}) {
  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const previousConversationIdRef = useRef(null);
  const previousSearchQueryRef = useRef(null);
  const previousLastMessageKeyRef = useRef(messages[messages.length - 1]?.id || null);
  const anchorRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const autoLoadGuardRef = useRef(false);
  const copyTimeoutRef = useRef(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState(null);

  const timelineItems = useMemo(() => buildTimelineItems(messages), [messages]);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const container = scrollContainerRef.current;

    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const requestOlderMessages = useCallback(() => {
    if (!onLoadOlder || !hasMoreMessages || isLoadingOlder) {
      return;
    }

    const container = scrollContainerRef.current;
    if (container) {
      anchorRef.current = {
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
      };
    }

    autoLoadGuardRef.current = true;
    onLoadOlder();
  }, [hasMoreMessages, isLoadingOlder, onLoadOlder]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nextIsNearBottom = distanceFromBottom < 120;

    isNearBottomRef.current = nextIsNearBottom;
    setShowJumpToLatest(!nextIsNearBottom && messages.length > 0);

    if (container.scrollTop < 80 && hasMoreMessages && !isLoadingOlder && !autoLoadGuardRef.current) {
      requestOlderMessages();
    }
  }, [hasMoreMessages, isLoadingOlder, messages.length, requestOlderMessages]);

  useEffect(() => () => {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isLoadingOlder) {
      autoLoadGuardRef.current = false;
    }
  }, [isLoadingOlder]);

  useLayoutEffect(() => {
    if (!anchorRef.current || isLoadingOlder) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      anchorRef.current = null;
      return;
    }

    const heightDelta = container.scrollHeight - anchorRef.current.scrollHeight;
    container.scrollTop = anchorRef.current.scrollTop + heightDelta;
    anchorRef.current = null;
  }, [isLoadingOlder, messages]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || isLoading) {
      return;
    }

    const latestMessage = messages[messages.length - 1] || null;
    const currentLastMessageKey = messages[messages.length - 1]?.id || null;
    const conversationChanged = previousConversationIdRef.current !== activeConversationId;
    const searchChanged = previousSearchQueryRef.current !== searchQuery;
    const lastMessageChanged = previousLastMessageKeyRef.current !== currentLastMessageKey;

    if (conversationChanged || searchChanged) {
      scrollToBottom('auto');
    } else if (
      (lastMessageChanged && (isNearBottomRef.current || latestMessage?.isOwn))
      || (isTyping && isNearBottomRef.current)
    ) {
      scrollToBottom('smooth');
    }

    previousConversationIdRef.current = activeConversationId;
    previousSearchQueryRef.current = searchQuery;
    previousLastMessageKeyRef.current = currentLastMessageKey;

    const frameId = window.requestAnimationFrame(() => {
      handleScroll();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeConversationId, handleScroll, isLoading, isTyping, messages, scrollToBottom, searchQuery]);

  const handleCopyMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(buildCopyText(message));
      setCopiedMessageId(message.id);

      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }

      copyTimeoutRef.current = setTimeout(() => {
        setCopiedMessageId(null);
      }, 1500);
    } catch (error) {
      console.error('Copy message error:', error);
    }
  };

  const visibleReactionMessageId = messages.some((message) => message.id === activeReactionMessageId)
    ? activeReactionMessageId
    : null;

  if (isLoading) {
    return <MessageListSkeleton />;
  }

  if (messages.length === 0) {
    return (
      <div className="theme-surface-muted flex-1">
        <EmptyState
          title={searchQuery ? 'No matching messages' : 'No messages yet'}
          description={
            searchQuery
              ? 'Try a different keyword or clear the search to return to the full conversation.'
              : 'Send the first message to kick off this conversation.'
          }
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
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="theme-surface-muted flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6"
      >
        <div className="mb-4 flex flex-col items-center gap-2">
          {hasMoreMessages ? (
            <button
              type="button"
              onClick={requestOlderMessages}
              disabled={isLoadingOlder}
              className="theme-surface theme-border theme-text rounded-full border px-4 py-2 text-sm font-medium transition hover:bg-slate-200/70 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingOlder
                ? 'Loading older messages...'
                : searchQuery
                  ? 'Load older matches'
                  : 'Load older messages'}
            </button>
          ) : (
            <p className="theme-muted text-xs font-medium uppercase tracking-[0.14em]">
              {searchQuery ? 'No older matches' : 'Start of conversation'}
            </p>
          )}
        </div>

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
          const canCopy = !message.deletedAt && Boolean(message.content?.trim() || message.attachments?.length);
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

              <div className="min-w-0 max-w-[min(88%,42rem)]">
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

                  {!message.deletedAt && Boolean(message.attachments?.length) && (
                    <div className={`${message.content?.trim() ? 'mb-3' : ''} max-w-full grid gap-3 ${
                      message.attachments.length > 1 ? 'sm:grid-cols-2' : ''
                    }`}>
                      {message.attachments.map((attachment) => (
                        <AttachmentPreview
                          key={attachment.id}
                          attachment={attachment}
                          variant="message"
                        />
                      ))}
                    </div>
                  )}

                  {message.deletedAt ? (
                    <p className={`text-sm italic ${message.isOwn ? 'text-indigo-100/90' : 'text-slate-400'}`}>
                      Message deleted
                    </p>
                  ) : message.content?.trim() ? (
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-6">
                      {renderMessageContent(message.content, searchQuery)}
                    </p>
                  ) : null}

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

                {(message.reactions?.length > 0 || message.status !== 'pending') && (
                  <div className={`mt-2 flex flex-wrap items-center gap-2 ${message.isOwn ? 'justify-end' : 'justify-start'}`}>
                    {message.reactions?.map((reaction) => (
                      <button
                        key={reaction.emoji}
                        type="button"
                        onClick={() => {
                          setActiveReactionMessageId(null);
                          onToggleReaction(message, reaction.emoji);
                        }}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                          reaction.reactedByMe
                            ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-100'
                            : 'theme-surface theme-border theme-text'
                        }`}
                      >
                        <span>{reaction.emoji}</span>
                        <span className="ml-1">{reaction.count}</span>
                      </button>
                    ))}

                    {message.status !== 'pending' && (
                      <div className="relative flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setActiveReactionMessageId((currentId) => (
                            currentId === message.id ? null : message.id
                          ))}
                          className="theme-surface theme-border theme-muted rounded-full border px-2.5 py-1 text-xs font-medium transition hover:bg-slate-200/70"
                        >
                          React
                        </button>

                        {visibleReactionMessageId === message.id && (
                          <div
                            className={`theme-card theme-border absolute bottom-full z-20 mb-3 grid w-fit max-w-[calc(100vw-2rem)] grid-cols-[repeat(6,2.5rem)] justify-center gap-1 rounded-2xl border p-2 shadow-xl ${
                              message.isOwn ? 'right-0' : 'left-0'
                            }`}
                          >
                            {QUICK_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  setActiveReactionMessageId(null);
                                  onToggleReaction(message, emoji);
                                }}
                                className="flex h-10 w-10 items-center justify-center place-self-center rounded-full leading-none transition hover:bg-slate-200/70"
                              >
                                <span className="block text-[1.35rem] leading-none">{emoji}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
                  {canCopy && (
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(message)}
                      className="theme-surface theme-border theme-muted rounded-full border px-2.5 py-1 font-medium transition hover:bg-slate-200/70"
                    >
                      {copiedMessageId === message.id ? 'Copied' : 'Copy'}
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

      {showJumpToLatest && (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-5 right-5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700"
        >
          Jump to latest
        </button>
      )}
    </div>
  );
}

export default MessageList;
