import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../lib/api';
import Sidebar from '../components/Sidebar';
import ChatHeader from '../components/ChatHeader';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';

function Chat() {
  const { user, logout } = useAuth();
  const { socket, isConnected, sendMessage, sendTyping, sendStopTyping } = useSocket();
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);

  // Fetch users and conversations on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersData, conversationsData] = await Promise.all([
          api.users.getAll(),
          api.conversations.getAll(),
        ]);
        setUsers(usersData.users);
        setConversations(conversationsData.conversations);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const data = await api.conversations.getMessages(selectedConversation.id);
        setMessages(data.messages);
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    };

    fetchMessages();
  }, [selectedConversation?.id]);

  // Listen for real-time messages via socket
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = (message) => {
      // Add message to the list if it belongs to current conversation
      if (selectedConversation && message.conversationId === selectedConversation.id) {
        setMessages((prev) => [...prev, message]);
      }

      // Update conversation's last message
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === message.conversationId
            ? {
                ...conv,
                lastMessage: {
                  content: message.content,
                  createdAt: message.createdAt,
                  isOwn: message.senderId === user.id,
                },
                updatedAt: message.createdAt,
              }
            : conv
        )
      );
    };

    socket.on('new_message', handleNewMessage);

    // Handle typing indicators
    const handleUserTyping = (data) => {
      if (selectedConversation && data.conversationId === selectedConversation.id) {
        setIsOtherUserTyping(true);
      }
    };

    const handleUserStopTyping = (data) => {
      if (selectedConversation && data.conversationId === selectedConversation.id) {
        setIsOtherUserTyping(false);
      }
    };

    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
    };
  }, [socket, isConnected, selectedConversation, user]);

  // Reset typing indicator when conversation changes
  useEffect(() => {
    setIsOtherUserTyping(false);
  }, [selectedConversation?.id]);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (selectedConversation && socket && isConnected) {
      sendTyping(selectedConversation.id, selectedConversation.otherUser.id);
    }
  }, [selectedConversation, socket, isConnected, sendTyping]);

  const handleStopTyping = useCallback(() => {
    if (selectedConversation && socket && isConnected) {
      sendStopTyping(selectedConversation.id, selectedConversation.otherUser.id);
    }
  }, [selectedConversation, socket, isConnected, sendStopTyping]);

  // Handle selecting a user (create or open conversation)
  const handleSelectUser = async (selectedUser) => {
    try {
      // Check if conversation already exists
      const existingConv = conversations.find(
        (conv) => conv.otherUser.id === selectedUser.id
      );

      if (existingConv) {
        setSelectedConversation(existingConv);
      } else {
        // Create new conversation
        const data = await api.conversations.create(selectedUser.id);
        const newConv = {
          id: data.conversation.id,
          otherUser: data.conversation.otherUser,
          lastMessage: null,
        };
        setConversations((prev) => [newConv, ...prev]);
        setSelectedConversation(newConv);
      }
    } catch (err) {
      console.error('Error selecting user:', err);
    }
  };

  // Handle sending a message
  const handleSendMessage = async (content) => {
    if (!selectedConversation) return;

    // Use socket for real-time messaging
    if (socket && isConnected) {
      sendMessage(selectedConversation.id, content);
    } else {
      // Fallback to API if socket not connected
      try {
        const data = await api.conversations.sendMessage(selectedConversation.id, content);
        setMessages((prev) => [...prev, data.message]);

        // Update conversation's last message
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === selectedConversation.id
              ? {
                  ...conv,
                  lastMessage: {
                    content: data.message.content,
                    createdAt: data.message.createdAt,
                    isOwn: true,
                  },
                }
              : conv
          )
        );
      } catch (err) {
        console.error('Error sending message:', err);
      }
    }
  };

  // Combine users and conversations for sidebar
  const getSidebarItems = () => {
    // Create a map of users with conversations
    const userConvMap = new Map();

    conversations.forEach((conv) => {
      userConvMap.set(conv.otherUser.id, {
        ...conv.otherUser,
        conversationId: conv.id,
        lastMessage: conv.lastMessage?.content || null,
        lastMessageTime: conv.lastMessage?.createdAt || conv.updatedAt,
        hasConversation: true,
      });
    });

    // Add users without conversations
    users.forEach((u) => {
      if (!userConvMap.has(u.id)) {
        userConvMap.set(u.id, {
          ...u,
          conversationId: null,
          lastMessage: null,
          lastMessageTime: null,
          hasConversation: false,
        });
      }
    });

    return Array.from(userConvMap.values()).sort((a, b) => {
      // Sort by last message time (conversations first, then users)
      if (a.lastMessageTime && b.lastMessageTime) {
        return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
      }
      if (a.lastMessageTime) return -1;
      if (b.lastMessageTime) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Connection status indicator */}
      {!isConnected && user && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-2 text-center text-sm">
          Reconnecting to server...
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        users={getSidebarItems()}
        selectedUser={selectedConversation?.otherUser || null}
        onSelectUser={handleSelectUser}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentUser={user}
        onLogout={logout}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConversation ? (
          <>
            <ChatHeader
              user={selectedConversation.otherUser}
              onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
              isTyping={isOtherUserTyping}
            />
            <MessageList messages={messages} isTyping={isOtherUserTyping} />
            <MessageInput
              onSend={handleSendMessage}
              onTyping={handleTyping}
              onStopTyping={handleStopTyping}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">Select a conversation</h3>
              <p className="text-gray-500">Choose a user from the sidebar to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;
