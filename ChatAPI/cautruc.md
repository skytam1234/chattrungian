# ChatAPI - Tài Liệu API Endpoints

> **Base URL:** `http://localhost:3000/api`
> 
> **Authentication:** Bearer Token (JWT) trong header `Authorization: Bearer <accessToken>`

---

## Mục Lục

1. [Auth API](#1-auth-api)
2. [User API](#2-user-api)
3. [Conversation API](#3-conversation-api)
4. [Message API](#4-message-api)
5. [Upload API](#5-upload-api)
6. [Socket.IO Events](#6-socketio-events)

---

## 1. AUTH API

### 1.1 Đăng ký tài khoản

**POST** `/api/auth/register`

**Công dụng:** Tạo tài khoản người dùng mới

**Request Body:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---------|------|----------|-------|
| `username` | string | Có | Tên đăng nhập (3-30 ký tự, chỉ chứa chữ cái, số và dấu gạch dưới) |
| `email` | string | Có | Địa chỉ email (phải hợp lệ) |
| `password` | string | Có | Mật khẩu (8-100 ký tự) |
| `displayName` | string | Có | Tên hiển thị (1-100 ký tự) |
| `phoneNumber` | string | Không | Số điện thoại |

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "email": "john@example.com",
      "displayName": "John Doe",
      "avatarUrl": null,
      "status": "offline",
      "isVerified": true,
      "createdAt": "2026-05-24T12:00:00.000Z"
    }
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

**Lỗi có thể:**
- `409 Conflict` - Email hoặc username đã tồn tại
- `400 Bad Request` - Validation error

---

### 1.2 Đăng nhập

**POST** `/api/auth/login`

**Công dụng:** Đăng nhập và nhận access/refresh tokens

**Request Body:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---------|------|----------|-------|
| `email` | string | Có | Email đã đăng ký |
| `password` | string | Có | Mật khẩu |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "email": "john@example.com",
      "displayName": "John Doe",
      "avatarUrl": null,
      "status": "online",
      "isVerified": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

**Lỗi có thể:**
- `401 Unauthorized` - Email hoặc mật khẩu không đúng
- `403 Forbidden` - Tài khoản bị vô hiệu hóa

---

### 1.3 Làm mới token

**POST** `/api/auth/refresh`

**Công dụng:** Lấy access token mới từ refresh token

**Request Body:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---------|------|----------|-------|
| `refreshToken` | string | Có | Refresh token đã nhận được từ đăng nhập |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 1.4 Lấy thông tin user hiện tại

**GET** `/api/auth/me`

**Công dụng:** Lấy thông tin tài khoản đang đăng nhập

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "displayName": "John Doe",
    "avatarUrl": "http://localhost:3000/uploads/avatar/xxx.png",
    "phoneNumber": "0123456789",
    "status": "online",
    "lastSeenAt": "2026-05-24T12:00:00.000Z",
    "isVerified": true,
    "createdAt": "2026-05-24T10:00:00.000Z"
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 1.5 Đăng xuất

**POST** `/api/auth/logout`

**Công dụng:** Đăng xuất và vô hiệu hóa session hiện tại

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Logout successful",
  "data": null,
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 1.6 Quên mật khẩu

**POST** `/api/auth/forgot-password`

**Công dụng:** Gửi yêu cầu reset mật khẩu (trong môi trường dev, token sẽ được log ra console)

**Request Body:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---------|------|----------|-------|
| `email` | string | Có | Email đã đăng ký |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "If email exists, reset link has been sent",
  "data": {
    "message": "If email exists, reset link has been sent"
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 1.7 Reset mật khẩu

**POST** `/api/auth/reset-password`

**Công dụng:** Đặt lại mật khẩu mới bằng token

**Request Body:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---------|------|----------|-------|
| `token` | string | Có | Token reset password (có hiệu lực 1 giờ) |
| `password` | string | Có | Mật khẩu mới (8-100 ký tự) |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Password reset successful",
  "data": {
    "message": "Password reset successful"
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

## 2. USER API

> **Tất cả endpoints đều yêu cầu authentication**

### 2.1 Lấy profile user hiện tại

**GET** `/api/users/profile`

**Công dụng:** Lấy thông tin profile của user đang đăng nhập

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "displayName": "John Doe",
    "avatarUrl": "http://localhost:3000/uploads/avatar/xxx.png",
    "phoneNumber": "0123456789",
    "status": "online",
    "isVerified": true,
    "updatedAt": "2026-05-24T11:00:00.000Z"
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 2.2 Cập nhật profile

**PUT** `/api/users/profile`

**Công dụng:** Cập nhật thông tin cá nhân

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---------|------|----------|-------|
| `displayName` | string | Không | Tên hiển thị mới |
| `avatarUrl` | string | Không | URL avatar mới |
| `phoneNumber` | string | Không | Số điện thoại mới |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Profile updated",
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "displayName": "John Updated",
    "avatarUrl": "http://localhost:3000/uploads/avatar/yyy.png",
    "phoneNumber": "0987654321",
    "status": "online",
    "isVerified": true,
    "updatedAt": "2026-05-24T12:00:00.000Z"
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 2.3 Lấy thông tin user theo ID

**GET** `/api/users/:id`

**Công dụng:** Lấy thông tin công khai của một user khác

**Headers:** `Authorization: Bearer <accessToken>`

**Path Parameters:**

| Tham số | Kiểu | Mô tả |
|---------|------|-------|
| `id` | UUID | User ID cần lấy thông tin |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "uuid",
    "username": "janedoe",
    "displayName": "Jane Doe",
    "avatarUrl": "http://localhost:3000/uploads/avatar/zzz.png",
    "status": "online",
    "lastSeenAt": "2026-05-24T12:00:00.000Z",
    "isVerified": true
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

**Lỗi có thể:**
- `404 Not Found` - User không tồn tại

---

### 2.4 Tìm kiếm users

**GET** `/api/users?search=term&page=1&limit=20`

**Công dụng:** Tìm kiếm users theo username, displayName hoặc email

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:**

| Tham số | Kiểu | Mặc định | Mô tả |
|---------|------|----------|-------|
| `search` | string | - | Từ khóa tìm kiếm |
| `page` | number | 1 | Số trang |
| `limit` | number | 20 | Số lượng kết quả mỗi trang (tối đa 100) |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "uuid",
      "username": "janedoe",
      "displayName": "Jane Doe",
      "avatarUrl": "http://localhost:3000/uploads/avatar/zzz.png",
      "status": "online",
      "lastSeenAt": "2026-05-24T12:00:00.000Z",
      "isVerified": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

## 3. CONVERSATION API

> **Tất cả endpoints đều yêu cầu authentication**

### 3.1 Lấy danh sách cuộc trò chuyện

**GET** `/api/conversations?page=1&limit=20&search=term`

**Công dụng:** Lấy danh sách tất cả cuộc trò chuyện của user

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:**

| Tham số | Kiểu | Mặc định | Mô tả |
|---------|------|----------|-------|
| `page` | number | 1 | Số trang |
| `limit` | number | 20 | Số lượng kết quả mỗi trang |
| `search` | string | - | Tìm kiếm theo tên nhóm hoặc tên thành viên |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "uuid",
      "type": "direct",
      "name": null,
      "avatarUrl": null,
      "description": null,
      "isArchived": false,
      "currentUserRole": "member",
      "lastMessage": {
        "id": "msg-uuid",
        "content": "Xin chào!",
        "senderId": "uuid",
        "messageType": "text",
        "createdAt": "2026-05-24T12:00:00.000Z",
        "sender": {
          "id": "uuid",
          "displayName": "Jane Doe",
          "avatarUrl": "http://localhost:3000/uploads/avatar/zzz.png"
        }
      },
      "unreadCount": 2,
      "lastUnreadAt": "2026-05-24T11:55:00.000Z",
      "participants": [
        {
          "id": "uuid",
          "username": "johndoe",
          "displayName": "John Doe",
          "avatarUrl": "http://localhost:3000/uploads/avatar/xxx.png",
          "status": "online",
          "role": "member",
          "nickname": null,
          "isMuted": false,
          "isPinned": false,
          "notifications": "all",
          "isOnline": true
        }
      ],
      "createdAt": "2026-05-24T10:00:00.000Z",
      "updatedAt": "2026-05-24T12:00:00.000Z",
      "lastMessageAt": "2026-05-24T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1,
    "hasMore": false
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 3.2 Lấy chi tiết cuộc trò chuyện

**GET** `/api/conversations/:id`

**Công dụng:** Lấy thông tin chi tiết của một cuộc trò chuyện

**Headers:** `Authorization: Bearer <accessToken>`

**Path Parameters:**

| Tham số | Kiểu | Mô tả |
|---------|------|-------|
| `id` | UUID | Conversation ID |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "uuid",
    "type": "group",
    "name": "Nhóm Test",
    "avatarUrl": "http://localhost:3000/uploads/conversations/xxx.png",
    "description": "Mô tả nhóm",
    "currentUserRole": "admin",
    "participants": [
      {
        "id": "uuid",
        "username": "johndoe",
        "displayName": "John Doe",
        "avatarUrl": "http://localhost:3000/uploads/avatar/xxx.png",
        "status": "online",
        "role": "admin",
        "nickname": null,
        "isMuted": false,
        "isPinned": false,
        "notifications": "all",
        "isOnline": true
      }
    ],
    "unreadCount": 0,
    "createdAt": "2026-05-24T10:00:00.000Z",
    "updatedAt": "2026-05-24T12:00:00.000Z"
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

**Lỗi có thể:**
- `404 Not Found` - Cuộc trò chuyện không tồn tại hoặc không có quyền truy cập

---

### 3.3 Tạo cuộc trò chuyện

**POST** `/api/conversations`

**Công dụng:** Tạo cuộc trò chuyện mới (direct hoặc group)

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body (Direct Conversation):**

```json
{
  "type": "direct",
  "targetUserId": "uuid-của-user-kia"
}
```

**Request Body (Group Conversation):**

```json
{
  "type": "group",
  "name": "Tên nhóm",
  "description": "Mô tả nhóm (tùy chọn)",
  "participantIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---------|------|----------|-------|
| `type` | enum | Có | `"direct"` hoặc `"group"` |
| `targetUserId` | UUID | Có (direct) | ID của user cần chat riêng |
| `name` | string | Có (group) | Tên nhóm (tối đa 100 ký tự) |
| `description` | string | Không | Mô tả nhóm |
| `participantIds` | UUID[] | Có (group) | Danh sách ID của các thành viên (không bao gồm creator) |

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Conversation created",
  "data": {
    "id": "uuid",
    "type": "group",
    "name": "Nhóm Test",
    "avatarUrl": null,
    "description": "Mô tả nhóm",
    "currentUserRole": "owner",
    "participants": [...],
    "createdAt": "2026-05-24T12:00:00.000Z",
    "updatedAt": "2026-05-24T12:00:00.000Z"
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

**Lưu ý:**
- Nếu tạo direct conversation với user đã có cuộc trò chuyện, sẽ trả về cuộc trò chuyện cũ
- Group conversation yêu cầu ít nhất 1 participant (ngoài creator)

---

### 3.4 Cập nhật cuộc trò chuyện

**PUT** `/api/conversations/:id`

**Công dụng:** Cập nhật thông tin nhóm (chỉ admin/owner)

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**

| Tham số | Kiểu | Mô tả |
|---------|------|-------|
| `name` | string | Tên nhóm mới |
| `description` | string | Mô tả mới |
| `avatarUrl` | string \| null | URL avatar mới (null để xóa) |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Conversation updated",
  "data": { ... },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

**Lỗi có thể:**
- `403 Forbidden` - Không có quyền (chỉ admin/owner mới được)

---

### 3.5 Xóa/Rời cuộc trò chuyện

**DELETE** `/api/conversations/:id`

**Công dụng:** Xóa cuộc trò chuyện (owner) hoặc rời khỏi nhóm (member)

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Conversation deleted/left successfully",
  "data": { "message": "Conversation deleted/left successfully" },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 3.6 Thêm thành viên vào nhóm

**POST** `/api/conversations/:id/participants`

**Công dụng:** Thêm một hoặc nhiều users vào nhóm (chỉ admin/owner)

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**

```json
{
  "userIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---------|------|----------|-------|
| `userIds` | UUID[] | Có | Danh sách ID của users cần thêm (tối thiểu 1) |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Participants added successfully",
  "data": { "message": "Participants added successfully" },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 3.7 Xóa thành viên khỏi nhóm

**DELETE** `/api/conversations/:id/participants/:userId`

**Công dụng:** Xóa một thành viên khỏi nhóm (chỉ admin/owner hoặc tự xóa chính mình)

**Headers:** `Authorization: Bearer <accessToken>`

**Path Parameters:**

| Tham số | Kiểu | Mô tả |
|---------|------|-------|
| `id` | UUID | Conversation ID |
| `userId` | UUID | User ID của thành viên cần xóa |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Participant removed successfully",
  "data": { "message": "Participant removed successfully" },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

**Lưu ý:** Không thể xóa owner khỏi nhóm

---

### 3.8 Ghim/Bỏ ghim cuộc trò chuyện

**POST** `/api/conversations/:id/pin`

**Công dụng:** Toggle trạng thái ghim của cuộc trò chuyện

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "isPinned": true
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 3.9 Bật/Tắt thông báo cuộc trò chuyện

**POST** `/api/conversations/:id/mute`

**Công dụng:** Toggle trạng thái mute (bật/tắt thông báo)

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "isMuted": true
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 3.10 Lấy danh sách thành viên

**GET** `/api/conversations/:id/members`

**Công dụng:** Lấy danh sách tất cả thành viên trong cuộc trò chuyện

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "role": "owner",
      "nickname": null,
      "isMuted": false,
      "isPinned": false,
      "notifications": "all",
      "joinedAt": "2026-05-24T10:00:00.000Z",
      "leftAt": null,
      "user": {
        "id": "uuid",
        "username": "johndoe",
        "displayName": "John Doe",
        "avatarUrl": "http://localhost:3000/uploads/avatar/xxx.png",
        "status": "online"
      }
    }
  ],
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 3.11 Rời khỏi cuộc trò chuyện

**POST** `/api/conversations/:id/leave`

**Công dụng:** Rời khỏi cuộc trò chuyện (không phải xóa)

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Đã rời khỏi cuộc trò chuyện",
  "data": { "message": "Đã rời khỏi cuộc trò chuyện" },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

**Lưu ý:** Owner không thể rời nhóm, phải chuyển quyền trước

---

## 4. MESSAGE API

### 4.1 Lấy tin nhắn trong cuộc trò chuyện

**GET** `/api/conversations/:id/messages?page=1&limit=50&before=timestamp`

**Công dụng:** Lấy danh sách tin nhắn của một cuộc trò chuyện (phân trang)

**Headers:** `Authorization: Bearer <accessToken>`

**Path Parameters:**

| Tham số | Kiểu | Mô tả |
|---------|------|-------|
| `id` | UUID | Conversation ID |

**Query Parameters:**

| Tham số | Kiểu | Mặc định | Mô tả |
|---------|------|----------|-------|
| `page` | number | 1 | Số trang |
| `limit` | number | 50 | Số lượng tin nhắn mỗi trang (tối đa 100) |
| `before` | ISO date | - | Lấy tin nhắn trước thời điểm này (dùng để load more) |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "msg-uuid",
      "content": "Nội dung tin nhắn",
      "messageType": "text",
      "metadata": {},
      "isEdited": false,
      "isRecalled": false,
      "isDeleted": false,
      "replyTo": {
        "id": "reply-msg-uuid",
        "content": "Tin nhắn được trả lời",
        "senderId": "uuid",
        "messageType": "text",
        "senderName": "Jane Doe"
      },
      "sender": {
        "id": "uuid",
        "username": "johndoe",
        "displayName": "John Doe",
        "avatarUrl": "http://localhost:3000/uploads/avatar/xxx.png",
        "status": "online"
      },
      "status": "seen",
      "seenAt": "2026-05-24T12:05:00.000Z",
      "deliveredAt": "2026-05-24T12:04:00.000Z",
      "createdAt": "2026-05-24T12:03:00.000Z",
      "updatedAt": "2026-05-24T12:03:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2,
    "hasMore": true
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

**Trạng thái tin nhắn (`status`):**
- `sent` - Đã gửi
- `delivered` - Đã nhận
- `seen` - Đã xem

---

### 4.2 Gửi tin nhắn

**POST** `/api/conversations/:id/messages`

**Công dụng:** Gửi tin nhắn mới

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**

```json
{
  "content": "Nội dung tin nhắn",
  "messageType": "text",
  "metadata": {},
  "replyToId": "uuid-của-tin-nhắn-cần-trả-lời",
  "tempId": "temp-id-cho-optimistic-update"
}
```

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---------|------|----------|-------|
| `content` | string | Không | Nội dung tin nhắn (bắt buộc nếu messageType là text) |
| `messageType` | enum | Không | Loại tin nhắn: `text`, `image`, `file`, `video`, `audio`, `sticker`, `system`. Mặc định: `text` |
| `metadata` | object | Không | Metadata bổ sung (dùng cho file, image, video...) |
| `replyToId` | UUID | Không | ID của tin nhắn cần trả lời |
| `tempId` | string | Không | ID tạm thời cho optimistic update phía client |

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Message sent",
  "data": {
    "id": "msg-uuid",
    "content": "Nội dung tin nhắn",
    "messageType": "text",
    "metadata": {},
    "replyToId": null,
    "senderId": "current-user-uuid",
    "conversationId": "conv-uuid",
    "isRecalled": false,
    "isEdited": false,
    "sender": {
      "id": "uuid",
      "username": "johndoe",
      "displayName": "John Doe",
      "avatarUrl": "..."
    },
    "replyTo": null,
    "createdAt": "2026-05-24T12:00:00.000Z",
    "updatedAt": "2026-05-24T12:00:00.000Z"
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 4.3 Gửi file đính kèm

**POST** `/api/conversations/:id/messages/file`

**Công dụng:** Upload file và gửi dưới dạng tin nhắn (multipart/form-data)

**Headers:** `Authorization: Bearer <accessToken>`

**Form Data:**

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `file` | File | File cần upload |
| `content` | string | Nội dung tin nhắn đi kèm (tùy chọn) |

**Response (201 Created):**

```json
{
  "success": true,
  "message": "File message sent",
  "data": {
    "id": "msg-uuid",
    "content": null,
    "messageType": "image",
    "metadata": {
      "url": "/uploads/messages/xxx.png",
      "filename": "xxx.png",
      "originalName": "photo.png",
      "mimetype": "image/png",
      "size": 12345
    },
    "sender": { ... },
    "createdAt": "2026-05-24T12:00:00.000Z"
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

**Loại file được tự động nhận diện:**
- `image/*` → `image`
- `audio/*` → `audio`
- `video/*` → `video`
- Các loại khác → `file`

---

### 4.4 Chỉnh sửa tin nhắn

**PUT** `/api/messages/:id`

**Công dụng:** Chỉnh sửa nội dung tin nhắn (chỉ sender mới được, trong vòng 15 phút)

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**

```json
{
  "content": "Nội dung đã chỉnh sửa"
}
```

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---------|------|----------|-------|
| `content` | string | Có | Nội dung mới (không được rỗng) |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Message updated",
  "data": {
    "id": "msg-uuid",
    "content": "Nội dung đã chỉnh sửa",
    "messageType": "text",
    "isEdited": true,
    ...
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

**Lỗi có thể:**
- `400 Bad Request` - Chỉ tin nhắn text mới được sửa
- `400 Bad Request` - Tin nhắn đã quá 15 phút
- `403 Forbidden` - Không phải người gửi

---

### 4.5 Xóa tin nhắn

**DELETE** `/api/messages/:id`

**Công dụng:** Xóa tin nhắn (chỉ sender, chỉ ẩn với người xóa)

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Message deleted for you",
  "data": { "message": "Message deleted for you" },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 4.6 Thu hồi tin nhắn

**POST** `/api/messages/:id/recall`

**Công dụng:** Thu hồi tin nhắn (chỉ sender, trong vòng 24 giờ, xóa vĩnh viễn)

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Message recalled and deleted",
  "data": { "message": "Message recalled and deleted" },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

**Lỗi có thể:**
- `400 Bad Request` - Tin nhắn đã quá 24 giờ
- `403 Forbidden` - Không phải người gửi

---

### 4.7 Đánh dấu đã đọc

**POST** `/api/messages/read`

**Công dụng:** Đánh dấu tất cả tin nhắn trong cuộc trò chuyện là đã đọc

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**

```json
{
  "conversationId": "uuid-cua-cuoc-tro-chuyen",
  "messageId": "uuid-cua-tin-nhan-gan-nhat"
}
```

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---------|------|----------|-------|
| `conversationId` | UUID | Có | ID cuộc trò chuyện |
| `messageId` | UUID | Không | ID tin nhắn cụ thể cần đánh dấu đã đọc đến |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "marked": 5,
    "lastReadMessageId": "msg-uuid"
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 4.8 Tìm kiếm tin nhắn

**GET** `/api/conversations/:id/messages/search?q=keyword&page=1&limit=20`

**Công dụng:** Tìm kiếm tin nhắn trong cuộc trò chuyện

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:**

| Tham số | Kiểu | Mặc định | Mô tả |
|---------|------|----------|-------|
| `q` | string | - | Từ khóa tìm kiếm (bắt buộc) |
| `page` | number | 1 | Số trang |
| `limit` | number | 20 | Số kết quả mỗi trang |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1,
    "hasMore": false
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 4.9 Lấy file đính kèm

**GET** `/api/messages/:id/file-info`

**Công dụng:** Lấy thông tin file gốc từ tin nhắn (tên file, kích thước...)

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "messageId": "msg-uuid",
    "messageType": "file",
    "originalName": "document.pdf",
    "filename": "xxx.pdf",
    "url": "/uploads/messages/xxx.pdf",
    "size": 123456
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 4.10 Lấy danh sách ảnh

**GET** `/api/conversations/:id/images?page=1&limit=50`

**Công dụng:** Lấy tất cả ảnh trong cuộc trò chuyện

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "msg-uuid",
      "content": null,
      "messageType": "image",
      "originalName": "photo.jpg",
      "filename": "xxx.jpg",
      "url": "/uploads/messages/xxx.jpg",
      "thumbnailUrl": "/uploads/messages/thumb_xxx.jpg",
      "width": 1920,
      "height": 1080,
      "size": 123456,
      "createdAt": "2026-05-24T12:00:00.000Z",
      "sender": {
        "id": "uuid",
        "displayName": "John Doe",
        "avatarUrl": "..."
      }
    }
  ],
  "pagination": { ... },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 4.11 Lấy tin nhắn đã ghim

**GET** `/api/conversations/:id/pinned?page=1&limit=20`

**Công dụng:** Lấy danh sách tin nhắn đã ghim trong cuộc trò chuyện

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "pinned-uuid",
      "title": "Tài liệu quan trọng",
      "description": "Mô tả",
      "pinOrder": 1,
      "pinnedAt": "2026-05-24T12:00:00.000Z",
      "message": {
        "id": "msg-uuid",
        "content": "Nội dung tin nhắn",
        "messageType": "file",
        "senderId": "uuid",
        "createdAt": "2026-05-24T10:00:00.000Z",
        "metadata": { ... }
      },
      "pinnedBy": {
        "id": "uuid",
        "displayName": "John Doe",
        "avatarUrl": "..."
      }
    }
  ],
  "pagination": { ... },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 4.12 Ghim tin nhắn

**POST** `/api/conversations/:id/pinned`

**Công dụng:** Ghim một tin nhắn để dễ tìm

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**

```json
{
  "messageId": "uuid-cua-tin-nhan",
  "title": "Tên ghim (tùy chọn)",
  "description": "Mô tả (tùy chọn)"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Message pinned",
  "data": { ... },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 4.13 Bỏ ghim tin nhắn

**DELETE** `/api/conversations/:id/pinned/:pinnedId`

**Công dụng:** Bỏ ghim một tin nhắn đã ghim

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": { "message": "Document unpinned" },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

## 5. UPLOAD API

> **Tất cả endpoints đều yêu cầu authentication**
> 
> **Content-Type:** `multipart/form-data` cho POST requests

### 5.1 Upload file đơn

**POST** `/api/upload`

**Công dụng:** Upload một file bất kỳ

**Headers:** `Authorization: Bearer <accessToken>`

**Form Data:**

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `file` | File | File cần upload |

**Response (201 Created):**

```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "filename": "abc123.png",
    "originalName": "photo.png",
    "mimetype": "image/png",
    "size": 12345,
    "url": "/uploads/attachments/abc123.png",
    "path": "attachments/abc123.png"
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 5.2 Upload nhiều file

**POST** `/api/upload/multiple`

**Công dụng:** Upload nhiều files cùng lúc (tối đa 10 files)

**Headers:** `Authorization: Bearer <accessToken>`

**Form Data:**

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `files` | File[] | Danh sách files cần upload |

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Files uploaded successfully",
  "data": {
    "count": 3,
    "files": [
      {
        "filename": "abc123.png",
        "originalName": "photo1.png",
        "mimetype": "image/png",
        "size": 12345,
        "url": "/uploads/attachments/abc123.png",
        "path": "attachments/abc123.png"
      }
    ]
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 5.3 Upload avatar user

**POST** `/api/upload/avatar`

**Công dụng:** Upload avatar cho user

**Headers:** `Authorization: Bearer <accessToken>`

**Form Data:**

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `file` | File | File ảnh avatar |

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Avatar uploaded successfully",
  "data": {
    "filename": "avatar_abc123.png",
    "originalName": "my-photo.png",
    "mimetype": "image/png",
    "size": 12345,
    "url": "/uploads/avatar/avatar_abc123.png",
    "path": "avatar/avatar_abc123.png"
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 5.4 Upload file đính kèm tin nhắn

**POST** `/api/upload/message`

**Công dụng:** Upload file đính kèm tin nhắn

**Headers:** `Authorization: Bearer <accessToken>`

**Form Data:**

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `file` | File | File cần upload |

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Message file uploaded successfully",
  "data": {
    "filename": "doc_abc123.pdf",
    "originalName": "document.pdf",
    "mimetype": "application/pdf",
    "size": 123456,
    "url": "/uploads/messages/doc_abc123.pdf",
    "path": "messages/doc_abc123.pdf",
    "category": "attachment"
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 5.5 Upload avatar nhóm

**POST** `/api/upload/conversation-avatar`

**Công dụng:** Upload avatar cho cuộc trò chuyện nhóm

**Headers:** `Authorization: Bearer <accessToken>`

**Form Data:**

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `file` | File | File ảnh avatar nhóm |

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Conversation avatar uploaded successfully",
  "data": { ... },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 5.6 Lấy thông tin file

**GET** `/api/upload/:filename`

**Công dụng:** Lấy thông tin chi tiết của một file

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "filename": "abc123.png",
    "category": "avatar",
    "size": 12345,
    "created": "2026-05-24T12:00:00.000Z",
    "modified": "2026-05-24T12:00:00.000Z",
    "url": "/uploads/avatar/abc123.png"
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

### 5.7 Tải file

**GET** `/api/upload/:category/:filename/download?name=originalName`

**Công dụng:** Tải file về máy

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:**

| Tham số | Kiểu | Mô tả |
|---------|------|-------|
| `name` | string | Tên file gốc khi tải về |

**Response:** File nhị phân với headers:
```
Content-Disposition: attachment; filename*=UTF-8''photo.png
Content-Length: 12345
```

---

### 5.8 Xóa file

**DELETE** `/api/upload/:filename`

**Công dụng:** Xóa một file đã upload

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "File deleted successfully",
  "data": {
    "filename": "abc123.png",
    "deleted": true
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

---

## 6. SOCKET.IO EVENTS

> **Server URL:** `ws://localhost:3000`
> 
> **Authentication:** Gửi token qua `auth` khi connect

### 6.1 Kết nối Socket

**Client -> Server:**

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'accessToken_của_user'
  }
});
```

---

### 6.2 Các sự kiện Client -> Server

#### 6.2.1 Tham gia cuộc trò chuyện

**Event:** `join_conversation`

```javascript
socket.emit('join_conversation', {
  conversationId: 'uuid-cua-cuoc-tro-chuyen'
});
```

#### 6.2.2 Rời cuộc trò chuyện

**Event:** `leave_conversation`

```javascript
socket.emit('leave_conversation', {
  conversationId: 'uuid-cua-cuoc-tro-chuyen'
});
```

#### 6.2.3 Bắt đầu typing

**Event:** `typing_start`

```javascript
socket.emit('typing_start', {
  conversationId: 'uuid-cua-cuoc-tro-chuyen'
});
```

#### 6.2.4 Dừng typing

**Event:** `typing_stop`

```javascript
socket.emit('typing_stop', {
  conversationId: 'uuid-cua-cuoc-tro-chuyen'
});
```

#### 6.2.5 Đánh dấu đã đọc (Socket)

**Event:** `mark_read`

```javascript
socket.emit('mark_read', {
  conversationId: 'uuid-cua-cuoc-tro-chuyen',
  messageId: 'uuid-cua-tin-nhan' // optional
});
```

---

### 6.3 Các sự kiện Server -> Client

#### 6.3.1 Tin nhắn mới

**Event:** `new_message`

```javascript
socket.on('new_message', (data) => {
  console.log(data.message);
  // data.message: { id, content, sender, messageType, metadata, ... }
});
```

#### 6.3.2 Tin nhắn được chỉnh sửa

**Event:** `message_updated`

```javascript
socket.on('message_updated', (data) => {
  // data: { messageId, content, updatedAt }
});
```

#### 6.3.3 Tin nhắn bị xóa

**Event:** `message_deleted`

```javascript
socket.on('message_deleted', (data) => {
  // data: { messageId, conversationId }
});
```

#### 6.3.4 Tin nhắn bị thu hồi

**Event:** `message_recalled`

```javascript
socket.on('message_recalled', (data) => {
  // data: { messageId, conversationId, recalledBy }
});
```

#### 6.3.5 Người dùng đang typing

**Event:** `user_typing`

```javascript
socket.on('user_typing', (data) => {
  // data: { conversationId, userId, userName, isTyping }
});
```

#### 6.3.6 Trạng thái tin nhắn thay đổi

**Event:** `message_status`

```javascript
socket.on('message_status', (data) => {
  // data: { messageId, status, userId, conversationId }
});
```

#### 6.3.7 User online

**Event:** `user_online`

```javascript
socket.on('user_online', (data) => {
  // data: { userId, timestamp }
});
```

#### 6.3.8 User offline

**Event:** `user_offline`

```javascript
socket.on('user_offline', (data) => {
  // data: { userId, timestamp }
});
```

#### 6.3.9 Cuộc trò chuyện được cập nhật

**Event:** `conversation_updated`

```javascript
socket.on('conversation_updated', (data) => {
  // data: { conversationId, updates }
});
```

#### 6.3.10 Lỗi

**Event:** `error`

```javascript
socket.on('error', (data) => {
  // data: { error: 'mô tả lỗi' }
});
```

---

### 6.4 Cuộc gọi (Calls) - WebRTC

#### 6.4.1 Bắt đầu cuộc gọi

**Event:** `call_initiate`

```javascript
socket.emit('call_initiate', {
  conversationId: 'uuid',
  callType: 'audio' | 'video'
});
```

**Server phản hồi (cho người nhận):** `incoming_call`

```javascript
socket.on('incoming_call', (data) => {
  // data: { callId, callerId, callerName, callType, conversationId }
});
```

#### 6.4.2 Chấp nhận cuộc gọi

**Event:** `call_accept`

```javascript
socket.emit('call_accept', {
  callId: 'uuid'
});
```

#### 6.4.3 Từ chối cuộc gọi

**Event:** `call_decline`

```javascript
socket.emit('call_decline', {
  callId: 'uuid'
});
```

#### 6.4.4 Kết thúc cuộc gọi

**Event:** `call_end`

```javascript
socket.emit('call_end', {
  callId: 'uuid'
});
```

**Server phản hồi (cho bên kia):** `call_ended`

```javascript
socket.on('call_ended', (data) => {
  // data: {
  //   callId: 'uuid',
  //   endedBy: 'user-id',
  //   reason: 'disconnected' | undefined, // 'disconnected' khi người kia mất kết nối
  //   message: 'Cuộc gọi kết thúc do người kia mất kết nối', // khi reason='disconnected'
  //   duration: 120, // thời lượng cuộc gọi (giây)
  //   timestamp: 'ISO date'
  // }
});
```

#### 6.4.5 Cuộc gọi bị từ chối (người nhận offline)

**Server gửi cho caller:** `call_rejected`

```javascript
socket.on('call_rejected', (data) => {
  // data: {
  //   calleeId: 'uuid',
  //   reason: 'offline',
  //   message: 'Người dùng hiện không liên lạc được'
  // }
});
```

#### 6.4.6 Cuộc gọi nhỡ

**Event:** `call_missed`

```javascript
socket.emit('call_missed', {
  callId: 'uuid'
});
```

#### 6.4.7 WebRTC Signaling

**Gửi offer:**
```javascript
socket.emit('call_offer', {
  callId: 'uuid',
  sdp: 'sdp_data'
});
```

**Nhận offer:**
```javascript
socket.on('call_offer_received', (data) => {
  // data: { callId, callerId, sdp }
});
```

**Gửi answer:**
```javascript
socket.emit('call_answer', {
  callId: 'uuid',
  sdp: 'sdp_data'
});
```

**Nhận answer:**
```javascript
socket.on('call_answer_received', (data) => {
  // data: { callId, sdp }
});
```

**Gửi ICE Candidate:**
```javascript
socket.emit('call_ice_candidate', {
  callId: 'uuid',
  candidate: 'ice_candidate_data'
});
```

**Nhận ICE Candidate:**
```javascript
socket.on('call_ice_candidate_received', (data) => {
  // data: { callId, candidate }
});
```

---

## Phụ Lục

### Cấu trúc Response tiêu chuẩn

#### Thành công (không phân trang):

```json
{
  "success": true,
  "message": "Mô tả",
  "data": { ... },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

#### Thành công (có phân trang):

```json
{
  "success": true,
  "message": "Mô tả",
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasMore": true
  },
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

#### Lỗi:

```json
{
  "success": false,
  "error": "Mô tả lỗi",
  "code": "ERROR_CODE",
  "errors": [
    {
      "field": "email",
      "message": "Email không hợp lệ"
    }
  ],
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

### Mã lỗi thường gặp

| Code | HTTP Status | Mô tả |
|------|-------------|-------|
| `UNAUTHORIZED` | 401 | Chưa đăng nhập hoặc token hết hạn |
| `FORBIDDEN` | 403 | Không có quyền truy cập |
| `NOT_FOUND` | 404 | Resource không tồn tại |
| `VALIDATION_ERROR` | 400 | Dữ liệu đầu vào không hợp lệ |
| `CONFLICT` | 409 | Tài nguyên đã tồn tại (trùng lặp) |
| `INTERNAL_ERROR` | 500 | Lỗi server nội bộ |

### Các loại tin nhắn

| Type | Mô tả |
|------|-------|
| `text` | Tin nhắn văn bản |
| `image` | Ảnh |
| `video` | Video |
| `audio` | Audio/Ghi âm |
| `file` | File đính kèm |
| `sticker` | Nhãn dán |
| `system` | Tin nhắn hệ thống |

### Các loại cuộc trò chuyện

| Type | Mô tả |
|------|-------|
| `direct` | Chat riêng 1-1 |
| `group` | Nhóm chat |

### Trạng thái user

| Status | Mô tả |
|--------|-------|
| `online` | Đang online |
| `offline` | Offline |
| `away` | Vắng mặt |
| `busy` | Bận |

### Role trong nhóm

| Role | Mô tả |
|------|-------|
| `owner` | Chủ nhóm (có tất cả quyền, không thể rời) |
| `admin` | Quản trị viên |
| `member` | Thành viên |

---

## Ví dụ sử dụng với Axios (Frontend)

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

// Tạo instance axios với interceptors
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Thêm token vào mọi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Xử lý lỗi 401 - refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Redirect to login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Ví dụ: Đăng nhập
async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  localStorage.setItem('accessToken', data.data.accessToken);
  localStorage.setItem('refreshToken', data.data.refreshToken);
  return data.data.user;
}

// Ví dụ: Lấy danh sách cuộc trò chuyện
async function getConversations(page = 1, limit = 20) {
  const { data } = await api.get('/conversations', {
    params: { page, limit },
  });
  return data;
}

// Ví dụ: Gửi tin nhắn
async function sendMessage(conversationId, content) {
  const { data } = await api.post(`/conversations/${conversationId}/messages`, {
    content,
    messageType: 'text',
  });
  return data.data;
}

// Ví dụ: Upload file
async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}
```
