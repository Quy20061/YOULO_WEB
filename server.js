const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');
if (!fs.existsSync('./uploads/avatars')) fs.mkdirSync('./uploads/avatars');
if (!fs.existsSync('./uploads/media')) fs.mkdirSync('./uploads/media');

const JWT_SECRET = 'youlo_secret_key_2024';

// === IN-MEMORY DATABASE ===
const db = {
  users: [],
  messages: [],
  posts: [],
  friendships: [],
  notifications: [],
  groups: []
};

// Seed demo users
const seedUsers = async () => {
  const password = await bcrypt.hash('123456', 10);
  db.users = [
    { id: 'u1', username: 'alice', password, name: 'Alice Nguyễn', avatar: null, phone: '0901234567', bio: 'Xin chào! Tôi là Alice 👋', online: false, socketId: null, createdAt: new Date().toISOString() },
    { id: 'u2', username: 'bob', password, name: 'Bob Trần', avatar: null, phone: '0912345678', bio: 'Lập trình viên đam mê ☕', online: false, socketId: null, createdAt: new Date().toISOString() },
    { id: 'u3', username: 'carol', password, name: 'Carol Lê', avatar: null, phone: '0923456789', bio: 'Yêu du lịch và ẩm thực 🌍', online: false, socketId: null, createdAt: new Date().toISOString() },
    { id: 'u4', username: 'dave', password, name: 'Dave Phạm', avatar: null, phone: '0934567890', bio: 'Nhà thiết kế UX/UI 🎨', online: false, socketId: null, createdAt: new Date().toISOString() },
  ];
  db.friendships = [
    { id: 'f1', userId1: 'u1', userId2: 'u2', status: 'accepted' },
    { id: 'f2', userId1: 'u1', userId2: 'u3', status: 'accepted' },
    { id: 'f3', userId1: 'u1', userId2: 'u4', status: 'accepted' },
    { id: 'f4', userId1: 'u2', userId2: 'u3', status: 'accepted' },
  ];
  db.messages = [
    { id: 'm1', senderId: 'u2', receiverId: 'u1', text: 'Chào Alice! 👋', type: 'text', createdAt: new Date(Date.now() - 3600000).toISOString(), read: true },
    { id: 'm2', senderId: 'u1', receiverId: 'u2', text: 'Hi Bob! Khỏe không?', type: 'text', createdAt: new Date(Date.now() - 3500000).toISOString(), read: true },
    { id: 'm3', senderId: 'u3', receiverId: 'u1', text: 'Alice ơi, cuối tuần đi cà phê không?', type: 'text', createdAt: new Date(Date.now() - 1800000).toISOString(), read: false },
  ];
  db.posts = [
    { id: 'p1', userId: 'u1', text: 'Hôm nay thật là một ngày tuyệt vời! ☀️ Mọi người có khỏe không?', media: [], likes: ['u2', 'u3'], comments: [{ id: 'c1', userId: 'u2', text: 'Tuyệt vời quá! 🎉', createdAt: new Date(Date.now()-1000000).toISOString() }], createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: 'p2', userId: 'u2', text: 'Vừa hoàn thành project mới 🚀 Cảm giác thật tuyệt khi code chạy đúng!', media: [], likes: ['u1', 'u4'], comments: [], createdAt: new Date(Date.now() - 5400000).toISOString() },
    { id: 'p3', userId: 'u3', text: 'Chuyến đi Đà Lạt cuối tuần thật tuyệt! 🌺 Thời tiết mát mẻ, không khí trong lành.', media: [], likes: ['u1', 'u2', 'u4'], comments: [{ id: 'c2', userId: 'u1', text: 'Đẹp quá! Lần sau rủ mình với nhé 😍', createdAt: new Date(Date.now()-500000).toISOString() }], createdAt: new Date(Date.now() - 10800000).toISOString() },
  ];
  console.log('✅ Seeded demo users: alice/123456, bob/123456, carol/123456, dave/123456');
};
seedUsers();

// === MULTER CONFIG ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'avatar' ? './uploads/avatars' : './uploads/media';
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// === AUTH MIDDLEWARE ===
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const safeUser = (u) => ({ id: u.id, username: u.username, name: u.name, avatar: u.avatar, bio: u.bio, phone: u.phone, online: u.online, createdAt: u.createdAt });

