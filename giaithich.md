# Luồng Hoạt Động Từ Đăng Nhập Đến Đăng Xuất - Ứng Dụng Chat Zalo-Like

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Đăng nhập (Login)](#2-đăng-nhập-login)
3. [Sau khi đăng nhập - Thiết lập Socket](#3-sau-khi-đăng-nhập--thiết-lập-socket)
4. [Tải danh sách cuộc trò chuyện](#4-tải-danh-sách-cuộc-trò-chuyện)
5. [Mở cuộc trò chuyện / Tải tin nhắn](#5-mở-cuộc-trò-chuyện--tải-tin-nhắn)
6. [Gửi tin nhắn văn bản](#6-gửi-tin-nhắn-văn-bản)
7. [Gửi file (hình ảnh, video, audio)](#7-gửi-file-hình-ảnh-video-audio)
8. [Typing Indicator (trạng thái đang nhập)](#8-typing-indicator-trạng-thái-đang-nhập)
9. [Đánh dấu đã đọc (Read Receipt)](#9-đánh-dấu-đã-đọc-read-receipt)
10. [Tạo cuộc trò chuyện mới](#10-tạo-cuộc-trò-chuyện-mới)
11. [Cuộc gọi thoại / video (WebRTC)](#11-cuộc-gọi-thoại--video-webrtc)
12. [Ghim / Bỏ ghim tin nhắn](#12-ghim--bỏ-ghim-tin-nhắn)
13. [Chỉnh sửa / Thu hồi tin nhắn](#13-chỉnh-sửa--thu-hồi-tin-nhắn)
14. [Tìm kiếm tin nhắn](#14-tìm-kiếm-tin-nhắn)
15. [Đăng xuất (Logout)](#15-đăng-xuất-logout)
16. [Làm mới Access Token (Token Refresh)](#16-làm-mới-access-token-token-refresh)
17. [Xử lý lỗi & Mất kết nối](#17-xử-lý-lỗi--mất-kết-nối)

---

## 1. Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT (ChatUI - React)                   │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐   │
│  │ AuthContext  │   │SocketContext │   │  ConversationContext │   │
│  │ (Zustand)    │   │              │   │                      │   │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘   │
│         │                   │                       │                │
│  ┌──────▼───────┐   ┌──────▼───────┐   ┌──────────▼───────────┐   │
│  │ axiosClient  │   │socketService │   │   MessageStore        │   │
│  │ (HTTP/REST)  │   │(Socket.io)   │   │   (Zustand)           │   │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘   │
└─────────┼──────────────────┼──────────────────────┼────────────────┘
          │                  │                      │
          ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SERVER (ChatAPI - Node.js)                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      Express Server                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │  Middleware  │  │   Routers     │  │  Socket.IO       │   │   │
│  │  │  - Auth      │  │  - /api/auth  │  │  - Events        │   │   │
│  │  │  - CORS      │  │  - /api/users │  │  - Handlers      │   │   │
│  │  │  - Error     │  │  - /api/conv │  │    - Message     │   │   │
│  │  │              │  │  - /api/msg  │  │    - Call        │   │   │
│  │  │              │  │  - /api/upload│  │                  │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │   │
│  │         │                 │                    │            │   │
│  │         └─────────────────┼────────────────────┘            │   │
│  │                           ▼                                  │   │
│  │  ┌──────────────────────────────────────────────────────┐    │   │
│  │  │                  Service Layer                         │    │   │
│  │  │  authService | conversationService | messageService   │    │   │
│  │  └──────────────────────────────────────────────────────┘    │   │
│  │                           │                                  │   │
│  │                           ▼                                  │   │
│  │  ┌──────────────────────────────────────────────────────┐    │   │
│  │  │               Prisma ORM → MySQL Database             │    │   │
│  │  └──────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Các thành phần chính

| Thành phần | Mô tả |
|------------|-------|
| **axiosClient** | HTTP client dùng cho REST API (đăng nhập, lấy tin nhắn, gửi tin...) |
| **socketService** | Socket.io client cho real-time (tin nhắn mới, typing, cuộc gọi...) |
| **AuthContext** | Quản lý trạng thái đăng nhập, auto-refresh token |
| **SocketContext** | Kết nối socket, xử lý sự kiện real-time |
| **conversationStore** | Quản lý danh sách cuộc trò chuyện (Zustand) |
| **messageStore** | Quản lý tin nhắn theo từng cuộc trò chuyện (Zustand) |
| **callStore** | Quản lý trạng thái cuộc gọi (Zustand) |

---

## 2. Đăng nhập (Login)

### 2.1 FE: Gửi yêu cầu đăng nhập

**File:** `src/pages/auth/Login.jsx`

```
Người dùng nhập email + password → Submit form
```

**Code flow:**

```javascript
// Login.jsx - Khi user submit form
const handleSubmit = async (values) => {
  const result = await login(values.email, values.password);
  if (result.success) {
    navigate('/chat');  // Chuyển hướng đến trang chat
  }
};
```

**Request gửi lên server:**

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### 2.2 API: Xử lý đăng nhập

**File:** `src/routes/auth.routes.js`

```
Router nhận request POST /api/auth/login
        ↓
Gọi controller: authController.login
        ↓
Gọi service: authService.login(email, password)
        ↓
1. Tìm user theo email trong DB
2. Kiểm tra password với bcrypt.compare()
3. Tạo accessToken (JWT, 15 phút)
4. Tạo refreshToken (JWT, 7 ngày)
5. Lưu session vào bảng Session (lưu device info, IP, user agent)
6. Trả về user info + tokens
```

**Database query:**

```javascript
// Tìm user
const user = await prisma.user.findUnique({ where: { email } });

// Kiểm tra password
const isValid = await bcrypt.compare(password, user.passwordHash);

// Tạo JWT tokens
const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '15m' });
const refreshToken = jwt.sign({ userId: user.id, sessionId }, JWT_SECRET, { expiresIn: '7d' });
```

### 2.3 Response trả về cho FE

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "username": "johndoe",
      "displayName": "John Doe",
      "avatarUrl": "https://...",
      "status": "online"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### 2.4 FE: Xử lý response đăng nhập

**File:** `src/stores/authStore.js`

```javascript
async login(credentials) {
  // 1. Gọi API đăng nhập
  const response = await authApi.login(credentials);
  
  // 2. Lưu tokens vào localStorage
  localStorage.setItem(ACCESS_TOKEN, response.data.accessToken);
  localStorage.setItem(REFRESH_TOKEN, response.data.refreshToken);
  localStorage.setItem(USER_DATA, JSON.stringify(response.data.user));
  
  // 3. Cập nhật state
  set({ user: response.data.user, isAuthenticated: true });
  
  // 4. Lên lịch refresh token
  this.scheduleTokenRefresh(response.data.accessToken);
  
  return { success: true };
}
```

**AuthContext cập nhật:**

```javascript
// AuthContext.jsx
const login = async (email, password) => {
  const result = await authStore.login({ email, password });
  
  if (result.success) {
    // AuthContext bắt đầu socket connection
    connectSocket(result.accessToken);
  }
};
```

---

## 3. Sau khi đăng nhập - Thiết lập Socket

### 3.1 FE: Kết nối Socket.IO

**File:** `src/services/socketService.js`

```javascript
class SocketService {
  connect(token) {
    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this._flushPendingListeners();
    });
  }
}
```

**Handshake gửi lên server:**

```
GET /socket.io/?EIO=4&transport=polling
   ↓
Response: 40:{"sid":"abc123","upgrades":["websocket"],...}
   ↓
Upgrade lên WebSocket
```

### 3.2 API: Xác thực Socket connection

**File:** `src/socket/index.js`

```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    next();  // Cho phép kết nối
  } catch (err) {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', async (socket) => {
  // 1. Cập nhật trạng thái user thành online
  await prisma.user.update({
    where: { id: socket.userId },
    data: { status: 'online' }
  });

  // 2. Track socket
  socketService.trackSocket(socket.userId, socket.id);
  
  // 3. Broadcast user online
  io.emit('user_online', { userId: socket.userId });
});
```

### 3.3 FE: SocketContext lắng nghe sự kiện

**File:** `src/contexts/SocketContext.jsx`

```javascript
useEffect(() => {
  if (!isAuthenticated) return;

  const socket = socketService.connect(token);

  // Lắng nghe tin nhắn mới
  socket.on('new_message', (message) => {
    messageStore.addMessage(message.conversationId, message);
    conversationStore.updateLastMessage(message.conversationId, message);
  });

  // Lắng nghe typing
  socket.on('user_typing', ({ conversationId, userId, username }) => {
    messageStore.setTypingUser(conversationId, userId, username);
  });

  // Lắng nghe presence
  socket.on('user_online', ({ userId }) => {
    conversationStore.updateUserOnlineStatus(userId, true);
  });

  return () => socket.disconnect();
}, [isAuthenticated]);
```

---

## 4. Tải danh sách cuộc trò chuyện

### 4.1 FE: Gọi API lấy danh sách

**File:** `src/pages/chat/ChatLayout.jsx` (hoặc ConversationPage)

```javascript
useEffect(() => {
  conversationStore.fetchConversations();
}, []);
```

**Request:**

```
GET /api/conversations
Authorization: Bearer {accessToken}
```

### 4.2 API: Xử lý lấy danh sách cuộc trò chuyện

**File:** `src/routes/conversation.routes.js`

```
GET /api/conversations
        ↓
Middleware: authenticate (verify JWT)
        ↓
Controller: conversationController.getConversations
        ↓
Service: conversationService.getConversations(userId, query)
        ↓
Query Prisma:
  1. Tìm tất cả ConversationUser của user
  2. Với mỗi conversation, lấy:
     - Thông tin conversation (name, avatar, type)
     - Participants (id, username, displayName, avatar, status)
     - LastMessage (nếu có)
     - UnreadCount của user trong conversation đó
  3. Sắp xếp theo lastMessageAt DESC
  4. Phân trang (limit, offset)
```

**Prisma Query:**

```javascript
const conversations = await prisma.conversationUser.findMany({
  where: { userId },
  include: {
    conversation: {
      include: {
        participants: {
          select: { user: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    },
    unreadMessages: { where: { userId } }
  },
  orderBy: { conversation: { lastMessageAt: 'desc' } }
});
```

### 4.3 Response và FE xử lý

```json
{
  "success": true,
  "data": [
    {
      "id": "conv_001",
      "type": "direct",
      "name": null,
      "avatarUrl": null,
      "lastMessage": {
        "id": "msg_123",
        "content": "Hello!",
        "senderId": "user_456",
        "createdAt": "2026-05-24T10:00:00Z"
      },
      "participants": [
        { "id": "user_123", "username": "john", "displayName": "John", "avatarUrl": "...", "status": "online" }
      ],
      "unreadCount": 3,
      "isPinned": false,
      "isMuted": false,
      "lastMessageAt": "2026-05-24T10:00:00Z"
    }
  ]
}
```

**FE Store cập nhật:**

```javascript
// conversationStore.js
async fetchConversations() {
  const response = await conversationApi.getAll();
  set({ conversations: response.data, isLoading: false });
}
```

### 4.4 FE: Hiển thị danh sách

**File:** `src/pages/chat/ChatLayout.jsx`

```jsx
<div className="conversation-list">
  {conversations.map(conv => (
    <ConversationItem
      key={conv.id}
      conversation={conv}
      isActive={activeConversationId === conv.id}
      onClick={() => selectConversation(conv.id)}
    />
  ))}
</div>
```

**Component ConversationItem hiển thị:**

```jsx
// ConversationItem.jsx
<div className="flex items-center gap-3 p-3">
  {/* Avatar với indicator online */}
  <Avatar src={avatar} status={isOnline ? 'online' : 'offline'} />
  
  {/* Tên và tin nhắn cuối */}
  <div className="flex-1">
    <div className="flex justify-between">
      <span className="font-medium">{displayName}</span>
      <span className="text-xs text-gray-500">{formatTime(lastMessageAt)}</span>
    </div>
    <div className="text-sm text-gray-500 truncate">
      {lastMessage?.content || 'Chưa có tin nhắn'}
    </div>
  </div>
  
  {/* Badge unread */}
  {unreadCount > 0 && (
    <span className="bg-blue-500 text-white rounded-full px-2 py-0.5 text-xs">
      {unreadCount}
    </span>
  )}
</div>
```

---

## 5. Mở cuộc trò chuyện / Tải tin nhắn

### 5.1 FE: Join conversation room + Load messages

**File:** `src/pages/chat/ConversationPage.jsx`

```javascript
useEffect(() => {
  // 1. Join socket room
  socketService.joinConversation(conversationId);

  // 2. Load tin nhắn
  messageStore.fetchMessages(conversationId);

  // 3. Mark as read (nếu đang xem)
  socketService.markSeen(conversationId, lastReadMessageId);

  return () => {
    socketService.leaveConversation(conversationId);
  };
}, [conversationId]);
```

**Socket emit:**

```javascript
// Gửi lên server
socket.emit('join_conversation', { conversationId });
```

### 5.2 API: Xử lý join room

**File:** `src/socket/index.js`

```javascript
socket.on('join_conversation', ({ conversationId }) => {
  // Kiểm tra user có trong conversation không
  const participant = await prisma.conversationUser.findFirst({
    where: { conversationId, userId: socket.userId }
  });

  if (participant) {
    socket.join(`conversation:${conversationId}`);
  }
});
```

### 5.3 API: Load tin nhắn

**File:** `src/routes/conversation-message.routes.js`

```
GET /api/conversations/:id/messages
        ↓
Controller: messageController.getMessages
        ↓
Service: messageService.getMessages(conversationId, userId, query)
        ↓
Query:
  1. Kiểm tra user có quyền xem conversation
  2. Lấy messages với:
     - Sender info
     - ReplyTo message (nếu có)
     - MessageStatus của user hiện tại
  3. Phân trang theo cursor (before/after)
  4. Đánh dấu đã xem (markAsRead)
```

**Prisma Query:**

```javascript
const messages = await prisma.message.findMany({
  where: {
    conversationId,
    deletedBy: { not: { has: userId } }  // Không lấy tin đã xóa bởi user
  },
  include: {
    sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    replyTo: {
      include: { sender: { select: { id: true, username: true, displayName: true } } }
    },
    statuses: { where: { userId } }
  },
  orderBy: { createdAt: 'desc' },
  take: 50  // 50 tin nhắn mỗi lần load
});
```

### 5.4 Response và hiển thị

```json
{
  "success": true,
  "data": [
    {
      "id": "msg_123",
      "content": "Chào bạn!",
      "type": "text",
      "senderId": "user_456",
      "sender": {
        "id": "user_456",
        "username": "jane",
        "displayName": "Jane Doe",
        "avatarUrl": "https://..."
      },
      "replyTo": {
        "id": "msg_122",
        "content": "Cuộc họp lúc mấy giờ?",
        "sender": { "displayName": "John" }
      },
      "statuses": [{ "status": "seen", "seenAt": "2026-05-24T10:05:00Z" }],
      "createdAt": "2026-05-24T10:00:00Z",
      "updatedAt": "2026-05-24T10:00:00Z",
      "deletedBy": []
    }
  ]
}
```

**FE hiển thị tin nhắn:**

```jsx
// MessageList.jsx
<div className="flex-1 overflow-y-auto" ref={scrollRef}>
  {messages.map((msg, index) => {
    const isOwn = msg.senderId === currentUserId;
    const showAvatar = !isOwn && shouldShowAvatar(messages, index);
    
    return (
      <ChatBubble
        key={msg.id}
        message={msg}
        showAvatar={showAvatar}
        isOwn={isOwn}
        onReply={() => setReplyTo(msg)}
        onPin={() => pinMessage(msg.id)}
        onRecall={isOwn ? () => recallMessage(msg.id) : null}
      />
    );
  })}
</div>
```

**ChatBubble hiển thị:**

```jsx
// ChatBubble.jsx
<div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} gap-2`}>
  {!isOwn && showAvatar && (
    <Avatar src={sender.avatarUrl} size="sm" />
  )}
  
  <div className={`max-w-[70%] ${isOwn ? 'order-1' : ''}`}>
    {!isOwn && <span className="text-xs text-gray-500">{sender.displayName}</span>}
    
    {/* Nội dung tin nhắn */}
    {message.type === 'text' && (
      <div className="bg-gray-100 rounded-lg p-2">
        {message.content}
      </div>
    )}
    {message.type === 'image' && (
      <img src={message.content} className="rounded-lg max-w-full" />
    )}
    
    {/* Thời gian + trạng thái đã đọc */}
    <div className="flex items-center gap-1 text-xs text-gray-400">
      <span>{formatTime(message.createdAt)}</span>
      {isOwn && <MessageStatusIcon status={message.statuses[0]?.status} />}
    </div>
  </div>
</div>
```

---

## 6. Gửi tin nhắn văn bản

### 6.1 FE: User gõ tin nhắn và bấm gửi

**File:** `src/components/chat/ChatInput.jsx`

```javascript
const handleSend = async () => {
  if (!content.trim()) return;

  // 1. Emit lên socket ngay lập tức (optimistic update)
  const tempId = `temp_${Date.now()}`;
  const tempMessage = {
    id: tempId,
    content: content.trim(),
    type: 'text',
    senderId: currentUserId,
    sender: currentUser,
    conversationId,
    createdAt: new Date().toISOString(),
    statuses: [{ status: 'sent' }]
  };

  // Thêm vào UI ngay
  messageStore.addMessage(conversationId, tempMessage);

  // 2. Gửi qua socket
  socketService.sendMessage({
    conversationId,
    content: content.trim(),
    type: 'text',
    tempId
  });

  // 3. Clear input
  setContent('');
};
```

**Socket emit:**

```javascript
// socketService.js
sendMessage({ conversationId, content, type, tempId }) {
  this.socket.emit('send_message', {
    conversationId,
    content,
    type,
    tempId
  });
}
```

### 6.2 API: Xử lý gửi tin nhắn

**File:** `src/socket/handlers/message.handler.js`

```
Socket event: 'send_message'
        ↓
Handler: messageHandler.handleSendMessage(socket, data)
        ↓
Service: messageService.sendMessage(conversationId, senderId, content, type)
        ↓
1. Kiểm tra quyền (user có trong conversation không)
2. Tạo Message record trong DB
3. Cập nhật conversation.lastMessageAt
4. Cập nhật unread count cho các participant khác
5. Tạo MessageStatus cho sender (status: 'sent')
6. Trả về message object đầy đủ
        ↓
Broadcast:
  - Gửi cho tất cả participant trong conversation room
  - Gửi cho sender (xác nhận, update tempId → realId)
```

**Database operations:**

```javascript
// 1. Tạo message
const message = await prisma.message.create({
  data: {
    conversationId,
    senderId,
    content,
    type,
    statuses: {
      create: { userId: senderId, status: 'sent' }
    }
  },
  include: { sender: true, statuses: true }
});

// 2. Cập nhật conversation
await prisma.conversation.update({
  where: { id: conversationId },
  data: { lastMessageAt: new Date() }
});

// 3. Tăng unread cho participant khác
await prisma.unreadMessage.createMany({
  data: participants
    .filter(p => p.userId !== senderId)
    .map(p => ({ userId: p.userId, conversationId, count: 1 }))
});
```

### 6.3 Broadcast đến các client

```javascript
// Gửi cho tất cả trong conversation (trừ sender)
io.to(`conversation:${conversationId}`)
  .except(socket.id)  // Không gửi lại cho sender
  .emit('new_message', { message, conversationId });

// Gửi xác nhận cho sender
socket.emit('message_sent', {
  tempId: data.tempId,
  message: fullMessage
});
```

### 6.4 FE: Cập nhật UI khi nhận được

**File:** `src/contexts/SocketContext.jsx`

```javascript
socket.on('new_message', (data) => {
  const { message, conversationId } = data;

  // Thêm vào store
  messageStore.addMessage(conversationId, message);

  // Cập nhật lastMessage của conversation
  conversationStore.updateLastMessage(conversationId, message);

  // Nếu không phải conversation đang xem → tăng unread
  if (conversationId !== activeConversationId) {
    conversationStore.incrementUnread(conversationId);
  }

  // Play notification sound
  playNotificationSound();
});

socket.on('message_sent', ({ tempId, message }) => {
  // Thay thế temp message bằng real message
  messageStore.replaceMessage(message.conversationId, tempId, message);
});
```

---

## 7. Gửi file (hình ảnh, video, audio)

### 7.1 FE: Chọn file

**File:** `src/components/chat/ChatInput.jsx`

```javascript
const handleFileSelect = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('conversationId', conversationId);

  // Hiển thị preview (nếu là image/video)
  if (file.type.startsWith('image/')) {
    setUploadingFile({ type: 'image', preview: URL.createObjectURL(file) });
  }

  try {
    // Upload file
    const response = await uploadApi.uploadFile(formData);

    // Gửi message với file info
    socketService.sendMessage({
      conversationId,
      content: response.data.url,
      type: getMessageType(file.type),
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type
    });
  } catch (error) {
    showToast('Upload failed');
  }
};
```

### 7.2 API: Upload file

**File:** `src/routes/upload.routes.js`

```
POST /api/upload
Content-Type: multipart/form-data
        ↓
Middleware: authenticate
        ↓
Controller: uploadController.uploadFile
        ↓
1. Parse multipart với multer
2. Validate file type và size
3. Generate unique filename
4. Save to /DATA/images/ hoặc /DATA/video/
5. Trả về URL
```

**Multer config:**

```javascript
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.mimetype.startsWith('image/') ? 'images' : 'video';
    cb(null, path.join(__dirname, '../DATA', folder));
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${uuidv4()}`;
    cb(null, `${unique}${extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|webm|mp3|wav/;
    if (allowed.test(extname(file.originalname))) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});
```

### 7.3 Response upload

```json
{
  "success": true,
  "data": {
    "url": "/uploads/images/1779563389599-abc123.png",
    "filename": "1779563389599-abc123.png",
    "originalName": "my-photo.png",
    "mimeType": "image/png",
    "size": 102400
  }
}
```

---

## 8. Typing Indicator (trạng thái đang nhập)

### 8.1 FE: Bắt đầu typing

**File:** `src/components/chat/ChatInput.jsx`

```javascript
const handleTyping = () => {
  if (!isTyping) {
    socketService.startTyping(conversationId);
    setIsTyping(true);
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socketService.stopTyping(conversationId);
    setIsTyping(false);
  }, 2000);
};

// Debounce khi user ngừng gõ
const handleInput = (e) => {
  setContent(e.target.value);
  debouncedTyping();
};
```

**Socket emit:**

```javascript
socket.emit('typing_start', { conversationId });
```

### 8.2 API: Broadcast typing

**File:** `src/socket/handlers/message.handler.js`

```javascript
socket.on('typing_start', async ({ conversationId }) => {
  // Broadcast cho tất cả participant trong conversation
  socket.to(`conversation:${conversationId}`)
    .emit('user_typing', {
      conversationId,
      userId: socket.userId,
      username: socket.username
    });
});

socket.on('typing_stop', async ({ conversationId }) => {
  socket.to(`conversation:${conversationId}`)
    .emit('user_stop_typing', {
      conversationId,
      userId: socket.userId
    });
});
```

### 8.3 FE: Hiển thị typing

**File:** `src/contexts/SocketContext.jsx`

```javascript
socket.on('user_typing', ({ conversationId, userId, username }) => {
  messageStore.setTypingUser(conversationId, userId, username);

  // Auto remove sau 3 giây
  setTimeout(() => {
    messageStore.removeTypingUser(conversationId, userId);
  }, TYPING_TIMEOUT);
});

socket.on('user_stop_typing', ({ conversationId, userId }) => {
  messageStore.removeTypingUser(conversationId, userId);
});
```

**UI hiển thị:**

```jsx
// MessageList.jsx
<div className="typing-indicator">
  {typingUsers.length > 0 && (
    <span>
      {typingUsers.map(u => u.username).join(', ')}
      {typingUsers.length === 1 ? ' đang nhập...' : ' đang nhập...'}
      <span className="typing-dots">...</span>
    </span>
  )}
</div>
```

---

## 9. Đánh dấu đã đọc (Read Receipt)

### 9.1 FE: Khi mở conversation

**File:** `src/pages/chat/ConversationPage.jsx`

```javascript
useEffect(() => {
  // Khi scroll đến tin nhắn chưa đọc
  const lastUnreadMessage = messages.find(m => m.statuses[0]?.status !== 'seen');

  if (lastUnreadMessage) {
    socketService.markSeen(conversationId, lastUnreadMessage.id);
  }
}, [messages]);
```

### 9.2 Socket emit

```javascript
socket.emit('mark_read', { conversationId, messageId: lastUnreadId });
```

### 9.3 API: Xử lý mark read

**File:** `src/socket/handlers/message.handler.js`

```javascript
socket.on('mark_read', async ({ conversationId, messageId }) => {
  // 1. Update message status thành 'seen'
  await prisma.messageStatus.updateMany({
    where: { messageId, userId: socket.userId },
    data: { status: 'seen', seenAt: new Date() }
  });

  // 2. Reset unread count cho user
  await prisma.unreadMessage.update({
    where: { userId_conversationId: { userId: socket.userId, conversationId } },
    data: { count: 0 }
  });

  // 3. Broadcast cho sender của các message đã đọc
  io.to(`conversation:${conversationId}`)
    .emit('message_seen', {
      conversationId,
      userId: socket.userId,
      messageIds: [messageId]
    });
});
```

### 9.4 FE: Cập nhật trạng thái

```javascript
socket.on('message_seen', ({ conversationId, userId, messageIds }) => {
  messageStore.updateMessageStatus(conversationId, messageIds, 'seen');
});
```

---

## 10. Tạo cuộc trò chuyện mới

### 10.1 FE: Chọn người để chat

**File:** `src/pages/chat/NewConversationPage.jsx`

```javascript
const handleCreateConversation = async (selectedUsers) => {
  if (selectedUsers.length === 0) return;

  if (selectedUsers.length === 1) {
    // Direct conversation
    const response = await conversationApi.create({
      type: 'direct',
      participantIds: selectedUsers
    });
  } else {
    // Group conversation
    const response = await conversationApi.create({
      type: 'group',
      name: groupName,
      participantIds: selectedUsers
    });
  }

  // Redirect đến conversation mới
  navigate(`/chat/${response.data.id}`);
};
```

**Request:**

```json
POST /api/conversations
{
  "type": "direct",
  "participantIds": ["user_456"]
}
```

### 10.2 API: Tạo conversation

**File:** `src/services/conversation.service.js`

```javascript
async createConversation(userId, data) {
  const { type, name, avatarUrl, participantIds } = data;

  // 1. Tạo conversation
  const conversation = await prisma.conversation.create({
    data: {
      type,
      name: type === 'group' ? name : null,
      avatarUrl: type === 'group' ? avatarUrl : null,
      participants: {
        create: [
          { userId, role: 'owner' },
          ...participantIds.map(id => ({ userId: id, role: 'member' }))
        ]
      }
    },
    include: { participants: { include: { user: true } } }
  });

  // 2. Broadcast cho các participant đã online
  for (const p of conversation.participants) {
    socketService.sendToUser(p.userId, 'conversation_created', {
      conversation
    });
  }

  return conversation;
}
```

---

## 11. Cuộc gọi thoại / video (WebRTC)

### 11.1 FE: Initiate call

**File:** `src/components/chat/ConversationHeader.jsx`

```javascript
const handleCall = (type) => {
  callStore.initiateCall({
    calleeId: otherUser.id,
    calleeInfo: otherUser,
    callType: type  // 'audio' hoặc 'video'
  });

  socketService.emit('call_initiate', {
    calleeId: otherUser.id,
    callType: type
  });
};
```

### 11.2 API: Tạo call record

**File:** `src/socket/handlers/call.handler.js`

```javascript
socket.on('call_initiate', async ({ calleeId, callType }) => {
  // 1. Kiểm tra callee có đang bận không
  const busyCheck = await callService.checkBusy(calleeId);
  if (busyCheck.isBusy) {
    socket.emit('call_busy', { calleeId });
    return;
  }

  // 2. Tạo call record
  const call = await prisma.call.create({
    data: {
      callerId: socket.userId,
      calleeId,
      type: callType,
      status: 'pending',
      expiresAt: new Date(Date.now() + 2 * 60 * 1000) // 2 phút timeout
    }
  });

  // 3. Notify callee
  socketService.sendToUser(calleeId, 'incoming_call', {
    callId: call.id,
    callerId: socket.userId,
    callerInfo: callerUser,
    callType
  });

  // 4. Set timeout để mark missed
  setCallTimeout(call.id, 30000); // 30 giây
});
```

### 11.3 FE (Callee): Hiển thị incoming call modal

**File:** `src/contexts/SocketContext.jsx`

```javascript
socket.on('incoming_call', (data) => {
  callStore.setIncomingCall(data);
  // Hiện IncomingCallModal
});

socket.on('call_busy', ({ calleeId }) => {
  showToast('Người dùng đang bận cuộc gọi khác');
  callStore.callEnded();
});
```

### 11.4 Callee: Accept call

```javascript
socket.emit('call_accept', { callId });
```

### 11.5 API: Accept và setup WebRTC signaling

```javascript
socket.on('call_accept', async ({ callId }) => {
  // 1. Update call status
  await prisma.call.update({
    where: { id: callId },
    data: { status: 'accepted' }
  });

  // 2. Notify caller
  socketService.sendToUser(callerId, 'call_accepted', { callId });

  // 3. Join call room
  socket.join(`call:${callId}`);
});
```

### 11.6 WebRTC Signaling

```
Caller                          Server                         Callee
   |                               |                              |
   |──── call_offer (SDP) ────────►│──── call_offer_received ──►│
   │                               │                              │
   │◄─── call_answer (SDP) ◄────────│◄── call_answer_received ◄──│
   │                               │                              │
   │◄─── ICE candidates ◄──────────│◄── ICE candidates ◄────────►│
   │                               │                              │
   └──── Direct P2P Connection ────────────────────────────────────┘
```

### 11.7 End call

```javascript
socket.emit('call_end', { callId });

// Server broadcast
io.to(`call:${callId}`).emit('call_ended', { callId });

// Update DB
await prisma.call.update({
  where: { id: callId },
  data: {
    status: 'ended',
    endedAt: new Date(),
    duration: Math.floor((Date.now() - startedAt) / 1000)
  }
});
```

---

## 12. Ghim / Bỏ ghim tin nhắn

### 12.1 FE: Pin message

```javascript
const handlePinMessage = async (messageId) => {
  await pinnedApi.create(conversationId, {
    messageId,
    title: 'Pinned message',
    description: ''
  });

  showToast('Đã ghim tin nhắn');
};
```

**Request:**

```
POST /api/conversations/:id/pinned
{ "messageId": "msg_123", "title": "..." }
```

### 12.2 API: Pin message

```javascript
// conversation.service.js
async pinMessage(conversationId, userId, data) {
  const pinned = await prisma.pinnedDocument.create({
    data: {
      conversationId,
      messageId: data.messageId,
      title: data.title,
      description: data.description,
      pinnedBy: userId
    },
    include: {
      message: { include: { sender: true } },
      pinnedByUser: { select: { id: true, displayName: true } }
    }
  });

  // Broadcast
  io.to(`conversation:${conversationId}`)
    .emit('message_pinned', { conversationId, pinned });

  return pinned;
}
```

### 12.3 Xem danh sách pinned

```javascript
// GET /api/conversations/:id/pinned
const pinnedDocs = await prisma.pinnedDocument.findMany({
  where: { conversationId },
  include: {
    message: true,
    pinnedByUser: { select: { displayName: true } }
  },
  orderBy: { createdAt: 'desc' }
});
```

---

## 13. Chỉnh sửa / Thu hồi tin nhắn

### 13.1 Chỉnh sửa tin nhắn (15 phút)

**FE:**

```javascript
const handleEdit = async (messageId, newContent) => {
  await messageApi.update(messageId, { content: newContent });
};

// Request: PUT /api/messages/:id
// Body: { "content": "Nội dung mới" }
```

**API:**

```javascript
// message.service.js
async editMessage(messageId, userId, content) {
  // 1. Kiểm tra 15 phút
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  const diffMinutes = (Date.now() - message.createdAt) / 60000;
  if (diffMinutes > 15) throw new ValidationError('Hết thời gian chỉnh sửa');

  // 2. Update
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content, updatedAt: new Date() }
  });

  // 3. Broadcast
  io.to(`conversation:${message.conversationId}`)
    .emit('message_updated', { conversationId: message.conversationId, message: updated });
}
```

### 13.2 Thu hồi tin nhắn (24 giờ)

**FE:**

```javascript
const handleRecall = async (messageId) => {
  await messageApi.recall(messageId);
  messageStore.recallMessage(conversationId, messageId);
};

// Request: POST /api/messages/:id/recall
```

**API:**

```javascript
async recallMessage(messageId, userId) {
  // 1. Kiểm tra 24 giờ
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  const diffHours = (Date.now() - message.createdAt) / 3600000;
  if (diffHours > 24) throw new ValidationError('Hết thời gian thu hồi');

  // 2. Delete message (hard delete)
  await prisma.message.delete({ where: { id: messageId } });

  // 3. Broadcast
  io.to(`conversation:${message.conversationId}`)
    .emit('message_recalled', { conversationId: message.conversationId, messageId });
}
```

**FE xử lý recall:**

```javascript
socket.on('message_recalled', ({ conversationId, messageId }) => {
  messageStore.recallMessage(conversationId, messageId);
});
```

---

## 14. Tìm kiếm tin nhắn

### 14.1 FE: Search

```javascript
const handleSearch = debounce((query) => {
  if (!query.trim()) {
    setSearchResults([]);
    return;
  }

  messageApi.search(conversationId, { q: query }).then(res => {
    setSearchResults(res.data);
  });
}, 500);
```

**Request:**

```
GET /api/conversations/:id/messages/search?q=keyword
```

### 14.2 API: Search messages

```javascript
// message.service.js
async searchMessages(conversationId, userId, query) {
  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      content: { contains: query, mode: 'insensitive' },
      deletedBy: { not: { has: userId } }
    },
    include: { sender: true },
    take: 20,
    orderBy: { createdAt: 'desc' }
  });

  return messages;
}
```

---

## 15. Đăng xuất (Logout)

### 15.1 FE: User bấm đăng xuất

**File:** `src/stores/authStore.js`

```javascript
async logout() {
  try {
    // 1. Gọi API logout (optional - để server invalidate session)
    await authApi.logout();

    // 2. Disconnect socket
    socketService.disconnect();

    // 3. Clear local storage
    localStorage.removeItem(ACCESS_TOKEN);
    localStorage.removeItem(REFRESH_TOKEN);
    localStorage.removeItem(USER_DATA);

    // 4. Clear stores
    set({ user: null, isAuthenticated: false });
    conversationStore.reset();
    messageStore.reset();

    // 5. Navigate to login
    navigate('/login');
  } catch (error) {
    console.error('Logout error:', error);
  }
}
```

### 15.2 API: Xử lý logout

**File:** `src/controllers/auth.controller.js`

```javascript
async logout(req, res, next) {
  try {
    const userId = req.userId;

    // 1. Update user status
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'offline' }
    });

    // 2. Invalidate session (soft delete)
    const sessionId = req.sessionId; // từ middleware
    await prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false, expiredAt: new Date() }
    });

    // 3. Broadcast offline status
    io.emit('user_offline', { userId });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}
```

### 15.3 Socket cleanup

```javascript
// Khi socket disconnect
io.on('disconnect', async (socket) => {
  // 1. Kiểm tra user còn socket nào không
  const remainingSockets = socketService.getUserSockets(socket.userId);

  if (remainingSockets.length === 0) {
    // 2. Update status thành offline
    await prisma.user.update({
      where: { id: socket.userId },
      data: { status: 'offline' }
    });

    // 3. Broadcast
    io.emit('user_offline', { userId: socket.userId });
  }

  // 4. Remove socket tracking
  socketService.untrackSocket(socket.userId, socket.id);
});
```

---

## 16. Làm mới Access Token (Token Refresh)

### 16.1 Khi nào cần refresh?

- Access token hết hạn (15 phút)
- API trả về HTTP 401 Unauthorized

### 16.2 FE: Auto refresh

**File:** `src/api/axiosClient.js`

```javascript
// Request interceptor - attach token
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN);
        const response = await authApi.refresh({ refreshToken });

        // Lưu token mới
        localStorage.setItem(ACCESS_TOKEN, response.data.accessToken);

        // Retry request
        originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
        return axiosClient(originalRequest);

      } catch (refreshError) {
        // Refresh thất bại → logout
        localStorage.clear();
        window.location.href = '/login?session=expired';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

### 16.3 AuthContext schedule refresh

```javascript
// AuthContext.jsx
scheduleTokenRefresh(accessToken) {
  const payload = jwtDecode(accessToken);
  const expiresAt = payload.exp * 1000;
  const refreshTime = expiresAt - 5 * 60 * 1000; // 5 phút trước

  const timeoutId = setTimeout(() => {
    this.refreshSession();
  }, refreshTime);

  this.refreshTimeoutId = timeoutId;
}
```

### 16.4 API: Refresh token

```
POST /api/auth/refresh
Body: { "refreshToken": "..." }
        ↓
Verify refreshToken
        ↓
Tạo accessToken mới
        ↓
Response: { "accessToken": "..." }
```

---

## 17. Xử lý lỗi & Mất kết nối

### 17.1 Socket reconnection

**File:** `src/services/socketService.js`

```javascript
class SocketService {
  connect(token) {
    this.socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');

      // Re-join các conversation rooms
      this.rejoinRooms();

      // Re-fetch data nếu cần
      conversationStore.fetchConversations();
    });

    this.socket.on('reconnect_failed', () => {
      showToast('Mất kết nối. Vui lòng đăng nhập lại.');
      authStore.logout();
    });
  }
}
```

### 17.2 Error handling middleware

**File:** `src/middleware/error.middleware.js`

```javascript
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Các loại lỗi
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message }
    });
  }

  if (err.name === 'AuthenticationError') {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập' }
    });
  }

  if (err.name === 'NotFoundError') {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: err.message }
    });
  }

  // Lỗi Prisma
  if (err.code === 'P2002') { // Unique constraint
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'Dữ liệu đã tồn tại' }
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Lỗi server' }
  });
};
```

---

## Tổng kết luồng dữ liệu

```
┌─────────────────────────────────────────────────────────────────┐
│                     NGƯỜI DÙNG TƯƠNG TÁC                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│                                                                 │
│  1. User Action (click, type, submit)                           │
│                              │                                  │
│  2. Component/Context xử lý                                    │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │
│  │   Zustand   │    │  axiosClient │    │   Socket    │       │
│  │   Stores    │    │  (HTTP API)  │    │   Service   │       │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘       │
│         │                  │                   │               │
│         │      ┌───────────┴───────────┐      │               │
│         │      │                       │      │               │
│         ▼      ▼                       ▼      ▼               │
│  ┌──────────────────────────────────────────────────┐        │
│  │              React Components (re-render)          │        │
│  └──────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
           │                    │                    │
           │ REST API           │ WebSocket          │
           ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND (Node.js)                       │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐  │
│  │  Middleware  │    │   Routers    │    │  Socket Handlers│  │
│  │  - Auth      │    │  - /api/auth │    │  - message      │  │
│  │  - CORS      │    │  - /api/conv │    │  - call         │  │
│  │  - Error     │    │  - /api/msg  │    │  - presence     │  │
│  └──────────────┘    └──────┬───────┘    └────────┬────────┘  │
│                             │                       │            │
│                             ▼                       │            │
│                    ┌─────────────────┐             │            │
│                    │    Services     │◄────────────┘            │
│                    │  - authService  │                          │
│                    │  - convService  │                          │
│                    │  - msgService   │                          │
│                    │  - callService  │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│                             ▼                                   │
│                    ┌─────────────────┐                          │
│                    │  Prisma ORM     │                          │
│                    │       ↓         │                          │
│                    │   MySQL DB      │                          │
│                    └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
           │                    │
           │ REST Response       │ WebSocket Event
           ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND NHẬN RESPONSE                       │
│                                                                 │
│  1. Axios interceptor nhận response                            │
│  2. Update Zustand stores                                       │
│  3. React components re-render với data mới                     │
│  4. UI cập nhật hiển thị                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Bảng tóm tắt các API endpoints

| Method | Endpoint | Mô tả | Socket Event |
|--------|----------|-------|--------------|
| POST | `/api/auth/login` | Đăng nhập | - |
| POST | `/api/auth/logout` | Đăng xuất | `user_offline` |
| POST | `/api/auth/refresh` | Refresh token | - |
| GET | `/api/auth/me` | Lấy thông tin user | - |
| GET | `/api/conversations` | Danh sách cuộc trò chuyện | - |
| POST | `/api/conversations` | Tạo cuộc trò chuyện | `conversation_created` |
| GET | `/api/conversations/:id` | Chi tiết cuộc trò chuyện | - |
| GET | `/api/conversations/:id/messages` | Tin nhắn | - |
| POST | `/api/conversations/:id/messages` | Gửi tin nhắn | `new_message` |
| POST | `/api/upload` | Upload file | - |
| PUT | `/api/messages/:id` | Chỉnh sửa tin nhắn | `message_updated` |
| POST | `/api/messages/:id/recall` | Thu hồi tin nhắn | `message_recalled` |
| - | - | Typing indicator | `typing_start/stop` |
| - | - | Mark read | `message_seen` |
| - | - | Initiate call | `incoming_call` |
| - | - | Accept/End call | `call_accepted/ended` |
| - | - | WebRTC signaling | `call_offer/answer/ice_candidate` |

---

*Document này mô tả chi tiết luồng hoạt động của ứng dụng chat từ khi đăng nhập đến khi đăng xuất, bao gồm cả REST API calls và Socket.IO real-time events.*
