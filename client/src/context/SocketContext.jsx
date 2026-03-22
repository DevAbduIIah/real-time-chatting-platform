/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SocketContext = createContext(null);

const SOCKET_URL = 'http://localhost:5000';

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [connectionState, setConnectionState] = useState('disconnected');
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const hasConnectedOnceRef = useRef(false);
  const shouldSyncOnNextConnectRef = useRef(false);

  useEffect(() => {
    if (!user) {
      hasConnectedOnceRef.current = false;
      shouldSyncOnNextConnectRef.current = false;
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
      setConnectionState('connected');

      if (hasConnectedOnceRef.current && shouldSyncOnNextConnectRef.current) {
        shouldSyncOnNextConnectRef.current = false;
        setReconnectVersion((prev) => prev + 1);
        pushToast({
          title: 'Reconnected',
          message: 'Live updates are back and your chats are syncing.',
          tone: 'success',
        });
        return;
      }

      hasConnectedOnceRef.current = true;
      shouldSyncOnNextConnectRef.current = false;
    });

    nextSocket.on('disconnect', () => {
      setSocket(null);
      setIsConnected(false);
      setConnectionState('reconnecting');

      if (hasConnectedOnceRef.current) {
        shouldSyncOnNextConnectRef.current = true;
      }
    });

    nextSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setSocket(null);
      setIsConnected(false);
      setConnectionState('reconnecting');

      if (hasConnectedOnceRef.current) {
        shouldSyncOnNextConnectRef.current = true;
      }
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
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers(new Set());
      setConnectionState('disconnected');
    };
  }, [pushToast, user]);

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
        connectionState,
        reconnectVersion,
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
