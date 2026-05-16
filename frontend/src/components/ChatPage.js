import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import VideoCall from './VideoCall';
import GroupChat from './GroupChat';
import CreateGroupModal from './CreateGroupModal';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const API = process.env.REACT_APP_API_URL || '';

export default function ChatPage() {
  const { user } = useAuth();
  const { onlineUsers, incomingCall, clearIncomingCall, on, emit } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeCall, setActiveCall] = useState(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [tab, setTab] = useState('direct'); // 'direct' | 'groups'
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => { loadConversations(); loadGroups(); }, []);

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
    const u4 = on('new_group_message', (msg) => {
      loadGroups();
    });
    const u5 = on('group_updated', (updatedGroup) => {
      setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
      if (selectedGroup?.id === updatedGroup.id) setSelectedGroup(updatedGroup);
    });
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [selectedUser, selectedGroup, on]);

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

  const loadConversations = async () => {
    const res = await axios.get('/api/conversations');
    setConversations(res.data);
  };

  const loadGroups = async () => {
    try {
      const res = await axios.get('/api/groups');
      setGroups(res.data);
    } catch (e) { console.error(e); }
  };

  const loadMessages = async (userId) => {
    const res = await axios.get(`/api/messages/${userId}`);
    setMessages(res.data);
  };

  const sendMessage = () => {
    if (!input.trim() || !selectedUser) return;
    emit('send_message', { receiverId: selectedUser.id, text: input.trim(), type: 'text' });
    setInput('');
    emit('typing', { receiverId: selectedUser.id, isTyping: false });
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

  const GroupAvatar = ({ size = 44 }) => (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, flexShrink: 0,
    }}>👥</div>
  );

  // If a group is selected, show GroupChat
  if (selectedGroup) {
    return (
      <div style={styles.container}>
        <div style={styles.sidebar}>
          <SidebarContent
            tab={tab} setTab={setTab}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            conversations={conversations}
            groups={groups}
            selectedUser={selectedUser} setSelectedUser={(u) => { setSelectedUser(u); setSelectedGroup(null); }}
            selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup}
            setShowCreateGroup={setShowCreateGroup}
            Avatar={Avatar} GroupAvatar={GroupAvatar}
            user={user}
          />
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <GroupChat
            group={selectedGroup}
            onBack={() => setSelectedGroup(null)}
            onGroupUpdated={(updated) => {
              setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
              setSelectedGroup(updated);
            }}
          />
        </div>
        {showCreateGroup && (
          <CreateGroupModal
            onClose={() => setShowCreateGroup(false)}
            onCreate={(newGroup) => { setGroups(prev => [newGroup, ...prev]); setSelectedGroup(newGroup); setTab('groups'); }}
          />
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* ── Sidebar */}
      <div style={styles.sidebar}>
        <SidebarContent
          tab={tab} setTab={setTab}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          conversations={conversations}
          groups={groups}
          selectedUser={selectedUser} setSelectedUser={(u) => { setSelectedUser(u); setSelectedGroup(null); }}
          selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup}
          setShowCreateGroup={setShowCreateGroup}
          Avatar={Avatar} GroupAvatar={GroupAvatar}
          user={user}
        />
      </div>

      {/* ── Chat Area */}
      <div style={styles.chatArea}>
        {selectedUser ? (
          <>
            <div style={styles.chatHeader}>
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

            <div style={styles.messages}>
              {messages.map(msg => (
                <div key={msg.id} style={{ ...styles.msgRow, justifyContent: msg.senderId === user.id ? 'flex-end' : 'flex-start' }}>
                  {msg.senderId !== user.id && <Avatar u={selectedUser} size={30} />}
                  <div style={{ maxWidth: '68%' }}>
                    <div style={{ ...styles.bubble, ...(msg.senderId === user.id ? styles.bubbleMine : styles.bubbleTheirs) }}>
                      {msg.text}
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

            <div style={styles.inputArea}>
              <input
                style={styles.messageInput}
                placeholder="Nhắn gì đó... 💬"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
              />
              <button style={styles.sendBtn} onClick={sendMessage}>
                <span style={{ fontSize: 20 }}>➤</span>
              </button>
            </div>
          </>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyCircle}>💜</div>
            <h3 style={styles.emptyTitle}>Chào mừng đến YouLo</h3>
            <p style={styles.emptyText}>Chọn một cuộc trò chuyện hoặc tạo nhóm mới ✨</p>
            <button style={styles.createGroupBtnEmpty} onClick={() => setShowCreateGroup(true)}>
              👥 Tạo nhóm mới
            </button>
          </div>
        )}
      </div>

      {/* Incoming Call */}
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

      {showCallModal && activeCall && (
        <VideoCall
          targetUser={activeCall.targetUser}
          callType={activeCall.callType}
          isIncoming={activeCall.isIncoming}
          callerSignal={activeCall.callerSignal}
          onEnd={() => { setShowCallModal(false); setActiveCall(null); clearIncomingCall(); }}
        />
      )}

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreate={(newGroup) => { setGroups(prev => [newGroup, ...prev]); setSelectedGroup(newGroup); setTab('groups'); }}
        />
      )}
    </div>
  );
}

