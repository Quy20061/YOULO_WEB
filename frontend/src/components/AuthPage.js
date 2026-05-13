import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ username: '', password: '', name: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) await login(form.username, form.password);
      else await register(form);
    } catch (err) {
      setError(err.response?.data?.error || 'Có lỗi xảy ra');
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.blob1} />
      <div style={styles.blob2} />
      <div style={styles.blob3} />

      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <div style={styles.logoCircle}>
            <span style={{ fontSize: 32 }}>💜</span>
          </div>
          <h1 style={styles.logoText}>YouLo</h1>
          <p style={styles.logoSub}>✨ Kết nối · Chia sẻ · Gọi điện</p>
        </div>

        <div style={styles.tabs}>
          <button style={{ ...styles.tab, ...(isLogin ? styles.tabActive : {}) }} onClick={() => setIsLogin(true)}>
            Đăng nhập
          </button>
          <button style={{ ...styles.tab, ...(!isLogin ? styles.tabActive : {}) }} onClick={() => setIsLogin(false)}>
            Đăng ký
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {!isLogin && (
            <>
              <div style={styles.field}>
                <label style={styles.label}>Họ tên *</label>
                <input style={styles.input} placeholder="Nguyễn Văn A" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Số điện thoại</label>
                <input style={styles.input} placeholder="0901234567" value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </>
          )}
          <div style={styles.field}>
            <label style={styles.label}>Tên đăng nhập *</label>
            <input style={styles.input} placeholder="username" value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Mật khẩu *</label>
            <input type="password" style={styles.input} placeholder="••••••••" value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
          </div>

          {error && <div style={styles.error}>⚠️ {error}</div>}

          <button type="submit" style={{ ...styles.submitBtn, opacity: loading ? 0.75 : 1 }} disabled={loading}>
            {loading ? '⏳ Đang xử lý...' : isLogin ? '🚀 Đăng nhập' : '✨ Tạo tài khoản'}
          </button>
        </form>

        {isLogin && (
          <div style={styles.demoHint}>
            <p style={styles.demoTitle}>🧪 Tài khoản thử (pass: 123456)</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {['alice', 'bob', 'carol', 'dave'].map(u => (
                <button key={u} style={styles.demoBtn}
                  onClick={() => setForm({ username: u, password: '123456', name: '', phone: '' })}>
                  {u}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 50%, #0f0f1a 100%)',
    position: 'relative', overflow: 'hidden', padding: 20,
  },
  blob1: {
    position: 'absolute', top: '-15%', right: '-10%', width: 500, height: 500,
    borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%)',
    filter: 'blur(40px)',
  },
  blob2: {
    position: 'absolute', bottom: '-15%', left: '-10%', width: 450, height: 450,
    borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.25) 0%, transparent 70%)',
    filter: 'blur(50px)',
  },
  blob3: {
    position: 'absolute', top: '40%', left: '30%', width: 300, height: 300,
    borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)',
    filter: 'blur(60px)',
  },
  card: {
    background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 28,
    padding: '40px 36px 32px', width: '100%', maxWidth: 420,
    boxShadow: '0 40px 100px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
    position: 'relative', zIndex: 1,
  },
  logoWrap: { textAlign: 'center', marginBottom: 28 },
  logoCircle: {
    width: 72, height: 72, borderRadius: '50%', margin: '0 auto 12px',
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 30px rgba(168,85,247,0.5)',
  },
  logoText: {
    fontSize: 36, fontWeight: 900, margin: '0 0 4px',
    background: 'linear-gradient(135deg, #a855f7, #ec4899, #f97316)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-1px',
  },
  logoSub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 },
  tabs: {
    display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 14,
    padding: 4, marginBottom: 24, border: '1px solid rgba(255,255,255,0.08)',
  },
  tab: {
    flex: 1, padding: '9px', border: 'none', background: 'transparent',
    cursor: 'pointer', borderRadius: 11, fontSize: 14, fontWeight: 600,
    color: 'rgba(255,255,255,0.4)', transition: 'all 0.25s',
  },
  tabActive: {
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    color: 'white', boxShadow: '0 4px 12px rgba(168,85,247,0.4)',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: {
    padding: '13px 16px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.1)',
    fontSize: 15, outline: 'none', color: 'white', background: 'rgba(255,255,255,0.06)',
    transition: 'border-color 0.2s',
  },
  error: {
    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171', padding: '10px 14px', borderRadius: 12, fontSize: 13,
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white',
    border: 'none', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', marginTop: 4, boxShadow: '0 8px 24px rgba(168,85,247,0.4)',
  },
  demoHint: {
    marginTop: 20, padding: '14px 16px',
    background: 'rgba(168,85,247,0.08)', borderRadius: 14,
    border: '1px solid rgba(168,85,247,0.2)',
  },
  demoTitle: { margin: 0, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  demoBtn: {
    background: 'rgba(168,85,247,0.2)', color: 'white',
    border: '1px solid rgba(168,85,247,0.4)', borderRadius: 10,
    padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
  },
};
