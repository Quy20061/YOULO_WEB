import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import VideoCall from './VideoCall';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const API = process.env.REACT_APP_API_URL || '';

// ── Emoji picker data (10 nhóm phổ biến) ─────────────────────────────────────
const EMOJI_GROUPS = [
  { label: '😀', emojis: ['😀','😂','🥰','😍','🤩','😎','🥳','😭','😤','🤔','😴','🤗','😏','🙃','😬','🥺','😱','🤯','😇','🤑','😈','💀','👻','🤖','😺','😸','😹','😻','😼','😾'] },
  { label: '👍', emojis: ['👍','👎','👏','🙌','🤝','🤜','🤛','✊','👊','🖐','✌️','🤟','🤘','👌','🤌','🤏','💪','🦾','🖖','🤙','💅','🫶','❤️','🧡','💛','💚','💙','💜','🖤','🤍'] },
  { label: '🔥', emojis: ['🔥','💥','✨','⭐','🌟','💫','🎉','🎊','🎈','🎁','🏆','🥇','🎯','🎮','🕹️','🎲','🧩','🎭','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎸','🎺','🪗','🎻','🪕'] },
  { label: '🐶', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝'] },
  { label: '🍎', emojis: ['🍎','🍊','🍋','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🫒','🥑','🍆','🥦','🥕','🌽','🌶️','🥒','🧄','🧅','🥔','🍠','🫘','🥜','🌰','🍞'] },
  { label: '🚗', emojis: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛹','🚁','✈️','🚀','🛸','⛵','🚤','🛥️','🚢','🚂','🚇','🚉'] },
  { label: '⚽', emojis: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥊','🥋','🎿','⛷️','🏂','🏋️','🤼','🤸','🤺','🏇','⛹️','🤾','🏌️','🏄','🚣','🧗','🚵','🚴','🏊','🤽'] },
  { label: '🌍', emojis: ['🌍','🌎','🌏','🌐','🗺️','🧭','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏟️','🏛️','🏗️','🧱','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬'] },
  { label: '💎', emojis: ['💎','💍','👑','🏅','🎖️','🥇','🥈','🥉','🏆','🎀','🎗️','🎫','🎟️','🎪','🤹','🎠','🎡','🎢','🛍️','🎑','🎆','🎇','🧨','✨','🎉','🎊','🎋','🎍','🎎','🎏'] },
  { label: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☯️','🙏','💏','💑','👨‍👩‍👧','👨‍👩‍👦','👪'] },
];

// ── Sticker data (emoji lớn dùng làm sticker) ────────────────────────────────
const STICKERS = [
  ['🥰','😭','😤','🤯','🥳','😴','🤗','😱','🙈','💀'],
  ['🔥','💯','✨','👑','💎','🎉','🤌','💅','🫶','⚡'],
  ['🐶','🐱','🐼','🦊','🐸','🦄','🐝','🦋','🌸','🌈'],
  ['👍','🤝','💪','🫡','🤟','✌️','🙌','👏','🤜','🫶'],
];

// ── GIF categories (dùng Giphy trending — sử dụng public beta key) ───────────
const GIPHY_KEY = 'dc6zaTOxFJmzC'; // public beta key Giphy

export default function ChatPage() {
  const { user } = useAuth();
  const { onlineUsers, incomingCall, clearIncomingCall, on, emit } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeCall, setActiveCall] = useState(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Toolbar state ─────────────────────────────────────────────────
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiGroup, setEmojiGroup] = useState(0);
  const [showSticker, setShowSticker] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [gifs, setGifs] = useState([]);
  const [gifSearch, setGifSearch] = useState('');
  const [gifLoading, setGifLoading] = useState(false);

  // ── Voice recording state ─────────────────────────────────────────
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    const u1 = on('new_message', (msg) => {
      if (selectedUser && (msg.senderId === selectedUser.id || msg.receiverId === selectedUser.id)) {
        setMessages(prev => [...prev, msg]);
      }
      loadConversations();
    });
    const u2 = on('message_sent', (msg) => {
      setMessages(prev => [...prev, msg]);
      loadConversations();
    });
    const u3 = on('user_typing', ({ userId, isTyping }) => {
      if (selectedUser && userId === selectedUser.id) setTyping(isTyping);
    });
    return () => { u1(); u2(); u3(); };
  }, [selectedUser, on]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedUser) loadMessages(selectedUser.id);
  }, [selectedUser]);

  useEffect(() => {
    if (searchQuery.trim()) {
      axios.get(`/api/users?search=${searchQuery}`).then(r => setSearchResults(r.data));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Load GIF trending khi mở panel lần đầu
  useEffect(() => {
    if (showGif && gifs.length === 0) fetchGifs('');
  }, [showGif]);

  const loadConversations = async () => {
    const res = await axios.get('/api/conversations');
    setConversations(res.data);
  };

  const loadMessages = async (userId) => {
    const res = await axios.get(`/api/messages/${userId}`);
    setMessages(res.data);
  };

  const sendMessage = (text, type = 'text') => {
    const content = text || input.trim();
    if (!content || !selectedUser) return;
    emit('send_message', { receiverId: selectedUser.id, text: content, type });
    setInput('');
    emit('typing', { receiverId: selectedUser.id, isTyping: false });
    setShowEmoji(false);
    setShowSticker(false);
    setShowGif(false);
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (selectedUser) {
      emit('typing', { receiverId: selectedUser.id, isTyping: true });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        emit('typing', { receiverId: selectedUser.id, isTyping: false });
      }, 1500);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const startCall = (callType) => {
    setActiveCall({ targetUser: selectedUser, callType, isIncoming: false, callerSignal: null });
    setShowCallModal(true);
  };

  const handleIncomingCall = () => {
    if (!incomingCall) return;
    const caller = conversations.find(c => c.friend.id === incomingCall.from)?.friend ||
      { id: incomingCall.from, name: incomingCall.callerName, avatar: incomingCall.callerAvatar };
    setActiveCall({ targetUser: caller, callType: incomingCall.callType, isIncoming: true, callerSignal: incomingCall.signal });
    setShowCallModal(true);
    clearIncomingCall();
  };

  const handleRejectIncomingCall = () => {
    if (incomingCall) {
      emit('reject_call', { targetId: incomingCall.from });
      clearIncomingCall();
    }
  };

  // ── Gửi ảnh ──────────────────────────────────────────────────────
  const handleImageSend = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedUser) return;
    const reader = new FileReader();
    reader.onload = () => {
      // Gửi dưới dạng data URL (base64) — server lưu hoặc relay qua socket
      emit('send_message', { receiverId: selectedUser.id, text: reader.result, type: 'image' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Emoji ─────────────────────────────────────────────────────────
  const insertEmoji = (emoji) => {
    setInput(prev => prev + emoji);
  };

  // ── Sticker ───────────────────────────────────────────────────────
  const sendSticker = (emoji) => {
    sendMessage(emoji, 'sticker');
  };

  // ── GIF ───────────────────────────────────────────────────────────
  const fetchGifs = async (q) => {
    setGifLoading(true);
    try {
      const endpoint = q
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=12&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=12&rating=g`;
      const res = await fetch(endpoint);
      const json = await res.json();
      setGifs(json.data || []);
    } catch {
      setGifs([]);
    }
    setGifLoading(false);
  };

  const sendGif = (gif) => {
    const url = gif.images?.fixed_height?.url || gif.images?.original?.url;
    if (url) sendMessage(url, 'gif');
    setShowGif(false);
  };

  // ── Voice recording ───────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = e => audioChunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        sendMessage(url, 'audio');
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch {
      alert('Không thể truy cập micro. Vui lòng kiểm tra quyền trình duyệt.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordTimerRef.current);
    setRecording(false);
    setRecordSeconds(0);
  };

  const fmtSec = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const getAvatar = (u) => u?.avatar ? `${API}${u.avatar}` : null;

  const Avatar = ({ u, size = 44, showOnline = false }) => (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: 'linear-gradient(135deg, #a855f7, #ec4899)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', fontSize: size * 0.4, color: 'white', fontWeight: 700, flexShrink: 0,
      }}>
        {getAvatar(u)
          ? <img src={getAvatar(u)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : u?.name?.[0]}
      </div>
      {showOnline && (
        <div style={{
          position: 'absolute', bottom: 1, right: 1,
          width: size < 36 ? 8 : 11, height: size < 36 ? 8 : 11,
          borderRadius: '50%',
          background: onlineUsers[u?.id] ? '#22c55e' : '#4b5563',
          border: '2px solid #1a1a2e',
        }} />
      )}
    </div>
  );

  // ── Render tin nhắn theo type ─────────────────────────────────────
  const renderMsgContent = (msg) => {
    if (msg.type === 'image') {
      return (
        <img
          src={msg.text}
          alt="ảnh"
          style={{ maxWidth: 220, maxHeight: 220, borderRadius: 12, display: 'block', cursor: 'pointer' }}
          onClick={() => window.open(msg.text, '_blank')}
        />
      );
    }
    if (msg.type === 'gif') {
      return (
        <img
          src={msg.text}
          alt="gif"
          style={{ maxWidth: 220, borderRadius: 12, display: 'block' }}
        />
      );
    }
    if (msg.type === 'sticker') {
      return <span style={{ fontSize: 52, lineHeight: 1 }}>{msg.text}</span>;
    }
    if (msg.type === 'audio') {
      return <audio src={msg.text} controls style={{ maxWidth: 220, height: 36 }} />;
    }
    return msg.text;
  };

  const closeAllPanels = () => { setShowEmoji(false); setShowSticker(false); setShowGif(false); };

  return (
    <div style={styles.container}>
      {/* ── Sidebar ─────────────────────────── */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarBrand}>
            <span style={styles.brandDot}>💜</span>
            <span style={styles.brandName}>YouLo</span>
          </div>
          <div style={styles.searchWrap}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              placeholder="Tìm kiếm..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>

        {searchQuery && searchResults.length > 0 && (
          <div style={styles.searchSection}>
            <p style={styles.sectionLabel}>KẾT QUẢ TÌM KIẾM</p>
            {searchResults.map(u => (
              <div key={u.id} style={styles.convItem} onClick={() => { setSelectedUser(u); setSearchQuery(''); }}>
                <Avatar u={u} showOnline />
                <div style={styles.convInfo}>
                  <span style={styles.convName}>{u.name}</span>
                  <span style={styles.convSub}>@{u.username}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={styles.sectionLabel}>TIN NHẮN GẦN ĐÂY</p>
        <div style={styles.convList}>
          {conversations.map(({ friend, lastMessage, unreadCount }) => (
            <div
              key={friend.id}
              style={{ ...styles.convItem, ...(selectedUser?.id === friend.id ? styles.convItemActive : {}) }}
              onClick={() => setSelectedUser(friend)}
            >
              <Avatar u={friend} showOnline />
              <div style={styles.convInfo}>
                <div style={styles.convRow}>
                  <span style={styles.convName}>{friend.name}</span>
                  {lastMessage && (
                    <span style={styles.convTime}>
                      {formatDistanceToNow(new Date(lastMessage.createdAt), { locale: vi, addSuffix: false })}
                    </span>
                  )}
                </div>
                <div style={styles.convRow}>
                  <span style={{
                    ...styles.convSub,
                    fontWeight: unreadCount ? 700 : 400,
                    color: unreadCount ? '#c084fc' : 'rgba(255,255,255,0.35)',
                  }}>
                    {lastMessage
                      ? (lastMessage.senderId === user.id ? '✓ ' : '') +
                        (lastMessage.type === 'image' ? '📷 Hình ảnh'
                          : lastMessage.type === 'gif' ? '🎞️ GIF'
                          : lastMessage.type === 'sticker' ? lastMessage.text
                          : lastMessage.type === 'audio' ? '🎤 Tin nhắn thoại'
                          : lastMessage.text)
                      : 'Bắt đầu trò chuyện 👋'}
                  </span>
                  {unreadCount > 0 && <span style={styles.badge}>{unreadCount}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Chat Area ────────────────────────── */}
      <div style={styles.chatArea} onClick={closeAllPanels}>
        {selectedUser ? (
          <>
            {/* Header */}
            <div style={styles.chatHeader} onClick={e => e.stopPropagation()}>
              <Avatar u={selectedUser} showOnline />
              <div style={{ flex: 1, marginLeft: 12 }}>
                <div style={styles.chatName}>{selectedUser.name}</div>
                <div style={styles.chatStatus}>
                  {onlineUsers[selectedUser.id]
                    ? <span style={{ color: '#4ade80' }}>● Đang hoạt động</span>
                    : <span style={{ color: 'rgba(255,255,255,0.3)' }}>● Không hoạt động</span>}
                </div>
              </div>
              <div style={styles.callButtons}>
                <button style={styles.callBtn} onClick={() => startCall('audio')} title="Gọi thoại">📞</button>
                <button style={styles.callBtn} onClick={() => startCall('video')} title="Gọi video">📹</button>
              </div>
            </div>

            {/* Messages */}
            <div style={styles.messages}>
              {messages.map(msg => (
                <div
                  key={msg.id}
                  style={{ ...styles.msgRow, justifyContent: msg.senderId === user.id ? 'flex-end' : 'flex-start' }}
                >
                  {msg.senderId !== user.id && <Avatar u={selectedUser} size={30} />}
                  <div style={{ maxWidth: '68%' }}>
                    <div style={{
                      ...styles.bubble,
                      // Sticker/gif/audio không có background
                      ...(msg.type === 'sticker' || msg.type === 'gif' || msg.type === 'audio'
                        ? { background: 'none', border: 'none', padding: 4, boxShadow: 'none' }
                        : msg.senderId === user.id ? styles.bubbleMine : styles.bubbleTheirs),
                    }}>
                      {renderMsgContent(msg)}
                    </div>
                    <div style={{ ...styles.msgTime, textAlign: msg.senderId === user.id ? 'right' : 'left' }}>
                      {formatDistanceToNow(new Date(msg.createdAt), { locale: vi, addSuffix: true })}
                      {msg.senderId === user.id && (msg.read ? ' ✓✓' : ' ✓')}
                    </div>
                  </div>
                </div>
              ))}

              {typing && (
                <div style={styles.msgRow}>
                  <Avatar u={selectedUser} size={30} />
                  <div style={{ ...styles.bubble, ...styles.bubbleTheirs, marginLeft: 8 }}>
                    <span style={styles.typingDots}><span>●</span><span>●</span><span>●</span></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Toolbar + Input ─────────────────────────────────────── */}
            <div style={styles.inputWrapper} onClick={e => e.stopPropagation()}>

              {/* ── Emoji Panel ── */}
              {showEmoji && (
                <div style={styles.popupPanel}>
                  {/* Group tabs */}
                  <div style={styles.emojiTabs}>
                    {EMOJI_GROUPS.map((g, i) => (
                      <button key={i} style={{ ...styles.emojiTab, ...(emojiGroup === i ? styles.emojiTabActive : {}) }}
                        onClick={() => setEmojiGroup(i)}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                  <div style={styles.emojiGrid}>
                    {EMOJI_GROUPS[emojiGroup].emojis.map(e => (
                      <button key={e} style={styles.emojiBtn} onClick={() => insertEmoji(e)}>{e}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Sticker Panel ── */}
              {showSticker && (
                <div style={styles.popupPanel}>
                  <div style={styles.panelTitle}>Sticker</div>
                  {STICKERS.map((row, i) => (
                    <div key={i} style={styles.stickerRow}>
                      {row.map(s => (
                        <button key={s} style={styles.stickerBtn} onClick={() => sendSticker(s)}>{s}</button>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* ── GIF Panel ── */}
              {showGif && (
                <div style={styles.popupPanel}>
                  <div style={styles.panelTitle}>GIF</div>
                  <input
                    style={styles.gifSearch}
                    placeholder="🔍 Tìm GIF..."
                    value={gifSearch}
                    onChange={e => setGifSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchGifs(gifSearch)}
                  />
                  {gifLoading
                    ? <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.4)' }}>Đang tải...</div>
                    : (
                      <div style={styles.gifGrid}>
                        {gifs.map(gif => (
                          <img
                            key={gif.id}
                            src={gif.images?.fixed_height_small?.url}
                            alt={gif.title}
                            style={styles.gifItem}
                            onClick={() => sendGif(gif)}
                          />
                        ))}
                        {gifs.length === 0 && <div style={{ color: 'rgba(255,255,255,0.3)', padding: 12, fontSize: 13 }}>Không tìm thấy GIF</div>}
                      </div>
                    )
                  }
                </div>
              )}

              {/* ── Toolbar row ── */}
              <div style={styles.toolbar}>
                {/* Micro */}
                <button
                  style={{ ...styles.toolBtn, ...(recording ? styles.toolBtnActive : {}) }}
                  title={recording ? 'Dừng ghi âm' : 'Ghi âm'}
                  onClick={recording ? stopRecording : startRecording}
                >
                  🎙️
                </button>
                {recording && <span style={styles.recTimer}>{fmtSec(recordSeconds)}</span>}

                {/* Ảnh */}
                <button style={styles.toolBtn} title="Gửi ảnh" onClick={() => fileInputRef.current?.click()}>📷</button>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSend} />

                {/* Sticker */}
                <button
                  style={{ ...styles.toolBtn, ...(showSticker ? styles.toolBtnActive : {}) }}
                  title="Sticker"
                  onClick={() => { setShowSticker(p => !p); setShowEmoji(false); setShowGif(false); }}
                >
                  🤩
                </button>

                {/* GIF */}
                <button
                  style={{ ...styles.toolBtnGif, ...(showGif ? styles.toolBtnActive : {}) }}
                  title="GIF"
                  onClick={() => { setShowGif(p => !p); setShowEmoji(false); setShowSticker(false); }}
                >
                  GIF
                </button>

                {/* Text input */}
                <input
                  style={styles.messageInput}
                  placeholder="Aa"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                />

                {/* Emoji */}
                <button
                  style={{ ...styles.toolBtn, ...(showEmoji ? styles.toolBtnActive : {}) }}
                  title="Emoji"
                  onClick={() => { setShowEmoji(p => !p); setShowSticker(false); setShowGif(false); }}
                >
                  😊
                </button>

                {/* Send */}
                <button style={styles.sendBtn} onClick={() => sendMessage()} title="Gửi">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyCircle}>💜</div>
            <h3 style={styles.emptyTitle}>Chào mừng đến YouLo</h3>
            <p style={styles.emptyText}>Chọn một cuộc trò chuyện hoặc tìm bạn bè để bắt đầu nhắn tin ✨</p>
          </div>
        )}
      </div>

      {/* ── Incoming Call Notification ────────── */}
      {incomingCall && !showCallModal && (
        <div style={styles.incomingCallNotif}>
          <div style={styles.callNotifPulse} />
          <div style={styles.callNotifInfo}>
            <div style={styles.callNotifIconWrap}>
              <span style={{ fontSize: 24 }}>{incomingCall.callType === 'video' ? '📹' : '📞'}</span>
            </div>
            <div>
              <div style={styles.callNotifName}>{incomingCall.callerName}</div>
              <div style={styles.callNotifType}>{incomingCall.callType === 'video' ? 'Gọi video đến' : 'Cuộc gọi đến'}</div>
            </div>
          </div>
          <div style={styles.callNotifBtns}>
            <button style={{ ...styles.callNotifBtn, background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 0 16px rgba(34,197,94,0.4)' }} onClick={handleIncomingCall}>📞</button>
            <button style={{ ...styles.callNotifBtn, background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 0 16px rgba(239,68,68,0.4)' }} onClick={handleRejectIncomingCall}>📵</button>
          </div>
        </div>
      )}

      {/* ── Active Call ───────────────────────── */}
      {showCallModal && activeCall && (
        <VideoCall
          targetUser={activeCall.targetUser}
          callType={activeCall.callType}
          isIncoming={activeCall.isIncoming}
          callerSignal={activeCall.callerSignal}
          onEnd={() => { setShowCallModal(false); setActiveCall(null); clearIncomingCall(); }}
        />
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex', height: '100%', background: '#0f0f1a' },

  // ── Sidebar
  sidebar: {
    width: 300, flexShrink: 0,
    background: '#13131f',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  sidebarHeader: { padding: '20px 16px 12px' },
  sidebarBrand: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 },
  brandDot: { fontSize: 20 },
  brandName: {
    fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px',
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  searchWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchIcon: { position: 'absolute', left: 12, fontSize: 14 },
  searchInput: {
    width: '100%', padding: '10px 14px 10px 34px',
    borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)', fontSize: 14,
    outline: 'none', color: 'white', boxSizing: 'border-box',
  },
  sectionLabel: {
    fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 700,
    letterSpacing: '1px', padding: '8px 20px 4px',
  },
  searchSection: { padding: '0 0 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  convList: { flex: 1, overflowY: 'auto', paddingBottom: 8 },
  convItem: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
    cursor: 'pointer', borderRadius: 14, margin: '2px 8px',
    transition: 'background 0.15s',
  },
  convItemActive: { background: 'rgba(168,85,247,0.12)' },
  convInfo: { flex: 1, minWidth: 0 },
  convRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  convName: { fontWeight: 600, fontSize: 14, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  convSub: { fontSize: 12, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  convTime: { fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0, marginLeft: 6 },
  badge: {
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    color: 'white', borderRadius: 10, padding: '1px 7px',
    fontSize: 11, fontWeight: 700, marginLeft: 4,
  },

  // ── Chat Area
  chatArea: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0f0f1a' },
  chatHeader: {
    display: 'flex', alignItems: 'center', padding: '14px 20px',
    background: '#13131f', borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  chatName: { fontWeight: 700, fontSize: 16, color: 'white' },
  chatStatus: { fontSize: 12, marginTop: 2 },
  callButtons: { display: 'flex', gap: 8 },
  callBtn: {
    width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(168,85,247,0.2)',
    background: 'rgba(168,85,247,0.15)',
    cursor: 'pointer', fontSize: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s',
  },

  // ── Messages
  messages: {
    flex: 1, overflowY: 'auto', padding: '20px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  bubble: { padding: '10px 14px', borderRadius: 18, fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' },
  bubbleMine: {
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    color: 'white', borderBottomRightRadius: 4, marginLeft: 8,
    boxShadow: '0 4px 12px rgba(168,85,247,0.3)',
  },
  bubbleTheirs: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.9)', borderBottomLeftRadius: 4, marginLeft: 8,
  },
  msgTime: { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 3, paddingLeft: 4 },
  typingDots: { color: '#a855f7', letterSpacing: 3, fontSize: 18 },

  // ── Input wrapper (toolbar + panels)
  inputWrapper: {
    background: '#13131f',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    position: 'relative',
  },

  // ── Toolbar
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 14px',
  },
  toolBtn: {
    width: 36, height: 36, borderRadius: 10, border: 'none',
    background: 'rgba(255,255,255,0.06)', cursor: 'pointer',
    fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'background 0.15s',
  },
  toolBtnGif: {
    height: 36, padding: '0 10px', borderRadius: 10, border: 'none',
    background: 'rgba(255,255,255,0.06)', cursor: 'pointer',
    fontSize: 13, fontWeight: 800, color: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'background 0.15s', letterSpacing: 0.5,
  },
  toolBtnActive: {
    background: 'rgba(168,85,247,0.25)',
    outline: '1.5px solid rgba(168,85,247,0.5)',
  },
  recTimer: {
    fontSize: 12, color: '#ef4444', fontWeight: 700, flexShrink: 0, minWidth: 36,
  },
  messageInput: {
    flex: 1, padding: '10px 16px', borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)', fontSize: 14, outline: 'none',
    background: 'rgba(255,255,255,0.05)', color: 'white',
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: '50%', border: 'none',
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    color: 'white', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(168,85,247,0.4)', flexShrink: 0,
  },

  // ── Popup panels (emoji / sticker / gif)
  popupPanel: {
    position: 'absolute', bottom: '100%', left: 0, right: 0,
    background: '#1a1a2e', borderTop: '1px solid rgba(255,255,255,0.08)',
    maxHeight: 280, overflowY: 'auto', padding: '10px 12px',
    boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
    zIndex: 100,
  },
  panelTitle: {
    fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1, marginBottom: 10,
  },

  // Emoji
  emojiTabs: { display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' },
  emojiTab: {
    padding: '4px 8px', borderRadius: 8, border: 'none',
    background: 'rgba(255,255,255,0.05)', cursor: 'pointer', fontSize: 16,
  },
  emojiTabActive: { background: 'rgba(168,85,247,0.3)', outline: '1px solid rgba(168,85,247,0.5)' },
  emojiGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 2,
  },
  emojiBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 22, padding: 4, borderRadius: 6,
    transition: 'background 0.1s',
  },

  // Sticker
  stickerRow: { display: 'flex', gap: 6, marginBottom: 6 },
  stickerBtn: {
    background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer',
    fontSize: 36, padding: '6px 8px', borderRadius: 10,
    transition: 'background 0.1s',
  },

  // GIF
  gifSearch: {
    width: '100%', padding: '8px 12px', borderRadius: 10, marginBottom: 8,
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)',
    color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  },
  gifGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 },
  gifItem: {
    width: '100%', borderRadius: 8, cursor: 'pointer',
    objectFit: 'cover', aspectRatio: '4/3', transition: 'opacity 0.15s',
  },

  // ── Empty state
  emptyState: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40,
  },
  emptyCircle: { fontSize: 64 },
  emptyTitle: { fontSize: 22, fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.5px' },
  emptyText: { color: 'rgba(255,255,255,0.35)', fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 1.6 },

  // ── Incoming call
  incomingCallNotif: {
    position: 'fixed', bottom: 28, right: 28,
    background: '#1a0a2e', border: '1px solid rgba(168,85,247,0.3)',
    borderRadius: 20, padding: '16px 20px',
    display: 'flex', gap: 14, alignItems: 'center',
    zIndex: 1000, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', minWidth: 300,
  },
  callNotifPulse: {
    position: 'absolute', inset: 0, borderRadius: 20,
    border: '2px solid rgba(168,85,247,0.4)',
    animation: 'glow 1.5s ease-in-out infinite', pointerEvents: 'none',
  },
  callNotifInfo: { display: 'flex', gap: 12, alignItems: 'center', flex: 1 },
  callNotifIconWrap: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  callNotifName: { color: 'white', fontWeight: 700, fontSize: 15 },
  callNotifType: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
  callNotifBtns: { display: 'flex', gap: 8 },
  callNotifBtn: {
    width: 44, height: 44, borderRadius: '50%', border: 'none',
    cursor: 'pointer', fontSize: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
