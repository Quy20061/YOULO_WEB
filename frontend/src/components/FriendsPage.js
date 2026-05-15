import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';

const API = process.env.REACT_APP_API_URL || '';

export default function FriendsPage() {
  const { onlineUsers, on } = useSocket();
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [tab, setTab] = useState('friends');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadFriends();
    const unsub = on('friend_request', ({ from }) => {
      setMessage(`🔔 ${from.name} đã gửi lời mời kết bạn!`);
      setTimeout(() => setMessage(''), 4000);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      axios.get(`/api/users?search=${searchQuery}`).then(r => setSearchResults(r.data));
    } else setSearchResults([]);
  }, [searchQuery]);

  const loadFriends = async () => {
    const res = await axios.get('/api/friends');
    setFriends(res.data);
  };

  const sendFriendRequest = async (targetId) => {
    try {
      await axios.post('/api/friends/request', { targetId });
      setMessage('✅ Đã gửi lời mời kết bạn!');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setMessage('⚠️ ' + (e.response?.data?.error || 'Lỗi'));
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const getAvatar = (u) => u?.avatar ? `${API}${u.avatar}` : null;
  const AvatarComp = ({ u, size = 56 }) => (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #667eea, #764ba2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', fontSize: size * 0.4, color: 'white', fontWeight: 700, flexShrink: 0,
      position: 'relative'
    }}>
      {getAvatar(u) ? <img src={getAvatar(u)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u?.name?.[0]}
      <div style={{
        position: 'absolute', bottom: 2, right: 2, width: 13, height: 13,
        borderRadius: '50%', background: onlineUsers[u?.id] ? '#22c55e' : '#6b7280',
        border: '2px solid white'
      }} />
    </div>
  );

  return (
    <div style={styles.container}>
      {message && <div style={styles.toast}>{message}</div>}
      <div style={styles.header}>
        <h2 style={styles.title}>👥 Bạn bè</h2>
        <div style={styles.tabs}>
          {['friends', 'find'].map(t => (
            <button key={t} style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }} onClick={() => setTab(t)}>
              {t === 'friends' ? `Bạn bè (${friends.length})` : '🔍 Tìm bạn mới'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'find' && (
        <div style={styles.searchArea}>
          <input
            style={styles.searchInput}
            placeholder="🔍 Tìm theo tên hoặc username..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchResults.map(u => (
            <div key={u.id} style={styles.userCard}>
              <AvatarComp u={u} />
              <div style={styles.userInfo}>
                <div style={styles.userName}>{u.name}</div>
                <div style={styles.userSub}>@{u.username}</div>
                {u.bio && <div style={styles.userBio}>{u.bio}</div>}
              </div>
              <button style={styles.addBtn} onClick={() => sendFriendRequest(u.id)}>
                ➕ Kết bạn
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'friends' && (
        <div style={styles.grid}>
          {friends.map(f => (
            <div key={f.id} style={styles.friendCard}>
              <AvatarComp u={f} size={64} />
              <div style={styles.friendName}>{f.name}</div>
              <div style={styles.friendStatus}>
                {onlineUsers[f.id] ? '🟢 Đang hoạt động' : '⚫ Không hoạt động'}
              </div>
              {f.bio && <div style={styles.friendBio}>{f.bio}</div>}
            </div>
          ))}
          {friends.length === 0 && (
            <div style={styles.empty}>
              <div style={{ fontSize: 48, opacity: 0.3 }}>👥</div>
              <p>Chưa có bạn bè. Hãy tìm bạn mới!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { flex: 1, overflowY: 'auto', padding: 24 },
  toast: {
    position: 'fixed', top: 20, right: 20, background: '#1f2937', color: 'white',
    padding: '12px 20px', borderRadius: 12, zIndex: 9999, fontSize: 14,
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
  },
  header: { marginBottom: 24 },
  title: { margin: '0 0 16px', fontSize: 22, fontWeight: 800, color: '#111827' },
  tabs: { display: 'flex', gap: 8 },
  tab: {
    padding: '8px 20px', border: '1.5px solid #e5e7eb',
    borderRadius: 20, cursor: 'pointer', background: 'white',
    fontSize: 14, fontWeight: 500, color: '#374151', transition: 'all 0.2s'
  },
  tabActive: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: '1.5px solid transparent' },
  searchArea: { display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 600 },
  searchInput: {
    padding: '12px 18px', borderRadius: 16, border: '1.5px solid #e5e7eb',
    fontSize: 15, outline: 'none', color: '#1f2937', background: 'white'
  },
  userCard: {
    background: 'white', borderRadius: 16, padding: '16px 20px',
    display: 'flex', alignItems: 'center', gap: 14,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
  },
  userInfo: { flex: 1 },
  userName: { fontWeight: 700, fontSize: 15, color: '#111827' },
  userSub: { color: '#9ca3af', fontSize: 13 },
  userBio: { color: '#6b7280', fontSize: 13, marginTop: 2 },
  addBtn: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white', border: 'none', borderRadius: 10,
    padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  friendCard: {
    background: 'white', borderRadius: 20, padding: '24px 20px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'transform 0.2s'
  },
  friendName: { fontWeight: 700, fontSize: 15, color: '#111827', textAlign: 'center' },
  friendStatus: { fontSize: 12, color: '#6b7280' },
  friendBio: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 1.4 },
  empty: { gridColumn: '1/-1', textAlign: 'center', padding: 60, color: '#6b7280' }
};
