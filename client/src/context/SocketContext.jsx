/* eslint-disable react-refresh/only-export-components */
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
      return undefined;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      return undefined;
    }

    const nextSocket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    nextSocket.on('connect', () => {
      setSocket(nextSocket);
      setIsConnected(true);
    });

    nextSocket.on('disconnect', () => {
      setSocket(null);
      setIsConnected(false);
    });

    nextSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setSocket(null);
      setIsConnected(false);
    });

    nextSocket.on('online_users', (data) => {
      setOnlineUsers(new Set(data.userIds));
    });

    nextSocket.on('user_online', (data) => {
      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        updated.add(data.userId);
        return updated;
      });
    });

    nextSocket.on('user_offline', (data) => {
      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        updated.delete(data.userId);
        return updated;
      });
    });

    return () => {
      nextSocket.disconnect();
      setIsConnected(false);
      setOnlineUsers(new Set());
    };
  }, [user]);

  const isUserOnline = (userId) => {
    return onlineUsers.has(userId);
  };

  const sendMessage = (payload) => {
    if (socket && isConnected) {
      socket.emit('send_message', payload);
    }
  };

  const sendTyping = (conversationId) => {
    if (socket && isConnected) {
      socket.emit('typing', { conversationId });
    }
  };

  const sendStopTyping = (conversationId) => {
    if (socket && isConnected) {
      socket.emit('stop_typing', { conversationId });
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
