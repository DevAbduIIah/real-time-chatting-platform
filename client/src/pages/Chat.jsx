import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../lib/api';
import {
  createPendingMessage,
  mergeMessages,
  removeMessage,
  updateMessageById,
  upsertMessage,
} from '../lib/message-utils';
import Sidebar from '../components/Sidebar';
import ChatHeader from '../components/ChatHeader';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import EmptyState from '../components/EmptyState';

const MESSAGE_PAGE_SIZE = 30;

function sortConversationsByActivity(conversationList) {
  return [...conversationList].sort((a, b) => {
    const aDate = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const bDate = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;

    if (aDate !== bDate) {
      return bDate - aDate;
    }

    return a.otherUser.name.localeCompare(b.otherUser.name);
  });
}

function isMobileViewport() {
  return typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
}

function buildConversationPreview(message, currentUserId) {
  return {
    id: message.id,
    content: message.deletedAt
      ? message.senderId === currentUserId
        ? 'You deleted a message'
        : 'Message deleted'
      : message.content,
    createdAt: message.createdAt,
    isOwn: message.senderId === currentUserId,
  };
}

function doesMessageMatchSearch(message, searchTerm) {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  if (!normalizedSearchTerm) {
    return true;
  }

  if (message.deletedAt) {
    return false;
  }

  return (message.content || '').toLowerCase().includes(normalizedSearchTerm);
}

function upsertVisibleMessage(messageList, nextMessage, searchTerm) {
  if (!doesMessageMatchSearch(nextMessage, searchTerm)) {
    return removeMessage(messageList, nextMessage);
  }

  return upsertMessage(messageList, nextMessage);
}

