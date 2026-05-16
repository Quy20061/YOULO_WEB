import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { token } = useAuth();
  const socketRef = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [incomingCall, setIncomingCall] = useState(null);
  const listenersRef = useRef({});

  useEffect(() => {
    if (!token) return;
    const socket = io('http://localhost:5000', { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('auth', token);
    });

    socket.on('user_status', ({ userId, online }) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: online }));
    });

    socket.on('incoming_call', (data) => {
      setIncomingCall(data);
    });

    socket.on('new_message', (msg) => {
      const handlers = listenersRef.current['new_message'] || [];
      handlers.forEach(h => h(msg));
    });

    socket.on('message_sent', (msg) => {
      const handlers = listenersRef.current['message_sent'] || [];
      handlers.forEach(h => h(msg));
    });

    socket.on('user_typing', (data) => {
      const handlers = listenersRef.current['user_typing'] || [];
      handlers.forEach(h => h(data));
    });

    socket.on('new_post', (post) => {
      const handlers = listenersRef.current['new_post'] || [];
      handlers.forEach(h => h(post));
    });

    socket.on('post_liked', (data) => {
      const handlers = listenersRef.current['post_liked'] || [];
      handlers.forEach(h => h(data));
    });

    socket.on('new_comment', (data) => {
      const handlers = listenersRef.current['new_comment'] || [];
      handlers.forEach(h => h(data));
    });

    socket.on('call_answered', (data) => {
      const handlers = listenersRef.current['call_answered'] || [];
      handlers.forEach(h => h(data));
    });

    socket.on('call_rejected', () => {
      const handlers = listenersRef.current['call_rejected'] || [];
      handlers.forEach(h => h());
    });

    socket.on('call_ended', () => {
      const handlers = listenersRef.current['call_ended'] || [];
      handlers.forEach(h => h());
    });

    socket.on('ice_candidate', (data) => {
      const handlers = listenersRef.current['ice_candidate'] || [];
      handlers.forEach(h => h(data));
    });

    socket.on('call_failed', (data) => {
      const handlers = listenersRef.current['call_failed'] || [];
      handlers.forEach(h => h(data));
    });

    socket.on('friend_request', (data) => {
      const handlers = listenersRef.current['friend_request'] || [];
      handlers.forEach(h => h(data));
    });


    socket.on('new_group_message', (msg) => {
      const handlers = listenersRef.current['new_group_message'] || [];
      handlers.forEach(h => h(msg));
    });

    socket.on('group_updated', (data) => {
      const handlers = listenersRef.current['group_updated'] || [];
      handlers.forEach(h => h(data));
    });

    return () => socket.disconnect();
  }, [token]);

  const on = (event, handler) => {
    if (!listenersRef.current[event]) listenersRef.current[event] = [];
    listenersRef.current[event].push(handler);
    return () => {
      listenersRef.current[event] = listenersRef.current[event].filter(h => h !== handler);
    };
  };

  const emit = (event, data) => {
    socketRef.current?.emit(event, data);
  };

  const clearIncomingCall = () => setIncomingCall(null);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, onlineUsers, incomingCall, clearIncomingCall, on, emit }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
