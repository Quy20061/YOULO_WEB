import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || '';

export default function CreateGroupModal({ onClose, onCreate }) {
  const [step, setStep] = useState(1); // 1: đặt tên, 2: chọn thành viên
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get('/api/friends').then(r => setFriends(r.data));
  }, []);

  const handleCreate = async () => {
    if (!groupName.trim()) { setError('Vui lòng nhập tên nhóm'); return; }
    if (selected.length < 1) { setError('Chọn ít nhất 1 thành viên'); return; }
    setLoading(true);
    try {
      const res = await axios.post('/api/groups', {
        name: groupName.trim(),
        memberIds: selected,
      });
      onCreate(res.data);
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Lỗi tạo nhóm');
    }
    setLoading(false);
  };

  const getAvatar = (u) => u?.avatar ? `${API}${u.avatar}` : null;

  const Avatar = ({ u, size = 40 }) => (
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

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerIcon}>👥</div>
          <div>
            <h2 style={styles.title}>Tạo nhóm mới</h2>
            <p style={styles.subtitle}>Bước {step}/2</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={styles.stepBar}>
          <div style={{ ...styles.stepDot, background: '#a855f7' }} />
          <div style={{ ...styles.stepLine, background: step === 2 ? '#a855f7' : 'rgba(255,255,255,0.1)' }} />
          <div style={{ ...styles.stepDot, background: step === 2 ? '#a855f7' : 'rgba(255,255,255,0.1)' }} />
        </div>

        {/* Step 1: Tên nhóm */}
        {step === 1 && (
          <div style={styles.body}>
            <div style={styles.groupPreview}>
              <div style={styles.groupAvatarLarge}>👥</div>
            </div>
            <label style={styles.label}>Tên nhóm</label>
            <input
              style={styles.input}
              placeholder="Ví dụ: Team CNPM Nhóm 10..."
              value={groupName}
              onChange={e => { setGroupName(e.target.value); setError(''); }}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && groupName.trim() && setStep(2)}
            />
            {error && <p style={styles.error}>{error}</p>}
            <button
              style={{ ...styles.nextBtn, opacity: groupName.trim() ? 1 : 0.5 }}
              onClick={() => { if (groupName.trim()) { setStep(2); setError(''); } }}
              disabled={!groupName.trim()}
            >
              Tiếp theo →
            </button>
          </div>
        )}

        {/* Step 2: Chọn thành viên */}
        {step === 2 && (
          <div style={styles.body}>
            <div style={styles.selectedChips}>
              {selected.map(id => {
                const f = friends.find(fr => fr.id === id);
                return f ? (
                  <div key={id} style={styles.chip}>
                    <span>{f.name.split(' ').pop()}</span>
                    <button style={styles.chipRemove} onClick={() => setSelected(s => s.filter(x => x !== id))}>✕</button>
                  </div>
                ) : null;
              })}
              {selected.length === 0 && (
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Chưa chọn thành viên nào...</span>
              )}
            </div>

            <div style={styles.friendList}>
              {friends.map(f => (
                <div key={f.id} style={{
                  ...styles.friendItem,
                  background: selected.includes(f.id) ? 'rgba(168,85,247,0.12)' : 'transparent',
                  border: selected.includes(f.id) ? '1px solid rgba(168,85,247,0.25)' : '1px solid transparent',
                }} onClick={() => {
                  setSelected(prev =>
                    prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                  );
                  setError('');
                }}>
                  <Avatar u={f} size={42} />
                  <div style={{ flex: 1 }}>
                    <div style={styles.friendName}>{f.name}</div>
                    <div style={styles.friendSub}>@{f.username}</div>
                  </div>
                  <div style={{
                    ...styles.checkCircle,
                    background: selected.includes(f.id) ? 'linear-gradient(135deg, #a855f7, #ec4899)' : 'rgba(255,255,255,0.08)',
                    border: selected.includes(f.id) ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
                  }}>
                    {selected.includes(f.id) && <span style={{ color: 'white', fontSize: 12 }}>✓</span>}
                  </div>
                </div>
              ))}
              {friends.length === 0 && (
                <div style={{ textAlign: 'center', padding: 30, color: 'rgba(255,255,255,0.3)' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
                  <p>Bạn chưa có bạn bè nào.<br />Hãy kết bạn trước!</p>
                </div>
              )}
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <div style={styles.btnRow}>
              <button style={styles.backBtn} onClick={() => { setStep(1); setError(''); }}>← Quay lại</button>
              <button
                style={{ ...styles.createBtn, opacity: loading ? 0.7 : 1 }}
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? 'Đang tạo...' : `🚀 Tạo nhóm${selected.length > 0 ? ` (${selected.length + 1})` : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    background: 'linear-gradient(160deg, #1a0a2e 0%, #13131f 100%)',
    border: '1px solid rgba(168,85,247,0.2)',
    borderRadius: 24, width: '100%', maxWidth: 420, maxHeight: '90vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(168,85,247,0.1)',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 14, padding: '20px 20px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  headerIcon: {
    width: 46, height: 46, borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
  },
  title: { color: 'white', margin: 0, fontSize: 18, fontWeight: 800 },
  subtitle: { color: 'rgba(255,255,255,0.35)', margin: 0, fontSize: 13 },
  closeBtn: {
    marginLeft: 'auto', background: 'rgba(255,255,255,0.08)', border: 'none',
    color: 'rgba(255,255,255,0.5)', borderRadius: '50%', width: 32, height: 32,
    cursor: 'pointer', fontSize: 14,
  },
  stepBar: { display: 'flex', alignItems: 'center', padding: '10px 24px', gap: 0 },
  stepDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  stepLine: { flex: 1, height: 2, transition: 'background 0.3s' },
  body: { flex: 1, overflowY: 'auto', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 },
  groupPreview: { display: 'flex', justifyContent: 'center', padding: '8px 0' },
  groupAvatarLarge: {
    width: 72, height: 72, borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
  },
  label: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px' },
  input: {
    padding: '13px 16px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 15,
    outline: 'none', fontFamily: 'inherit',
  },
  error: { color: '#f87171', fontSize: 13, margin: 0 },
  nextBtn: {
    padding: '13px', borderRadius: 14, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    color: 'white', fontWeight: 700, fontSize: 15,
    boxShadow: '0 4px 16px rgba(168,85,247,0.35)',
  },
  selectedChips: {
    display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 36,
    padding: '8px 12px', borderRadius: 12,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  chip: {
    display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
    background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.3)',
    borderRadius: 20, color: '#c084fc', fontSize: 13, fontWeight: 600,
  },
  chipRemove: { background: 'none', border: 'none', cursor: 'pointer', color: '#c084fc', fontSize: 12, padding: 0 },
  friendList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 },
  friendItem: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
    borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s',
  },
  friendName: { color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: 14 },
  friendSub: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 1 },
  checkCircle: {
    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
  },
  btnRow: { display: 'flex', gap: 10 },
  backBtn: {
    flex: 1, padding: '12px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontWeight: 600,
  },
  createBtn: {
    flex: 2, padding: '12px', borderRadius: 14, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    color: 'white', fontWeight: 700, fontSize: 14,
    boxShadow: '0 4px 16px rgba(168,85,247,0.35)',
  },
};