function Chat() {
  const navigate = useNavigate();
  const { conversationId: routeConversationId } = useParams();
  const { user, logout } = useAuth();
  const { socket, isConnected, sendMessage, sendTyping, sendStopTyping } = useSocket();
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => !isMobileViewport());
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextMessageCursor, setNextMessageCursor] = useState(null);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const pendingTimeoutsRef = useRef(new Map());
  const activeMessageViewRef = useRef('');

  const selectedConversationId = routeConversationId || null;
  const normalizedMessageSearchQuery = messageSearchQuery.trim();

  const selectedConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const editingMessage = useMemo(
    () => messages.find((message) => message.id === editingMessageId) || null,
    [editingMessageId, messages]
  );

  const clearPendingTimeout = useCallback((clientTempId) => {
    if (!clientTempId) return;

    const timeoutId = pendingTimeoutsRef.current.get(clientTempId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      pendingTimeoutsRef.current.delete(clientTempId);
    }
  }, []);

  const updateConversationSummary = useCallback((conversationId, updater) => {
    setConversations((prev) =>
      sortConversationsByActivity(
        prev.map((conversation) => (
          conversation.id === conversationId
            ? updater(conversation)
            : conversation
        ))
      )
    );
  }, []);

  const applyConversationMessage = useCallback((message, unreadMode = 'keep') => {
    updateConversationSummary(message.conversationId, (conversation) => ({
      ...conversation,
      lastMessage: buildConversationPreview(message, user.id),
      lastActivityAt: message.createdAt,
      updatedAt: message.createdAt,
      unreadCount:
        unreadMode === 'increment'
          ? (conversation.unreadCount || 0) + 1
          : unreadMode === 'zero'
            ? 0
            : conversation.unreadCount || 0,
    }));
  }, [updateConversationSummary, user.id]);

  const syncConversationRead = useCallback(async (conversationId) => {
    if (!conversationId) return;

    setConversations((prev) =>
      prev.map((conversation) => (
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation
      ))
    );

    try {
      await api.conversations.markRead(conversationId);
    } catch (err) {
      console.error('Error marking conversation as read:', err);
    }
  }, []);

  const markMessageFailed = useCallback((clientTempId) => {
    setMessages((prev) =>
      prev.map((message) => (
        message.clientTempId === clientTempId && message.status === 'pending'
          ? { ...message, status: 'failed' }
          : message
      ))
    );
  }, []);

  const schedulePendingTimeout = useCallback((clientTempId) => {
    clearPendingTimeout(clientTempId);

    const timeoutId = setTimeout(() => {
      markMessageFailed(clientTempId);
      pendingTimeoutsRef.current.delete(clientTempId);
    }, 10000);

    pendingTimeoutsRef.current.set(clientTempId, timeoutId);
  }, [clearPendingTimeout, markMessageFailed]);

  useEffect(() => {
    const pendingTimeouts = pendingTimeoutsRef.current;

    return () => {
      pendingTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      pendingTimeouts.clear();
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersData, conversationsData] = await Promise.all([
          api.users.getAll(),
          api.conversations.getAll(),
        ]);

        setUsers(usersData.users);
        setConversations(sortConversationsByActivity(conversationsData.conversations));
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setIsSidebarLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedConversationId || isSidebarLoading) {
      return;
    }

    const hasConversation = conversations.some(
      (conversation) => conversation.id === selectedConversationId
    );

    if (!hasConversation) {
      navigate('/chat', { replace: true });
    }
  }, [conversations, isSidebarLoading, navigate, selectedConversationId]);

  useEffect(() => {
    setReplyToMessage(null);
    setEditingMessageId(null);
    setIsOtherUserTyping(false);
    setMessageSearchQuery('');
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      activeMessageViewRef.current = '';
      setMessages([]);
      setHasMoreMessages(false);
      setNextMessageCursor(null);
      setIsMessagesLoading(false);
      setIsLoadingOlderMessages(false);
      return;
    }

    const requestKey = `${selectedConversationId}::${normalizedMessageSearchQuery}`;
    activeMessageViewRef.current = requestKey;
    setIsMessagesLoading(true);
    setMessages([]);
    setHasMoreMessages(false);
    setNextMessageCursor(null);

    const fetchMessages = async () => {
      try {
        const data = await api.conversations.getMessages(selectedConversationId, {
          limit: MESSAGE_PAGE_SIZE,
          search: normalizedMessageSearchQuery || undefined,
        });

        if (activeMessageViewRef.current !== requestKey) {
          return;
        }

        setMessages(data.messages);
        setHasMoreMessages(data.pagination.hasMore);
        setNextMessageCursor(data.pagination.nextCursor);
        setConversations((prev) =>
          prev.map((conversation) => (
            conversation.id === selectedConversationId
              ? { ...conversation, unreadCount: 0 }
              : conversation
          ))
        );
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        if (activeMessageViewRef.current === requestKey) {
          setIsMessagesLoading(false);
        }
      }
    };

    fetchMessages();
  }, [normalizedMessageSearchQuery, selectedConversationId]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = (message) => {
      const isActiveConversation = selectedConversationId === message.conversationId;

      if (isActiveConversation) {
        setMessages((prev) =>
          upsertVisibleMessage(prev, message, normalizedMessageSearchQuery)
        );
      }

      if (isActiveConversation && !message.isOwn) {
        setIsOtherUserTyping(false);
        void syncConversationRead(message.conversationId);
      }

      applyConversationMessage(
        message,
        message.isOwn || isActiveConversation ? 'zero' : 'increment'
      );
    };

    const handleMessageAck = ({ clientTempId, message }) => {
      clearPendingTimeout(clientTempId);
      setMessages((prev) =>
        upsertVisibleMessage(prev, message, normalizedMessageSearchQuery)
      );
      applyConversationMessage(message, 'zero');
    };

    const handleMessageError = ({ clientTempId }) => {
      clearPendingTimeout(clientTempId);
      if (!clientTempId) return;

      setMessages((prev) =>
        prev.map((message) => (
          message.clientTempId === clientTempId
            ? { ...message, status: 'failed' }
            : message
        ))
      );
    };

    const handleMessageUpdated = (message) => {
      setMessages((prev) =>
        upsertVisibleMessage(prev, message, normalizedMessageSearchQuery)
      );
    };

    const handleMessageDeleted = (message) => {
      setMessages((prev) =>
        upsertVisibleMessage(prev, message, normalizedMessageSearchQuery)
      );
    };

    const handleMessagesSeen = ({ messageIds, readAt }) => {
      const messageIdSet = new Set(messageIds);

      setMessages((prev) =>
        prev.map((message) => (
          messageIdSet.has(message.id)
            ? { ...message, readAt, status: 'seen' }
            : message
        ))
      );
    };

    const handleConversationUpdated = ({ conversationId, lastMessage, lastActivityAt }) => {
      updateConversationSummary(conversationId, (conversation) => ({
        ...conversation,
        lastMessage,
        lastActivityAt,
        updatedAt: lastActivityAt,
      }));
    };

    const handleUserTyping = (data) => {
      if (selectedConversationId && data.conversationId === selectedConversationId) {
        setIsOtherUserTyping(true);
      }
    };

    const handleUserStopTyping = (data) => {
      if (selectedConversationId && data.conversationId === selectedConversationId) {
        setIsOtherUserTyping(false);
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_ack', handleMessageAck);
    socket.on('message_error', handleMessageError);
    socket.on('message_updated', handleMessageUpdated);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('messages_seen', handleMessagesSeen);
    socket.on('conversation_updated', handleConversationUpdated);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_ack', handleMessageAck);
      socket.off('message_error', handleMessageError);
      socket.off('message_updated', handleMessageUpdated);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('messages_seen', handleMessagesSeen);
      socket.off('conversation_updated', handleConversationUpdated);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
    };
  }, [
    applyConversationMessage,
    clearPendingTimeout,
    isConnected,
    normalizedMessageSearchQuery,
    selectedConversationId,
    socket,
    syncConversationRead,
    updateConversationSummary,
  ]);

  const handleTyping = useCallback(() => {
    if (selectedConversation && isConnected) {
      sendTyping(selectedConversation.id, selectedConversation.otherUser.id);
    }
  }, [selectedConversation, isConnected, sendTyping]);

  const handleStopTyping = useCallback(() => {
    if (selectedConversation && isConnected) {
      sendStopTyping(selectedConversation.id, selectedConversation.otherUser.id);
    }
  }, [selectedConversation, isConnected, sendStopTyping]);

  const handleSelectUser = async (selectedUser) => {
    try {
      const existingConversation = conversations.find(
        (conversation) => conversation.otherUser.id === selectedUser.id
      );

      if (existingConversation) {
        setConversations((prev) =>
          prev.map((conversation) => (
            conversation.id === existingConversation.id
              ? { ...conversation, unreadCount: 0 }
              : conversation
          ))
        );
        navigate(`/chat/${existingConversation.id}`);
      } else {
        const data = await api.conversations.create(selectedUser.id);
        setConversations((prev) =>
          sortConversationsByActivity([data.conversation, ...prev])
        );
        navigate(`/chat/${data.conversation.id}`);
      }

      if (isMobileViewport()) {
        setIsSidebarOpen(false);
      }
    } catch (err) {
      console.error('Error selecting user:', err);
    }
  };

  const loadOlderMessages = useCallback(async () => {
    if (
      !selectedConversationId
      || !nextMessageCursor
      || !hasMoreMessages
      || isLoadingOlderMessages
      || isMessagesLoading
    ) {
      return;
    }

    const requestKey = `${selectedConversationId}::${normalizedMessageSearchQuery}`;
    setIsLoadingOlderMessages(true);

    try {
      const data = await api.conversations.getMessages(selectedConversationId, {
        cursor: nextMessageCursor,
        limit: MESSAGE_PAGE_SIZE,
        search: normalizedMessageSearchQuery || undefined,
      });

      if (activeMessageViewRef.current !== requestKey) {
        return;
      }

      setMessages((prev) => mergeMessages(prev, data.messages));
      setHasMoreMessages(data.pagination.hasMore);
      setNextMessageCursor(data.pagination.nextCursor);
    } catch (err) {
      console.error('Error loading older messages:', err);
    } finally {
      if (activeMessageViewRef.current === requestKey) {
        setIsLoadingOlderMessages(false);
      }
    }
  }, [
    hasMoreMessages,
    isLoadingOlderMessages,
    isMessagesLoading,
    nextMessageCursor,
    normalizedMessageSearchQuery,
    selectedConversationId,
  ]);

  const sendNewMessage = useCallback(async ({ content, replyMessage, existingFailedMessage = null }) => {
    if (!selectedConversation) {
      return;
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return;
    }

    const pendingMessage = existingFailedMessage
      ? {
          ...existingFailedMessage,
          content: trimmedContent,
          status: 'pending',
        }
      : createPendingMessage({
          content: trimmedContent,
          conversationId: selectedConversation.id,
          user,
          replyToMessage: replyMessage,
        });

    setMessages((prev) => {
      const nextMessages = existingFailedMessage
        ? updateMessageById(prev, existingFailedMessage.id, () => pendingMessage)
        : prev;

      return upsertVisibleMessage(nextMessages, pendingMessage, normalizedMessageSearchQuery);
    });
    applyConversationMessage(pendingMessage, 'zero');
    schedulePendingTimeout(pendingMessage.clientTempId);

    const payload = {
      content: trimmedContent,
      clientTempId: pendingMessage.clientTempId,
      replyToMessageId: replyMessage?.id || null,
    };

    setReplyToMessage(null);

    if (socket && isConnected) {
      sendMessage({
        conversationId: selectedConversation.id,
        ...payload,
      });
      return;
    }

    try {
      const data = await api.conversations.sendMessage(selectedConversation.id, payload);
      clearPendingTimeout(pendingMessage.clientTempId);
      setMessages((prev) =>
        upsertVisibleMessage(prev, data.message, normalizedMessageSearchQuery)
      );
      applyConversationMessage(data.message, 'zero');
    } catch (err) {
      clearPendingTimeout(pendingMessage.clientTempId);
      setMessages((prev) =>
        prev.map((message) => (
          message.clientTempId === pendingMessage.clientTempId
            ? { ...message, status: 'failed' }
            : message
        ))
      );
      console.error('Error sending message:', err);
    }
  }, [
    applyConversationMessage,
    clearPendingTimeout,
    isConnected,
    normalizedMessageSearchQuery,
    schedulePendingTimeout,
    selectedConversation,
    sendMessage,
    socket,
    user,
  ]);

  const handleSubmitMessage = async (content) => {
    if (!selectedConversation) {
      return;
    }

    if (editingMessage) {
      try {
        const data = await api.conversations.editMessage(
          selectedConversation.id,
          editingMessage.id,
          content.trim()
        );
        setMessages((prev) =>
          upsertVisibleMessage(prev, data.message, normalizedMessageSearchQuery)
        );

        if (selectedConversation.lastMessage?.id === data.message.id) {
          applyConversationMessage(data.message, 'keep');
        }

        setEditingMessageId(null);
      } catch (err) {
        console.error('Error editing message:', err);
      }

      return;
    }

    await sendNewMessage({
      content,
      replyMessage: replyToMessage,
    });
  };

  const handleReplyMessage = (message) => {
    setEditingMessageId(null);
    setReplyToMessage(message);
  };

  const handleEditMessage = (message) => {
    setReplyToMessage(null);
    setEditingMessageId(message.id);
  };

  const handleDeleteMessage = async (message) => {
    if (!selectedConversation) {
      return;
    }

    try {
      const data = await api.conversations.deleteMessage(selectedConversation.id, message.id);
      setMessages((prev) =>
        upsertVisibleMessage(prev, data.message, normalizedMessageSearchQuery)
      );

      if (selectedConversation.lastMessage?.id === data.message.id) {
        applyConversationMessage(data.message, 'keep');
      }

      if (editingMessageId === message.id) {
        setEditingMessageId(null);
      }

      if (replyToMessage?.id === message.id) {
        setReplyToMessage(null);
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  const handleRetryMessage = async (message) => {
    await sendNewMessage({
      content: message.content,
      replyMessage: message.replyToMessage,
      existingFailedMessage: message,
    });
  };

  const sidebarItems = useMemo(() => {
    const userConversationMap = new Map();

    conversations.forEach((conversation) => {
      userConversationMap.set(conversation.otherUser.id, {
        ...conversation.otherUser,
        conversationId: conversation.id,
        lastMessage: conversation.lastMessage?.content || null,
        lastMessageIsOwn: conversation.lastMessage?.isOwn || false,
        lastActivityAt: conversation.lastActivityAt || conversation.updatedAt,
        unreadCount: conversation.unreadCount || 0,
        hasConversation: true,
      });
    });

    users.forEach((listedUser) => {
      if (!userConversationMap.has(listedUser.id)) {
        userConversationMap.set(listedUser.id, {
          ...listedUser,
          conversationId: null,
          lastMessage: null,
          lastMessageIsOwn: false,
          lastActivityAt: null,
          unreadCount: 0,
          hasConversation: false,
        });
      }
    });

    const normalizedQuery = searchQuery.trim().toLowerCase();

    return Array.from(userConversationMap.values())
      .filter((item) => {
        if (!normalizedQuery) return true;

        const searchableText = [item.name, item.email, item.lastMessage]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(normalizedQuery);
      })
      .sort((a, b) => {
        const aDate = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const bDate = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;

        if (aDate !== bDate) {
          return bDate - aDate;
        }

        if (a.hasConversation !== b.hasConversation) {
          return a.hasConversation ? -1 : 1;
        }

        return a.name.localeCompare(b.name);
      });
  }, [conversations, searchQuery, users]);

  return (
    <div className="theme-gradient-page flex h-screen overflow-hidden">
      {!isConnected && user && (
        <div className="fixed left-0 right-0 top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm text-white">
          Reconnecting to server...
        </div>
      )}

      <Sidebar
        users={sidebarItems}
        selectedUserId={selectedConversation?.otherUser?.id || null}
        onSelectUser={handleSelectUser}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen((prev) => !prev)}
        currentUser={user}
        onLogout={logout}
        isLoading={isSidebarLoading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className={`min-h-0 min-w-0 flex-1 flex-col ${isSidebarOpen ? 'hidden lg:flex' : 'flex'}`}>
        {selectedConversation ? (
          <>
            <ChatHeader
              user={selectedConversation.otherUser}
              onMenuClick={() => setIsSidebarOpen((prev) => !prev)}
              isTyping={isOtherUserTyping}
            />

            <div className="theme-surface border-b px-4 py-3 sm:px-5 theme-border">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={messageSearchQuery}
                    onChange={(event) => setMessageSearchQuery(event.target.value)}
                    placeholder="Search messages in this conversation..."
                    className="theme-input w-full rounded-2xl py-2.5 pl-10 pr-4 text-sm outline-none transition"
                  />
                  <svg
                    className="theme-muted absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35m1.6-5.15a6.75 6.75 0 11-13.5 0 6.75 6.75 0 0113.5 0z" />
                  </svg>
                </div>

                {messageSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMessageSearchQuery('')}
                    className="theme-surface-muted theme-border theme-text rounded-full border px-4 py-2 text-sm font-medium transition hover:bg-slate-200/70"
                  >
                    Clear search
                  </button>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                {normalizedMessageSearchQuery ? (
                  <p className="theme-muted">
                    Showing matches for <span className="theme-text font-medium">"{normalizedMessageSearchQuery}"</span>
                  </p>
                ) : (
                  <p className="theme-muted">Search the current conversation and load older history as you scroll.</p>
                )}
              </div>
            </div>

            <MessageList
              messages={messages}
              isTyping={isOtherUserTyping}
              isLoading={isMessagesLoading}
              isLoadingOlder={isLoadingOlderMessages}
              hasMoreMessages={hasMoreMessages}
              activeConversationId={selectedConversationId}
              searchQuery={normalizedMessageSearchQuery}
              onLoadOlder={loadOlderMessages}
              onReply={handleReplyMessage}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
              onRetry={handleRetryMessage}
            />
            <MessageInput
              key={`composer-${selectedConversationId}-${editingMessage?.id || 'new'}`}
              conversationId={selectedConversationId}
              onSend={handleSubmitMessage}
              onTyping={handleTyping}
              onStopTyping={handleStopTyping}
              replyToMessage={replyToMessage}
              editingMessage={editingMessage}
              onCancelReply={() => setReplyToMessage(null)}
              onCancelEdit={() => setEditingMessageId(null)}
            />
          </>
        ) : selectedConversationId && isSidebarLoading ? (
          <div className="theme-surface-muted flex-1">
            <EmptyState
              title="Loading conversation"
              description="Restoring your selected conversation."
              icon={(
                <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582M20 20v-5h-.581M5.44 19A9 9 0 1020 11.31" />
                </svg>
              )}
            />
          </div>
        ) : (
          <div className="theme-surface-muted flex-1">
            <EmptyState
              title="Select a conversation"
              description="Choose someone from the sidebar to start chatting, catch up, or continue where you left off."
              icon={(
                <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;
