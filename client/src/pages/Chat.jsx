import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../lib/api';
import { createPendingMessage, updateMessageById, upsertMessage } from '../lib/message-utils';
import Sidebar from '../components/Sidebar';
import ChatHeader from '../components/ChatHeader';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import EmptyState from '../components/EmptyState';

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

function Chat() {
  const { user, logout } = useAuth();
  const { socket, isConnected, sendMessage, sendTyping, sendStopTyping } = useSocket();
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => !isMobileViewport());
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const pendingTimeoutsRef = useRef(new Map());

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
        prev.map((conversation) =>
          conversation.id === conversationId
            ? updater(conversation)
            : conversation
        )
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
      prev.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation
      )
    );

    try {
      await api.conversations.markRead(conversationId);
    } catch (err) {
      console.error('Error marking conversation as read:', err);
    }
  }, []);

  const markMessageFailed = useCallback((clientTempId) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.clientTempId === clientTempId && message.status === 'pending'
          ? { ...message, status: 'failed' }
          : message
      )
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
    setReplyToMessage(null);
    setEditingMessageId(null);
    setIsOtherUserTyping(false);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      setIsMessagesLoading(false);
      return;
    }

    const fetchMessages = async () => {
      setIsMessagesLoading(true);

      try {
        const data = await api.conversations.getMessages(selectedConversationId);
        setMessages(data.messages);
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === selectedConversationId
              ? { ...conversation, unreadCount: 0 }
              : conversation
          )
        );
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setIsMessagesLoading(false);
      }
    };

    fetchMessages();
  }, [selectedConversationId]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = (message) => {
      const isActiveConversation = selectedConversationId === message.conversationId;

      if (isActiveConversation) {
        setMessages((prev) => upsertMessage(prev, message));
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
      setMessages((prev) => upsertMessage(prev, message));
      applyConversationMessage(message, 'zero');
    };

    const handleMessageError = ({ clientTempId }) => {
      clearPendingTimeout(clientTempId);
      if (!clientTempId) return;

      setMessages((prev) =>
        prev.map((message) =>
          message.clientTempId === clientTempId
            ? { ...message, status: 'failed' }
            : message
        )
      );
    };

    const handleMessageUpdated = (message) => {
      setMessages((prev) => upsertMessage(prev, message));
    };

    const handleMessageDeleted = (message) => {
      setMessages((prev) => upsertMessage(prev, message));
    };

    const handleMessagesSeen = ({ messageIds, readAt }) => {
      const messageIdSet = new Set(messageIds);

      setMessages((prev) =>
        prev.map((message) =>
          messageIdSet.has(message.id)
            ? { ...message, readAt, status: 'seen' }
            : message
        )
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
          prev.map((conversation) =>
            conversation.id === existingConversation.id
              ? { ...conversation, unreadCount: 0 }
              : conversation
          )
        );
        setSelectedConversationId(existingConversation.id);
      } else {
        const data = await api.conversations.create(selectedUser.id);
        setConversations((prev) =>
          sortConversationsByActivity([data.conversation, ...prev])
        );
        setSelectedConversationId(data.conversation.id);
      }

      if (isMobileViewport()) {
        setIsSidebarOpen(false);
      }
    } catch (err) {
      console.error('Error selecting user:', err);
    }
  };

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

    setMessages((prev) =>
      existingFailedMessage
        ? updateMessageById(prev, existingFailedMessage.id, () => pendingMessage)
        : upsertMessage(prev, pendingMessage)
    );
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
      setMessages((prev) => upsertMessage(prev, data.message));
      applyConversationMessage(data.message, 'zero');
    } catch (err) {
      clearPendingTimeout(pendingMessage.clientTempId);
      setMessages((prev) =>
        prev.map((message) =>
          message.clientTempId === pendingMessage.clientTempId
            ? { ...message, status: 'failed' }
            : message
        )
      );
      console.error('Error sending message:', err);
    }
  }, [
    applyConversationMessage,
    clearPendingTimeout,
    isConnected,
    schedulePendingTimeout,
    selectedConversation,
    sendMessage,
    socket,
    user,
  ]);

  const handleSubmitMessage = async (content) => {
    if (editingMessage) {
      try {
        const data = await api.conversations.editMessage(
          selectedConversation.id,
          editingMessage.id,
          content.trim()
        );
        setMessages((prev) => upsertMessage(prev, data.message));

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
      setMessages((prev) => upsertMessage(prev, data.message));

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
    <div className="theme-gradient-page flex h-screen">
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

      <div className={`min-w-0 flex-1 flex-col ${isSidebarOpen ? 'hidden lg:flex' : 'flex'}`}>
        {selectedConversation ? (
          <>
            <ChatHeader
              user={selectedConversation.otherUser}
              onMenuClick={() => setIsSidebarOpen((prev) => !prev)}
              isTyping={isOtherUserTyping}
            />
            <MessageList
              messages={messages}
              isTyping={isOtherUserTyping}
              isLoading={isMessagesLoading}
              activeConversationId={selectedConversationId}
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
