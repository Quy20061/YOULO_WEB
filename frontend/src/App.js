import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import AuthPage from './components/AuthPage';
import ChatPage from './components/ChatPage';
import FeedPage from './components/FeedPage';
import FriendsPage from './components/FriendsPage';
import ProfilePage from './components/ProfilePage';

const API = process.env.REACT_APP_API_URL || '';

function AppLayout() {
  const { user, loading, logout } = useAuth();
  const [page, setPage] = useState('feed');

  if (loading) return (
    <div style={styles.loading}>
      <div style={styles.loadingCircle}>💜</div>
      <p style={styles.loadingText}>YouLo đang khởi động...</p>
      <div style={styles.loadingBar}><div style={styles.loadingProgress} /></div>
    </div>
  );

  if (!user) return <AuthPage />;

  const getAvatar = () => user?.avatar ? `${API}${user.avatar}` : null;

  const navItems = [
    { id: 'feed',    icon: '🏠', label: 'Trang chủ' },
    { id: 'chat',    icon: '💬', label: 'Tin nhắn' },
    { id: 'friends', icon: '👥', label: 'Bạn bè' },
    { id: 'profile', icon: '✨', label: 'Hồ sơ' },
  ];

  return (
    <SocketProvider>
      <div style={styles.app}>
        {/* ── Side Nav */}
        <nav style={styles.nav}>
          <div style={styles.navLogo}>
            <span style={{ fontSize: 24 }}>💜</span>
            <span style={styles.navLogoText}>YouLo</span>
          </div>

          <div style={styles.navLinks}>
            {navItems.map(item => (
              <button
                key={item.id}
                style={{ ...styles.navItem, ...(page === item.id ? styles.navItemActive : {}) }}
                onClick={() => setPage(item.id)}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                <span style={styles.navLabel}>{item.label}</span>
                {page === item.id && <div style={styles.navIndicator} />}
              </button>
            ))}
          </div>

          <div style={styles.navUser}>
            <div style={styles.userAvatar}>
              {getAvatar()
                ? <img src={getAvatar()} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : <span style={styles.userAvatarText}>{user.name[0]}</span>
              }
            </div>
            <div style={styles.userInfo}>
              <div style={styles.userName}>{user.name}</div>
              <div style={styles.userSub}>@{user.username}</div>
            </div>
            <button style={styles.logoutMini} onClick={logout}>🚪</button>
          </div>
        </nav>

        {/* ── Main */}
        <main style={styles.main}>
          {page === 'feed'    && <FeedPage />}
          {page === 'chat'    && <ChatPage />}
          {page === 'friends' && <FriendsPage />}
          {page === 'profile' && <ProfilePage />}
        </main>
      </div>
    </SocketProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppLayout />
    </AuthProvider>
  );
}

const styles = {
  loading: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 100%)', gap: 16,
  },
  loadingCircle: { fontSize: 64, animation: 'pulse 1.5s ease-in-out infinite' },
  loadingText: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 600, margin: 0 },
  loadingBar: { width: 160, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  loadingProgress: {
    height: '100%', width: '60%', borderRadius: 2,
    background: 'linear-gradient(90deg, #a855f7, #ec4899)',
    animation: 'pulse 1s ease-in-out infinite',
  },
  app: { display: 'flex', height: '100vh', overflow: 'hidden', background: '#0f0f1a' },
  nav: {
    width: 220, flexShrink: 0,
    background: '#0a0a14',
    borderRight: '1px solid rgba(255,255,255,0.05)',
    display: 'flex', flexDirection: 'column',
  },
  navLogo: {
    padding: '22px 20px 14px',
    display: 'flex', alignItems: 'center', gap: 10,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  navLogoText: {
    fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px',
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  navLinks: { flex: 1, padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
    border: 'none', background: 'none', cursor: 'pointer', borderRadius: 14,
    width: '100%', textAlign: 'left', transition: 'all 0.15s', color: 'rgba(255,255,255,0.4)',
    position: 'relative',
  },
  navItemActive: {
    background: 'rgba(168,85,247,0.12)',
    color: '#c084fc',
    border: '1px solid rgba(168,85,247,0.15)',
  },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 14, fontWeight: 600 },
  navIndicator: {
    position: 'absolute', right: 12, width: 6, height: 6,
    borderRadius: '50%', background: 'linear-gradient(135deg,#a855f7,#ec4899)',
  },
  navUser: {
    padding: '14px 16px',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    display: 'flex', alignItems: 'center', gap: 10,
  },
  userAvatar: {
    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  userAvatarText: { color: 'white', fontWeight: 700, fontSize: 15 },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userSub: { fontSize: 11, color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  onlineDot: { width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 },
  logoutMini:{background:'#ef4444',border:'none',color:'white',borderRadius:8,padding:'6px 8px',cursor:'pointer'} ,
  main: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
};
