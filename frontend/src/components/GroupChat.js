import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const API = process.env.REACT_APP_API_URL || '';

export default function GroupChat({ group, onBack, onGroupUpdated }) {
  const { user } = useAuth();
  const { emit, on } = useSocket();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [addMsg, setAddMsg] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => { loadMessages(); }, [group.id]);

  useEffect(() => {
    const unsub = on('new_group_message', (msg) => {
      if (msg.groupId === group.id) {
        setMessages(prev => [...prev, msg]);
      }
    });
    return () => unsub();
  }, [group.id, on]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const res = await axios.get(`/api/groups/${group.id}/messages`);
      setMessages(res.data);
    } catch (e) { console.error(e); }
  };

  const loadFriends = async () => {
    const res = await axios.get('/api/friends');
    // Filter out members already in group
    const memberIds = group.members.map(m => m.id);
    setFriends(res.data.filter(f => !memberIds.includes(f.id)));
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    emit('send_group_message', { groupId: group.id, text: input.trim() });
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleAddMembers = async () => {
    if (selectedFriends.length === 0) return;
    try {
      const res = await axios.post(`/api/groups/${group.id}/members`, { memberIds: selectedFriends });
      setAddMsg('✅ Đã thêm thành viên!');
      setSelectedFriends([]);
      setShowAddMember(false);
      onGroupUpdated(res.data);
      setTimeout(() => setAddMsg(''), 3000);
    } catch (e) {
      setAddMsg('⚠️ ' + (e.response?.data?.error || 'Lỗi'));
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Bạn có chắc muốn rời nhóm?')) return;
    try {
      await axios.delete(`/api/groups/${group.id}/members/me`);
      onBack();
    } catch (e) {
      alert('Lỗi rời nhóm: ' + (e.response?.data?.error || 'Không xác định'));
    }
  };

  const getAvatar = (u) => u?.avatar ? `${API}${u.avatar}` : null;

  const Avatar = ({ u, size = 36 }) => (
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
  );

  const GroupAvatar = ({ size = 44 }) => (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, flexShrink: 0,
    }}>
      👥
    </div>
  );

  const isAdmin = group.adminId === user.id;

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>←</button>
        <GroupAvatar size={40} />
        <div style={{ flex: 1, marginLeft: 10 }}>
          <div style={styles.groupName}>{group.name}</div>
          <div style={styles.memberCount}>{group.members.length} thành viên</div>
        </div>
        <button style={styles.iconBtn} onClick={() => setShowMembers(true)} title="Thành viên">
          👥
        </button>
      </div>

      {addMsg && <div style={styles.toast}>{addMsg}</div>}

      {/* Messages */}
      <div style={styles.messages}>
        {messages.map(msg => {
          const isMine = msg.senderId === user.id;
          const sender = group.members.find(m => m.id === msg.senderId);
          return (
            <div key={msg.id} style={{ ...styles.msgRow, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              {!isMine && <Avatar u={sender || { name: '?' }} size={30} />}
              <div style={{ maxWidth: '68%' }}>
                {!isMine && (
                  <div style={styles.senderName}>{sender?.name || 'Thành viên'}</div>
                )}
                <div style={{
                  ...styles.bubble,
                  ...(isMine ? styles.bubbleMine : styles.bubbleTheirs),
                }}>
                  {msg.text}
                </div>
                <div style={{ ...styles.msgTime, textAlign: isMine ? 'right' : 'left' }}>
                  {formatDistanceToNow(new Date(msg.createdAt), { locale: vi, addSuffix: true })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputArea}>
        <input
          style={styles.messageInput}
          placeholder={`Nhắn vào ${group.name}... 💬`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button style={styles.sendBtn} onClick={sendMessage}>
          <span style={{ fontSize: 20 }}>➤</span>
        </button>
      </div>

      {/* Members Panel */}
      {showMembers && (
        <div style={styles.overlay} onClick={() => setShowMembers(false)}>
          <div style={styles.panel} onClick={e => e.stopPropagation()}>
            <div style={styles.panelHeader}>
              <h3 style={styles.panelTitle}>👥 Thành viên nhóm</h3>
              <button style={styles.closeBtn} onClick={() => setShowMembers(false)}>✕</button>
            </div>
            <div style={styles.memberList}>
              {group.members.map(m => (
                <div key={m.id} style={styles.memberItem}>
                  <Avatar u={m} size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={styles.memberName}>{m.name} {m.id === user.id ? '(Bạn)' : ''}</div>
                    <div style={styles.memberRole}>{m.id === group.adminId ? '👑 Admin' : '👤 Thành viên'}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={styles.panelActions}>
              {isAdmin && (
                <button style={styles.addMemberBtn} onClick={() => {
                  setShowMembers(false);
                  setShowAddMember(true);
                  loadFriends();
                }}>
                  ➕ Thêm thành viên
                </button>
              )}
              <button style={styles.leaveBtn} onClick={handleLeaveGroup}>
                🚪 Rời nhóm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Panel */}
      {showAddMember && (
        <div style={styles.overlay} onClick={() => setShowAddMember(false)}>
          <div style={styles.panel} onClick={e => e.stopPropagation()}>
            <div style={styles.panelHeader}>
              <h3 style={styles.panelTitle}>➕ Thêm thành viên</h3>
              <button style={styles.closeBtn} onClick={() => setShowAddMember(false)}>✕</button>
            </div>
            {friends.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 20 }}>
                Tất cả bạn bè đã trong nhóm!
              </p>
            ) : (
              <div style={styles.memberList}>
                {friends.map(f => (
                  <div key={f.id} style={{
                    ...styles.memberItem, cursor: 'pointer',
                    background: selectedFriends.includes(f.id) ? 'rgba(168,85,247,0.15)' : 'transparent',
                    borderRadius: 12,
                  }} onClick={() => {
                    setSelectedFriends(prev =>
                      prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                    );
                  }}>
                    <Avatar u={f} size={40} />
                    <div style={{ flex: 1 }}>
                      <div style={styles.memberName}>{f.name}</div>
                      <div style={styles.memberRole}>@{f.username}</div>
                    </div>
                    <span style={{ fontSize: 20 }}>
                      {selectedFriends.includes(f.id) ? '✅' : '⬜'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {selectedFriends.length > 0 && (
              <button style={styles.addMemberBtn} onClick={handleAddMembers}>
                Thêm {selectedFriends.length} người vào nhóm
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0f0f1a' },
  header: {
    display: 'flex', alignItems: 'center', padding: '12px 16px',
    background: '#13131f', borderBottom: '1px solid rgba(255,255,255,0.06)', gap: 8,
  },
  backBtn: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
    fontSize: 20, cursor: 'pointer', padding: '4px 8px', borderRadius: 8,
  },
  groupName: { fontWeight: 700, fontSize: 15, color: 'white' },
  memberCount: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  iconBtn: {
    background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)',
    borderRadius: 10, padding: '6px 10px', cursor: 'pointer', fontSize: 18,
  },
  toast: {
    position: 'fixed', top: 20, right: 20, background: '#1f2937', color: 'white',
    padding: '12px 20px', borderRadius: 12, zIndex: 9999, fontSize: 14,
  },
  messages: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  senderName: { fontSize: 11, color: '#a855f7', fontWeight: 600, marginBottom: 3, paddingLeft: 10 },
  bubble: { padding: '10px 14px', borderRadius: 18, fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' },
  bubbleMine: {
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    color: 'white', borderBottomRightRadius: 4, marginLeft: 8,
    boxShadow: '0 4px 12px rgba(168,85,247,0.3)',
  },
  bubbleTheirs: {
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.9)', borderBottomLeftRadius: 4, marginLeft: 8,
  },
  msgTime: { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 3, paddingLeft: 4 },
  inputArea: {
    display: 'flex', gap: 10, padding: '14px 20px',
    background: '#13131f', borderTop: '1px solid rgba(255,255,255,0.06)', alignItems: 'center',
  },
  messageInput: {
    flex: 1, padding: '12px 18px', borderRadius: 24,
    border: '1px solid rgba(255,255,255,0.1)', fontSize: 14, outline: 'none',
    background: 'rgba(255,255,255,0.05)', color: 'white',
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: '50%', border: 'none',
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    color: 'white', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(168,85,247,0.4)', flexShrink: 0,
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000,
  },
  panel: {
    background: '#1a1a2e', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480,
    padding: '20px 20px 36px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  panelTitle: { color: 'white', margin: 0, fontSize: 17, fontWeight: 700 },
  closeBtn: {
    background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)',
    borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 14,
  },
  memberList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 },
  memberItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px' },
  memberName: { color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: 14 },
  memberRole: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 },
  panelActions: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 },
  addMemberBtn: {
    padding: '12px', borderRadius: 14, border: 'none', cursor: 'pointer', fontWeight: 700,
    background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white', fontSize: 14,
  },
  leaveBtn: {
    padding: '12px', borderRadius: 14, border: '1px solid rgba(239,68,68,0.3)',
    cursor: 'pointer', fontWeight: 700, background: 'rgba(239,68,68,0.1)',
    color: '#f87171', fontSize: 14,
  },
};
