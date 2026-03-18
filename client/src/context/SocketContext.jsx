import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = 'http://localhost:5000';

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setIsConnected(false);
    });

    newSocket.on('online_users', (data) => {
      setOnlineUsers(new Set(data.userIds));
    });

    newSocket.on('user_online', (data) => {
      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        updated.add(data.userId);
        return updated;
      });
    });

    newSocket.on('user_offline', (data) => {
      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        updated.delete(data.userId);
        return updated;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const isUserOnline = (userId) => {
    return onlineUsers.has(userId);
  };

  const sendMessage = (conversationId, content) => {
    if (socket && isConnected) {
      socket.emit('send_message', { conversationId, content });
    }
  };

  const sendTyping = (conversationId, recipientId) => {
    if (socket && isConnected) {
      socket.emit('typing', { conversationId, recipientId });
    }
  };

  const sendStopTyping = (conversationId, recipientId) => {
    if (socket && isConnected) {
      socket.emit('stop_typing', { conversationId, recipientId });
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUsers,
        isUserOnline,
        sendMessage,
        sendTyping,
        sendStopTyping,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
