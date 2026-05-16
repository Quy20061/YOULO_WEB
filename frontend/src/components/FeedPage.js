import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const API = process.env.REACT_APP_API_URL || '';

export default function FeedPage() {
  const { user } = useAuth();
  const { on } = useSocket();
  const [posts, setPosts] = useState([]);
  const [newPostText, setNewPostText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [posting, setPosting] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const fileRef = useRef();

  useEffect(() => {
    loadPosts();
    const u1 = on('new_post', (post) => setPosts(prev => [post, ...prev]));
    const u2 = on('post_liked', ({ postId, likes, userId }) => {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likeCount: likes, liked: userId === user.id ? !p.liked : p.liked } : p));
    });
    const u3 = on('new_comment', ({ postId, comment }) => {
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        // Tránh duplicate nếu đã thêm qua handleComment
        if (p.comments?.some(c => c.id === comment.id)) return p;
        return { ...p, comments: [...(p.comments || []), comment] };
      }));
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  const loadPosts = async () => {
    const res = await axios.get('/api/posts');
    setPosts(res.data);
  };

  const handlePost = async () => {
    if (!newPostText.trim() && selectedFiles.length === 0) return;
    setPosting(true);
    const formData = new FormData();
    formData.append('text', newPostText);
    selectedFiles.forEach(f => formData.append('media', f));
    try {
      await axios.post('/api/posts', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setNewPostText('');
      setSelectedFiles([]);
    } catch (e) {}
    setPosting(false);
  };

  const handleLike = async (postId) => {
    const res = await axios.post(`/api/posts/${postId}/like`);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likeCount: res.data.likeCount, liked: res.data.liked } : p));
  };

  const handleComment = async (postId) => {
    const text = commentInputs[postId];
    if (!text?.trim()) return;
    try {
      const res = await axios.post(`/api/posts/${postId}/comment`, { text });
      const newComment = res.data;
      // Thêm bình luận trực tiếp vào state (không chờ socket)
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, comments: [...(p.comments || []), newComment] }
          : p
      ));
    } catch (e) {
      console.error('Lỗi gửi bình luận:', e);
    }
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
  };

  const getAvatar = (u) => u?.avatar ? `${API}${u.avatar}` : null;

  const AvatarComp = ({ u, size = 44 }) => (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #667eea, #764ba2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', fontSize: size * 0.4, color: 'white', fontWeight: 700, flexShrink: 0
    }}>
      {getAvatar(u) ? <img src={getAvatar(u)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u?.name?.[0]}
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.feed}>
        {/* Create Post */}
        <div style={styles.createPost}>
          <div style={styles.createHeader}>
            <AvatarComp u={user} />
            <textarea
              style={styles.postInput}
              placeholder={`${user?.name} ơi, bạn đang nghĩ gì vậy? 💭`}
              value={newPostText}
              onChange={e => setNewPostText(e.target.value)}
              rows={3}
            />
          </div>
          {selectedFiles.length > 0 && (
            <div style={styles.filePreview}>
              {selectedFiles.map((f, i) => (
                <div key={i} style={styles.fileChip}>
                  📎 {f.name}
                  <button onClick={() => setSelectedFiles(prev => prev.filter((_, j) => j !== i))} style={styles.removeFile}>×</button>
                </div>
              ))}
            </div>
          )}
          <div style={styles.createFooter}>
            <button style={styles.mediaBtn} onClick={() => fileRef.current.click()}>
              🖼️ Ảnh/Video
            </button>
            <input type="file" ref={fileRef} multiple accept="image/*,video/*" style={{ display: 'none' }}
              onChange={e => setSelectedFiles(Array.from(e.target.files))} />
            <button
              style={{ ...styles.postBtn, opacity: (!newPostText.trim() && selectedFiles.length === 0) || posting ? 0.5 : 1 }}
              onClick={handlePost} disabled={posting}
            >
              {posting ? '⏳ Đăng...' : '🚀 Đăng bài'}
            </button>
          </div>
        </div>

        {/* Posts */}
        {posts.map(post => (
          <div key={post.id} style={styles.postCard}>
            {/* Post Header */}
            <div style={styles.postHeader}>
              <AvatarComp u={post.user} />
              <div style={{ marginLeft: 12, flex: 1 }}>
                <div style={styles.posterName}>{post.user?.name}</div>
                <div style={styles.postTime}>
                  {formatDistanceToNow(new Date(post.createdAt), { locale: vi, addSuffix: true })}
                </div>
              </div>
            </div>

            {/* Post Text */}
            {post.text && <p style={styles.postText}>{post.text}</p>}

            {/* Post Media */}
            {post.media?.length > 0 && (
              <div style={styles.mediaGrid}>
                {post.media.map((m, i) => (
                  <img key={i} src={`${API}${m}`} alt="" style={styles.mediaImg} />
                ))}
              </div>
            )}

            {/* Stats */}
            <div style={styles.postStats}>
              <span style={styles.statText}>❤️ {post.likeCount} lượt thích</span>
              <span style={styles.statText}>💬 {post.comments?.length || 0} bình luận</span>
            </div>

            {/* Actions */}
            <div style={styles.postActions}>
              <button style={{ ...styles.actionBtn, color: post.liked ? '#ef4444' : '#6b7280' }} onClick={() => handleLike(post.id)}>
                {post.liked ? '❤️' : '🤍'} Thích
              </button>
              <button style={styles.actionBtn} onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}>
                💬 Bình luận
              </button>
              <button style={styles.actionBtn}>
                🔗 Chia sẻ
              </button>
            </div>

            {/* Comments */}
            {expandedComments[post.id] && (
              <div style={styles.commentsSection}>
                {post.comments?.map(c => (
                  <div key={c.id} style={styles.commentItem}>
                    <AvatarComp u={c.user} size={32} />
                    <div style={styles.commentBubble}>
                      <span style={styles.commentName}>{c.user?.name}</span>
                      <p style={styles.commentText}>{c.text}</p>
                    </div>
                  </div>
                ))}
                <div style={styles.commentInput}>
                  <AvatarComp u={user} size={32} />
                  <input
                    style={styles.commentBox}
                    placeholder="Viết bình luận..."
                    value={commentInputs[post.id] || ''}
                    onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleComment(post.id)}
                  />
                  <button style={styles.commentSend} onClick={() => handleComment(post.id)}>➤</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: { flex: 1, overflowY: 'auto', background: '#f3f4f6', padding: '20px 0' },
  feed: { maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px' },
  createPost: {
    background: 'white', borderRadius: 16, padding: 20,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
  },
  createHeader: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  postInput: {
    flex: 1, border: 'none', outline: 'none', resize: 'none',
    fontSize: 15, color: '#374151', fontFamily: 'inherit',
    background: '#f9fafb', borderRadius: 12, padding: '10px 14px'
  },
  filePreview: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  fileChip: {
    background: '#eff6ff', color: '#3b82f6', padding: '4px 10px',
    borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6
  },
  removeFile: { background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: 0 },
  createFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTop: '1px solid #f3f4f6' },
  mediaBtn: { background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#374151' },
  postBtn: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white', border: 'none', borderRadius: 10,
    padding: '8px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14
  },
  postCard: {
    background: 'white', borderRadius: 16, overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
  },
  postHeader: { display: 'flex', alignItems: 'center', padding: '16px 20px 12px' },
  posterName: { fontWeight: 700, fontSize: 15, color: '#111827' },
  postTime: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  postText: { padding: '0 20px 12px', margin: 0, fontSize: 15, color: '#1f2937', lineHeight: 1.6 },
  mediaGrid: { display: 'flex', flexWrap: 'wrap', gap: 2, margin: '0 0 12px' },
  mediaImg: { width: '100%', maxHeight: 400, objectFit: 'cover' },
  postStats: { display: 'flex', gap: 16, padding: '8px 20px', borderTop: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6' },
  statText: { fontSize: 13, color: '#6b7280' },
  postActions: { display: 'flex', padding: '4px 8px' },
  actionBtn: {
    flex: 1, background: 'none', border: 'none', cursor: 'pointer',
    padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 500,
    color: '#6b7280', transition: 'background 0.15s'
  },
  commentsSection: { padding: '12px 20px', background: '#f9fafb', borderTop: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: 10 },
  commentItem: { display: 'flex', gap: 8, alignItems: 'flex-start' },
  commentBubble: {
    background: 'white', borderRadius: 12, padding: '8px 12px',
    border: '1px solid #e5e7eb', flex: 1
  },
  commentName: { fontWeight: 600, fontSize: 13, color: '#374151', display: 'block' },
  commentText: { margin: '2px 0 0', fontSize: 14, color: '#1f2937' },
  commentInput: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 },
  commentBox: {
    flex: 1, padding: '8px 14px', borderRadius: 20,
    border: '1px solid #e5e7eb', fontSize: 14, outline: 'none',
    background: 'white', color: '#1f2937'
  },
  commentSend: {
    width: 36, height: 36, borderRadius: '50%', border: 'none',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white', cursor: 'pointer', fontSize: 14
  }
};
