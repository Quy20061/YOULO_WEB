import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_API_URL || '';

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user?.name || '', bio: user?.bio || '', phone: user?.phone || '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const avatarRef = useRef();
  const navigate = useNavigate();

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.put('/api/users/profile', form);
      updateUser(res.data);
      setEditing(false);
      setMessage('✅ Cập nhật thành công!');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setMessage('⚠️ Lỗi cập nhật');
    }
    setSaving(false);
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await axios.put('/api/users/profile', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    updateUser(res.data);
    setMessage('✅ Đã cập nhật ảnh đại diện!');
    setTimeout(() => setMessage(''), 3000);
  };

  const getAvatar = () => user?.avatar ? `${API}${user.avatar}` : null;

  return (
    <div style={styles.container}>
      {message && <div style={styles.toast}>{message}</div>}
      <button style={styles.backBtn} onClick={() => navigate(-1)}>← Quay lại</button>
      <div style={styles.card}>
        {/* Cover */}
        <div style={styles.cover}>
          <div style={styles.coverGrad} />
          <div style={styles.coverPattern} />
        </div>

        {/* Avatar */}
        <div style={styles.avatarSection}>
          <div style={styles.avatarWrapper} onClick={() => avatarRef.current.click()}>
            <div style={styles.avatar}>
              {getAvatar() ? (
                <img src={getAvatar()} alt="" style={styles.avatarImg} />
              ) : (
                <span style={styles.avatarText}>{user?.name?.[0]}</span>
              )}
            </div>
            <div style={styles.avatarOverlay}>📷</div>
          </div>
          <input type="file" ref={avatarRef} accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>

        <div style={styles.info}>
          {editing ? (
            <div style={styles.editForm}>
              <input style={styles.editInput} placeholder="Họ tên" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              <input style={styles.editInput} placeholder="Số điện thoại" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              <textarea style={{ ...styles.editInput, minHeight: 80, resize: 'vertical' }} placeholder="Giới thiệu bản thân..." value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : '💾 Lưu'}</button>
                <button style={styles.cancelBtn} onClick={() => setEditing(false)}>Hủy</button>
              </div>
            </div>
          ) : (
            <>
              <h2 style={styles.name}>{user?.name}</h2>
              <p style={styles.username}>@{user?.username}</p>
              {user?.bio && <p style={styles.bio}>{user?.bio}</p>}
              {user?.phone && <p style={styles.detail}>📱 {user?.phone}</p>}
              <p style={styles.detail}>📅 Tham gia {new Date(user?.createdAt).toLocaleDateString('vi-VN')}</p>
              <div style={styles.actions}>
                <button style={styles.editBtn} onClick={() => setEditing(true)}>✏️ Chỉnh sửa</button>
                <button style={styles.logoutBtn} onClick={logout}>🚪 Đăng xuất</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { flex: 1, overflowY: 'auto', padding: 24, background: '#f3f4f6' },
  toast: {
    position: 'fixed', top: 20, right: 20, background: '#1f2937', color: 'white',
    padding: '12px 20px', borderRadius: 12, zIndex: 9999, fontSize: 14,
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
  },
  backBtn: {marginBottom:12,padding:'10px 16px',border:'none',borderRadius:10,background:'#111827',color:'white',cursor:'pointer'},
  card: { maxWidth: 500, margin: '0 auto', background: 'white', borderRadius: 24, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
  cover: { height: 160, position: 'relative', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', overflow: 'hidden' },
  coverGrad: { position: 'absolute', inset: 0, background: 'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent)', backgroundSize: '60px 60px' },
  coverPattern: {},
  avatarSection: { display: 'flex', justifyContent: 'center', marginTop: -50, position: 'relative', zIndex: 1 },
  avatarWrapper: { cursor: 'pointer', position: 'relative' },
  avatar: {
    width: 100, height: 100, borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '4px solid white', overflow: 'hidden',
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarText: { fontSize: 40, color: 'white', fontWeight: 700 },
  avatarOverlay: {
    position: 'absolute', inset: 0, borderRadius: '50%',
    background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 24, opacity: 0,
    transition: 'opacity 0.2s'
  },
  info: { padding: '16px 32px 32px', textAlign: 'center' },
  name: { margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#111827' },
  username: { margin: '0 0 12px', color: '#9ca3af', fontSize: 15 },
  bio: { color: '#374151', fontSize: 15, lineHeight: 1.6, margin: '0 0 8px' },
  detail: { color: '#6b7280', fontSize: 14, margin: '4px 0' },
  actions: { display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 },
  editBtn: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white', border: 'none', borderRadius: 12,
    padding: '10px 24px', cursor: 'pointer', fontWeight: 600, fontSize: 14
  },
  logoutBtn: {
    background: '#fee2e2', color: '#ef4444', border: 'none',
    borderRadius: 12, padding: '10px 24px', cursor: 'pointer', fontWeight: 600, fontSize: 14
  },
  editForm: { display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', marginTop: 8 },
  editInput: {
    padding: '12px 14px', border: '1.5px solid #e5e7eb', borderRadius: 12,
    fontSize: 14, outline: 'none', color: '#1f2937', fontFamily: 'inherit', background: '#fafafa'
  },
  saveBtn: {
    flex: 1, background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white', border: 'none', borderRadius: 10,
    padding: '10px', cursor: 'pointer', fontWeight: 600, fontSize: 14
  },
  cancelBtn: {
    flex: 1, background: '#f3f4f6', color: '#374151', border: 'none',
    borderRadius: 10, padding: '10px', cursor: 'pointer', fontWeight: 600, fontSize: 14
  }
};