// === AUTH ROUTES ===
app.post('/api/auth/register', async (req, res) => {
  const { username, password, name, phone } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: 'Thiếu thông tin' });
  if (db.users.find(u => u.username === username)) return res.status(400).json({ error: 'Username đã tồn tại' });
  const hash = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), username, password: hash, name, phone: phone || '', bio: '', avatar: null, online: false, socketId: null, createdAt: new Date().toISOString() };
  db.users.push(user);
  const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: safeUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(400).json({ error: 'Tài khoản không tồn tại' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Mật khẩu sai' });
  const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: safeUser(user) });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(safeUser(user));
});

// === USER ROUTES ===
app.get('/api/users', authMiddleware, (req, res) => {
  const { search } = req.query;
  let users = db.users.filter(u => u.id !== req.user.id);
  if (search) users = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase()));
  res.json(users.map(safeUser));
});

app.get('/api/users/:id', authMiddleware, (req, res) => {
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(safeUser(user));
});

app.put('/api/users/profile', authMiddleware, upload.single('avatar'), (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (req.body.name) user.name = req.body.name;
  if (req.body.bio) user.bio = req.body.bio;
  if (req.body.phone) user.phone = req.body.phone;
  if (req.file) user.avatar = `/uploads/avatars/${req.file.filename}`;
  res.json(safeUser(user));
});

// === FRIENDS ROUTES ===
app.get('/api/friends', authMiddleware, (req, res) => {
  const myId = req.user.id;
  const friendships = db.friendships.filter(f => (f.userId1 === myId || f.userId2 === myId) && f.status === 'accepted');
  const friends = friendships.map(f => {
    const friendId = f.userId1 === myId ? f.userId2 : f.userId1;
    return safeUser(db.users.find(u => u.id === friendId));
  }).filter(Boolean);
  res.json(friends);
});

app.post('/api/friends/request', authMiddleware, (req, res) => {
  const { targetId } = req.body;
  const existing = db.friendships.find(f =>
    (f.userId1 === req.user.id && f.userId2 === targetId) ||
    (f.userId1 === targetId && f.userId2 === req.user.id)
  );
  if (existing) return res.status(400).json({ error: 'Đã là bạn bè hoặc đã gửi yêu cầu' });
  const friendship = { id: uuidv4(), userId1: req.user.id, userId2: targetId, status: 'pending', createdAt: new Date().toISOString() };
  db.friendships.push(friendship);
  const sender = db.users.find(u => u.id === req.user.id);
  const target = db.users.find(u => u.id === targetId);
  if (target?.socketId) {
    io.to(target.socketId).emit('friend_request', { from: safeUser(sender) });
  }
  res.json({ message: 'Đã gửi yêu cầu kết bạn' });
});

app.post('/api/friends/accept', authMiddleware, (req, res) => {
  const { requesterId } = req.body;
  const friendship = db.friendships.find(f => f.userId1 === requesterId && f.userId2 === req.user.id && f.status === 'pending');
  if (!friendship) return res.status(404).json({ error: 'Không tìm thấy yêu cầu' });
  friendship.status = 'accepted';
  res.json({ message: 'Đã chấp nhận kết bạn' });
});