// ── Sidebar component (reused) ────────────────────────────────────────────────
function SidebarContent({ tab, setTab, searchQuery, setSearchQuery, searchResults,
  conversations, groups, selectedUser, setSelectedUser, selectedGroup, setSelectedGroup,
  setShowCreateGroup, Avatar, GroupAvatar, user }) {

  return (
    <>
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
        {/* Tab switcher */}
        <div style={styles.tabRow}>
          <button style={{ ...styles.tabBtn, ...(tab === 'direct' ? styles.tabBtnActive : {}) }} onClick={() => setTab('direct')}>
            💬 Tin nhắn
          </button>
          <button style={{ ...styles.tabBtn, ...(tab === 'groups' ? styles.tabBtnActive : {}) }} onClick={() => setTab('groups')}>
            👥 Nhóm
          </button>
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

      {tab === 'direct' && (
        <>
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
                    <span style={{ ...styles.convSub, fontWeight: unreadCount ? 700 : 400, color: unreadCount ? '#c084fc' : 'rgba(255,255,255,0.35)' }}>
                      {lastMessage ? (lastMessage.senderId === user.id ? '✓ ' : '') + lastMessage.text : 'Bắt đầu trò chuyện 👋'}
                    </span>
                    {unreadCount > 0 && <span style={styles.badge}>{unreadCount}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'groups' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 4px' }}>
            <p style={{ ...styles.sectionLabel, padding: 0 }}>NHÓM CỦA BẠN</p>
            <button style={styles.newGroupBtn} onClick={() => setShowCreateGroup(true)}>
              + Tạo nhóm
            </button>
          </div>
          <div style={styles.convList}>
            {groups.map(g => (
              <div
                key={g.id}
                style={{ ...styles.convItem, ...(selectedGroup?.id === g.id ? styles.convItemActive : {}) }}
                onClick={() => setSelectedGroup(g)}
              >
                <GroupAvatar size={44} />
                <div style={styles.convInfo}>
                  <div style={styles.convRow}>
                    <span style={styles.convName}>{g.name}</span>
                    {g.lastMessage && (
                      <span style={styles.convTime}>
                        {formatDistanceToNow(new Date(g.lastMessage.createdAt), { locale: vi, addSuffix: false })}
                      </span>
                    )}
                  </div>
                  <span style={{ ...styles.convSub, color: 'rgba(255,255,255,0.35)' }}>
                    {g.lastMessage ? g.lastMessage.text : `${g.members.length} thành viên`}
                  </span>
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: 'rgba(255,255,255,0.25)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
                <p style={{ fontSize: 13, margin: 0 }}>Chưa có nhóm nào.<br />Hãy tạo nhóm mới!</p>
                <button style={{ ...styles.newGroupBtn, marginTop: 14, padding: '8px 20px' }} onClick={() => setShowCreateGroup(true)}>
                  + Tạo nhóm
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}


const styles = {
  container: { display: 'flex', height: '100%', background: '#0f0f1a' },
  sidebar: { width: 300, flexShrink: 0, background: '#13131f', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  sidebarHeader: { padding: '20px 16px 12px' },
  sidebarBrand: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 },
  brandDot: { fontSize: 20 },
  brandName: { fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px', background: 'linear-gradient(135deg, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  searchWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchIcon: { position: 'absolute', left: 12, fontSize: 14 },
  searchInput: { width: '100%', padding: '10px 14px 10px 34px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)', fontSize: 14, outline: 'none', color: 'white', boxSizing: 'border-box' },
  tabRow: { display: 'flex', gap: 6, marginTop: 12 },
  tabBtn: { flex: 1, padding: '8px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s' },
  tabBtnActive: { background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.25)', color: '#c084fc' },
  sectionLabel: { fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 700, letterSpacing: '1px', padding: '8px 20px 4px' },
  searchSection: { padding: '0 0 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  convList: { flex: 1, overflowY: 'auto', paddingBottom: 8 },
  convItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', borderRadius: 14, margin: '2px 8px', transition: 'background 0.15s' },
  convItemActive: { background: 'rgba(168,85,247,0.12)' },
  convInfo: { flex: 1, minWidth: 0 },
  convRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  convName: { fontWeight: 600, fontSize: 14, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  convSub: { fontSize: 12, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  convTime: { fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0, marginLeft: 6 },
  badge: { background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700, marginLeft: 4 },
  newGroupBtn: { fontSize: 12, fontWeight: 700, color: '#c084fc', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' },
  chatArea: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0f0f1a' },
  chatHeader: { display: 'flex', alignItems: 'center', padding: '14px 20px', background: '#13131f', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  chatName: { fontWeight: 700, fontSize: 16, color: 'white' },
  chatStatus: { fontSize: 12, marginTop: 2 },
  callButtons: { display: 'flex', gap: 8 },
  callBtn: { width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(168,85,247,0.2)', background: 'rgba(168,85,247,0.15)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  messages: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  bubble: { padding: '10px 14px', borderRadius: 18, fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' },
  bubbleMine: { background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white', borderBottomRightRadius: 4, marginLeft: 8, boxShadow: '0 4px 12px rgba(168,85,247,0.3)' },
  bubbleTheirs: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)', borderBottomLeftRadius: 4, marginLeft: 8 },
  msgTime: { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 3, paddingLeft: 4 },
  typingDots: { color: '#a855f7', letterSpacing: 3, fontSize: 18 },
  inputArea: { display: 'flex', gap: 10, padding: '14px 20px', background: '#13131f', borderTop: '1px solid rgba(255,255,255,0.06)', alignItems: 'center' },
  messageInput: { flex: 1, padding: '12px 18px', borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)', fontSize: 14, outline: 'none', background: 'rgba(255,255,255,0.05)', color: 'white' },
  sendBtn: { width: 46, height: 46, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(168,85,247,0.4)', flexShrink: 0 },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 },
  emptyCircle: { fontSize: 64 },
  emptyTitle: { fontSize: 22, fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.5px' },
  emptyText: { color: 'rgba(255,255,255,0.35)', fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 1.6 },
  createGroupBtnEmpty: { padding: '12px 28px', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: 'white', fontWeight: 700, fontSize: 15, boxShadow: '0 4px 16px rgba(99,102,241,0.35)' },
  incomingCallNotif: { position: 'fixed', bottom: 28, right: 28, background: '#1a0a2e', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 20, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'center', zIndex: 1000, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', minWidth: 300 },
  callNotifPulse: { position: 'absolute', inset: 0, borderRadius: 20, border: '2px solid rgba(168,85,247,0.4)', pointerEvents: 'none' },
  callNotifInfo: { display: 'flex', gap: 12, alignItems: 'center', flex: 1 },
  callNotifIconWrap: { width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  callNotifName: { color: 'white', fontWeight: 700, fontSize: 15 },
  callNotifType: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
  callNotifBtns: { display: 'flex', gap: 8 },
  callNotifBtn: { width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' },
};
