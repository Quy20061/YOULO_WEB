import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider, useSocket } from './contexts/SocketContext';
import AuthPage from './components/AuthPage';
import ChatPage from './components/ChatPage';
import FeedPage from './components/FeedPage';
import FriendsPage from './components/FriendsPage';
import ProfilePage from './components/ProfilePage';
import VideoCall from './components/VideoCall';

const API = process.env.REACT_APP_API_URL || '';

// ── FIX 5: Global incoming call + notification — nằm ngoài ChatPage ──────────
function GlobalOverlays({ page, setPage }) {
  const { incomingCall, clearIncomingCall, emit, on } = useSocket();
  const [showCallModal, setShowCallModal] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  // Badge đếm tin nhắn chưa đọc và lời mời kết bạn
  const [unreadMsg, setUnreadMsg] = useState(0);
  const [pendingFriends, setPendingFriends] = useState(0);

  // Đếm tin nhắn mới khi không ở trang chat
  useEffect(() => {
    const unsub = on('new_message', () => {
      if (page !== 'chat') setUnreadMsg(n => n + 1);
    });
    return () => unsub();
  }, [page]);

  // Đếm lời mời kết bạn mới
  useEffect(() => {
    const unsub = on('friend_request', () => {
      setPendingFriends(n => n + 1);
    });
    return () => unsub();
  }, []);

  // Reset badge khi vào đúng trang
  useEffect(() => {
    if (page === 'chat') setUnreadMsg(0);
    if (page === 'friends') setPendingFriends(0);
  }, [page]);

  const handleAnswer = () => {
    if (!incomingCall) return;
    const caller = { id: incomingCall.from, name: incomingCall.callerName, avatar: incomingCall.callerAvatar };
    setActiveCall({ targetUser: caller, callType: incomingCall.callType, isIncoming: true, callerSignal: incomingCall.signal });
    setShowCallModal(true);
  };

  const handleReject = () => {
    if (!incomingCall) return;
    emit('reject_call', { targetId: incomingCall.from });
    clearIncomingCall();
  };

  return (
    <>
      {/* ── Global incoming call banner (hiện ở mọi trang) ── */}
      {incomingCall && !showCallModal && (
        <div style={styles.incomingCallNotif}>
          <div style={styles.callNotifPulse} />
          <div style={styles.callNotifInfo}>
            <div style={styles.callNotifIconWrap}>
              <span style={{ fontSize: 22 }}>
                {incomingCall.callType === 'video' ? '📹' : '📞'}
              </span>
            </div>
            <div>
              <div style={styles.callNotifName}>{incomingCall.callerName}</div>
              <div style={styles.callNotifType}>
                {incomingCall.callType === 'video' ? 'Gọi video đến' : 'Cuộc gọi đến'}
              </div>
            </div>
          </div>
          <div style={styles.callNotifBtns}>
            <button
              style={{ ...styles.callNotifBtn, background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 0 16px rgba(34,197,94,0.4)' }}
              onClick={handleAnswer}
            >📞</button>
            <button
              style={{ ...styles.callNotifBtn, background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 0 16px rgba(239,68,68,0.4)' }}
              onClick={handleReject}
            >📵</button>
          </div>
        </div>
      )}

      {/* ── VideoCall modal (global) ── */}
      {showCallModal && activeCall && (
        <VideoCall
          targetUser={activeCall.targetUser}
          callType={activeCall.callType}
          isIncoming={activeCall.isIncoming}
          callerSignal={activeCall.callerSignal}
          onEnd={() => { setShowCallModal(false); setActiveCall(null); clearIncomingCall(); }}
        />
      )}

      {/* Trả badge ra ngoài để AppLayout dùng */}
      <BadgeBridge unreadMsg={unreadMsg} pendingFriends={pendingFriends} />
    </>
  );
}

// Context nội bộ để truyền badge xuống nav mà không prop-drill
const BadgeContext = React.createContext({ unreadMsg: 0, pendingFriends: 0 });
function BadgeBridge({ unreadMsg, pendingFriends }) {
  // Trick: ghi vào window để AppLayout đọc — đơn giản, không cần context thêm
  window.__youlo_badges = { unreadMsg, pendingFriends };
  return null;
}

function AppLayout() {
  const { user, loading, logout } = useAuth();
  const [page, setPage] = useState('feed');
  const [badges, setBadges] = useState({ unreadMsg: 0, pendingFriends: 0 });

  // Poll badges từ GlobalOverlays
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.__youlo_badges) setBadges({ ...window.__youlo_badges });
    }, 300);
    return () => clearInterval(interval);
  }, []);

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
    { id: 'feed',    icon: '🏠', label: 'Trang chủ', badge: 0 },
    { id: 'chat',    icon: '💬', label: 'Tin nhắn',  badge: badges.unreadMsg },
    { id: 'friends', icon: '👥', label: 'Bạn bè',    badge: badges.pendingFriends },
    { id: 'profile', icon: '✨', label: 'Hồ sơ',     badge: 0 },
  ];

  return (
    <SocketProvider>
      <div style={styles.app}>
        {/* ── Side Nav ── */}
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
                {/* ── FIX 5: Badge thông báo trên nav ── */}
                {item.badge > 0 && (
                  <span style={styles.navBadge}>{item.badge > 99 ? '99+' : item.badge}</span>
                )}
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
            <button
              title="Đăng xuất"
              onClick={logout}
              style={styles.logoutBtn}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
            >
              🚪
            </button>
          </div>
        </nav>

        {/* ── Main ── */}
        <main style={styles.main}>
          {page === 'feed'    && <FeedPage />}
          {page === 'chat'    && <ChatPage />}
          {page === 'friends' && <FriendsPage />}
          {page === 'profile' && <ProfilePage />}
        </main>

        {/* ── Global overlays (call banner, VideoCall modal) ── */}
        <GlobalOverlays page={page} setPage={setPage} />
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
  loadingCircle: { fontSize: 64 },
  loadingText: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 600, margin: 0 },
  loadingBar: { width: 160, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  loadingProgress: {
    height: '100%', width: '60%', borderRadius: 2,
    background: 'linear-gradient(90deg, #a855f7, #ec4899)',
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
  navLabel: { fontSize: 14, fontWeight: 600, flex: 1 },
  navBadge: {
    background: 'linear-gradient(135deg,#ef4444,#dc2626)',
    color: 'white', fontSize: 10, fontWeight: 800,
    borderRadius: 10, padding: '2px 6px', minWidth: 18, textAlign: 'center',
  },
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
  logoutBtn: {
    width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
    background: 'rgba(239,68,68,0.1)', color: 'white', fontSize: 15,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'background 0.2s',
  },
  main: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },

  // ── Incoming call banner ──────────────────────────────────────────
  incomingCallNotif: {
    position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg, #1a0a2e, #0f0f1a)',
    border: '1px solid rgba(168,85,247,0.4)',
    borderRadius: 20, padding: '14px 20px',
    display: 'flex', alignItems: 'center', gap: 16,
    zIndex: 9998, boxShadow: '0 8px 40px rgba(168,85,247,0.3)',
    minWidth: 320,
  },
  callNotifPulse: {
    position: 'absolute', inset: 0, borderRadius: 20,
    border: '2px solid rgba(168,85,247,0.6)',
    animation: 'pulse 1.5s ease-in-out infinite',
    pointerEvents: 'none',
  },
  callNotifInfo: { display: 'flex', alignItems: 'center', gap: 12, flex: 1 },
  callNotifIconWrap: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(168,85,247,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  callNotifName: { color: 'white', fontWeight: 700, fontSize: 15 },
  callNotifType: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  callNotifBtns: { display: 'flex', gap: 10 },
  callNotifBtn: {
    width: 44, height: 44, borderRadius: '50%', border: 'none',
    cursor: 'pointer', fontSize: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