// === MESSAGE ROUTES ===
app.get('/api/messages/:userId', authMiddleware, (req, res) => {
  const myId = req.user.id;
  const otherId = req.params.userId;
  const messages = db.messages.filter(m =>
    (m.senderId === myId && m.receiverId === otherId) ||
    (m.senderId === otherId && m.receiverId === myId)
  ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  // Mark as read
  messages.forEach(m => { if (m.receiverId === myId) m.read = true; });
  res.json(messages);
});

app.get('/api/conversations', authMiddleware, (req, res) => {
  const myId = req.user.id;
  const friends = db.friendships
    .filter(f => (f.userId1 === myId || f.userId2 === myId) && f.status === 'accepted')
    .map(f => f.userId1 === myId ? f.userId2 : f.userId1);

  const conversations = friends.map(friendId => {
    const friend = db.users.find(u => u.id === friendId);
    if (!friend) return null;
    const msgs = db.messages.filter(m =>
      (m.senderId === myId && m.receiverId === friendId) ||
      (m.senderId === friendId && m.receiverId === myId)
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const lastMsg = msgs[0] || null;
    const unread = msgs.filter(m => m.receiverId === myId && !m.read).length;
    return { friend: safeUser(friend), lastMessage: lastMsg, unreadCount: unread };
  }).filter(Boolean).sort((a, b) => {
    if (!a.lastMessage && !b.lastMessage) return 0;
    if (!a.lastMessage) return 1;
    if (!b.lastMessage) return -1;
    return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
  });
  res.json(conversations);
});

// === POST ROUTES ===
app.get('/api/posts', authMiddleware, (req, res) => {
  const myId = req.user.id;
  const friends = db.friendships
    .filter(f => (f.userId1 === myId || f.userId2 === myId) && f.status === 'accepted')
    .map(f => f.userId1 === myId ? f.userId2 : f.userId1);
  const visibleUserIds = [myId, ...friends];
  const posts = db.posts
    .filter(p => visibleUserIds.includes(p.userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(p => ({
      ...p,
      user: safeUser(db.users.find(u => u.id === p.userId)),
      likeCount: p.likes.length,
      liked: p.likes.includes(myId),
      comments: p.comments.map(c => ({ ...c, user: safeUser(db.users.find(u => u.id === c.userId)) }))
    }));
  res.json(posts);
});

app.post('/api/posts', authMiddleware, upload.array('media', 5), (req, res) => {
  const { text } = req.body;
  const media = (req.files || []).map(f => `/uploads/media/${f.filename}`);
  const post = { id: uuidv4(), userId: req.user.id, text: text || '', media, likes: [], comments: [], createdAt: new Date().toISOString() };
  db.posts.unshift(post);
  const enriched = { ...post, user: safeUser(db.users.find(u => u.id === req.user.id)), likeCount: 0, liked: false };
  io.emit('new_post', enriched);
  res.json(enriched);
});

app.post('/api/posts/:id/like', authMiddleware, (req, res) => {
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const idx = post.likes.indexOf(req.user.id);
  if (idx === -1) post.likes.push(req.user.id);
  else post.likes.splice(idx, 1);
  io.emit('post_liked', { postId: post.id, likes: post.likes.length, userId: req.user.id });
  res.json({ liked: idx === -1, likeCount: post.likes.length });
});

app.post('/api/posts/:id/comment', authMiddleware, (req, res) => {
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const comment = { id: uuidv4(), userId: req.user.id, text: req.body.text, createdAt: new Date().toISOString() };
  post.comments.push(comment);
  const enriched = { ...comment, user: safeUser(db.users.find(u => u.id === req.user.id)) };
  io.emit('new_comment', { postId: post.id, comment: enriched });
  res.json(enriched);
});


// === GROUP ROUTES ===
function enrichGroup(group) {
  return {
    id: group.id,
    name: group.name,
    adminId: group.adminId,
    createdAt: group.createdAt,
    members: group.members.map(id => {
      const u = db.users.find(u => u.id === id);
      return u ? safeUser(u) : null;
    }).filter(Boolean),
    lastMessage: group.messages.length > 0 ? group.messages[group.messages.length - 1] : null,
  };
}

app.get('/api/groups', authMiddleware, (req, res) => {
  const myId = req.user.id;
  const myGroups = db.groups.filter(g => g.members.includes(myId));
  res.json(myGroups.map(g => enrichGroup(g)));
});

app.post('/api/groups', authMiddleware, (req, res) => {
  const { name, memberIds } = req.body;
  if (!name || !memberIds || memberIds.length === 0) {
    return res.status(400).json({ error: 'Thiếu tên nhóm hoặc thành viên' });
  }
  const allMembers = [req.user.id, ...memberIds.filter(id => id !== req.user.id)];
  const group = {
    id: uuidv4(), name,
    adminId: req.user.id,
    members: allMembers,
    messages: [],
    createdAt: new Date().toISOString(),
  };
  db.groups.push(group);
  const enriched = enrichGroup(group);
  allMembers.forEach(memberId => {
    const u = db.users.find(u => u.id === memberId);
    if (u?.socketId && memberId !== req.user.id) {
      io.to(u.socketId).emit('group_updated', enriched);
    }
  });
  res.json(enriched);
});

app.get('/api/groups/:id/messages', authMiddleware, (req, res) => {
  const group = db.groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Nhóm không tồn tại' });
  if (!group.members.includes(req.user.id)) return res.status(403).json({ error: 'Bạn không trong nhóm' });
  res.json(group.messages);
});

app.post('/api/groups/:id/members', authMiddleware, (req, res) => {
  const group = db.groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Nhóm không tồn tại' });
  if (group.adminId !== req.user.id) return res.status(403).json({ error: 'Chỉ admin mới được thêm thành viên' });
  const { memberIds } = req.body;
  memberIds.forEach(id => { if (!group.members.includes(id)) group.members.push(id); });
  const enriched = enrichGroup(group);
  group.members.forEach(memberId => {
    const u = db.users.find(u => u.id === memberId);
    if (u?.socketId) io.to(u.socketId).emit('group_updated', enriched);
  });
  res.json(enriched);
});

app.delete('/api/groups/:id/members/me', authMiddleware, (req, res) => {
  const group = db.groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Nhóm không tồn tại' });
  group.members = group.members.filter(id => id !== req.user.id);
  if (group.adminId === req.user.id && group.members.length > 0) {
    group.adminId = group.members[0];
  }
  if (group.members.length === 0) {
    db.groups = db.groups.filter(g => g.id !== group.id);
  } else {
    const enriched = enrichGroup(group);
    group.members.forEach(memberId => {
      const u = db.users.find(u => u.id === memberId);
      if (u?.socketId) io.to(u.socketId).emit('group_updated', enriched);
    });
  }
  res.json({ message: 'Đã rời nhóm' });
});

// === SOCKET.IO ===
const userSockets = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  socket.on('auth', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.users.find(u => u.id === decoded.id);
      if (user) {
        user.online = true;
        user.socketId = socket.id;
        socket.userId = user.id;
        userSockets.set(user.id, socket.id);
        io.emit('user_status', { userId: user.id, online: true });
        console.log(`✅ User authenticated: ${user.name}`);
      }
    } catch (e) {
      console.log('Auth error:', e.message);
    }
  });

  // Realtime messaging
  socket.on('send_message', (data) => {
    const { receiverId, text, type } = data;
    const message = {
      id: uuidv4(),
      senderId: socket.userId,
      receiverId,
      text,
      type: type || 'text',
      createdAt: new Date().toISOString(),
      read: false
    };
    db.messages.push(message);
    const receiver = db.users.find(u => u.id === receiverId);
    if (receiver?.socketId) {
      io.to(receiver.socketId).emit('new_message', message);
    }
    socket.emit('message_sent', message);
  });

  // Typing indicator
  socket.on('typing', ({ receiverId, isTyping }) => {
    const receiver = db.users.find(u => u.id === receiverId);
    if (receiver?.socketId) {
      io.to(receiver.socketId).emit('user_typing', { userId: socket.userId, isTyping });
    }
  });

  // === WebRTC SIGNALING ===
  socket.on('call_user', ({ targetId, signal, callType, callerName, callerAvatar }) => {
    const target = db.users.find(u => u.id === targetId);
    if (target?.socketId) {
      io.to(target.socketId).emit('incoming_call', {
        from: socket.userId,
        signal,
        callType,
        callerName,
        callerAvatar
      });
    } else {
      socket.emit('call_failed', { reason: 'Người dùng không online' });
    }
  });

  socket.on('answer_call', ({ targetId, signal }) => {
    const target = db.users.find(u => u.id === targetId);
    if (target?.socketId) {
      io.to(target.socketId).emit('call_answered', { signal });
    }
  });

  socket.on('reject_call', ({ targetId }) => {
    const target = db.users.find(u => u.id === targetId);
    if (target?.socketId) {
      io.to(target.socketId).emit('call_rejected');
    }
  });

  socket.on('end_call', ({ targetId }) => {
    const target = db.users.find(u => u.id === targetId);
    if (target?.socketId) {
      io.to(target.socketId).emit('call_ended');
    }
  });

  socket.on('ice_candidate', ({ targetId, candidate }) => {
    const target = db.users.find(u => u.id === targetId);
    if (target?.socketId) {
      io.to(target.socketId).emit('ice_candidate', { candidate, from: socket.userId });
    }
  });


  // Group messaging
  socket.on('send_group_message', ({ groupId, text }) => {
    const group = db.groups.find(g => g.id === groupId);
    if (!group || !group.members.includes(socket.userId)) return;
    const msg = {
      id: uuidv4(),
      groupId,
      senderId: socket.userId,
      text,
      createdAt: new Date().toISOString(),
    };
    group.messages.push(msg);
    group.members.forEach(memberId => {
      const u = db.users.find(u => u.id === memberId);
      if (u?.socketId) {
        io.to(u.socketId).emit('new_group_message', msg);
      }
    });
  });

  socket.on('disconnect', () => {
    const user = db.users.find(u => u.socketId === socket.id);
    if (user) {
      user.online = false;
      user.socketId = null;
      userSockets.delete(user.id);
      io.emit('user_status', { userId: user.id, online: false });
      console.log(`👋 User disconnected: ${user.name}`);
    }
  });
});

// === SERVE FRONTEND (production) ===
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'frontend/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
