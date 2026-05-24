# Chat API

Backend API cho ứng dụng chat Zalo-like với Node.js, Express, Prisma 7, MySQL và Socket.IO.

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database ORM**: Prisma 7
- **Database**: MySQL 8.0+
- **Real-time**: Socket.IO
- **Authentication**: JWT + Refresh Tokens
- **Validation**: Zod
- **Testing**: Vitest + Supertest
- **Password Hashing**: bcryptjs

## Features

- User authentication (register, login, logout, refresh token)
- Conversations (direct & group)
- Messages (send, edit, delete, recall)
- Real-time messaging via WebSocket
- Typing indicators
- Read receipts
- Message pinning
- CORS handling for both HTTP and Socket.IO

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- npm or yarn

### Installation

```bash
# Clone the repository
cd ChatAPI

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials
```

### Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Push schema to database (development)
npm run prisma:push

# Or run migrations
npm run prisma:migrate

# Seed database (optional)
npm run prisma:seed
```

### Running the Server

```bash
# Development mode
npm run dev

# Production mode
npm start

# Run tests
npm test
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/refresh` | Refresh token |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/forgot-password` | Forgot password |
| POST | `/api/auth/reset-password` | Reset password |

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | List conversations |
| POST | `/api/conversations` | Create conversation |
| GET | `/api/conversations/:id` | Get conversation |
| PUT | `/api/conversations/:id` | Update conversation |
| DELETE | `/api/conversations/:id` | Delete/leave conversation |
| POST | `/api/conversations/:id/participants` | Add participants |
| DELETE | `/api/conversations/:id/participants/:userId` | Remove participant |
| POST | `/api/conversations/:id/pin` | Toggle pin |
| POST | `/api/conversations/:id/mute` | Toggle mute |

### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations/:id/messages` | Get messages |
| POST | `/api/conversations/:id/messages` | Send message |
| PUT | `/api/messages/:id` | Edit message |
| DELETE | `/api/messages/:id` | Delete message |
| POST | `/api/messages/:id/recall` | Recall message |
| POST | `/api/messages/read` | Mark as read |
| GET | `/api/conversations/:id/pinned` | Get pinned docs |
| POST | `/api/conversations/:id/pinned` | Pin message |
| DELETE | `/api/messages/pinned/:id` | Unpin message |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/profile` | Get profile |
| PUT | `/api/users/profile` | Update profile |
| GET | `/api/users/:id` | Get user by ID |
| GET | `/api/users` | Search users |

## WebSocket Events

### Client -> Server

- `join_conversation` - Join a conversation room
- `leave_conversation` - Leave a conversation room
- `send_message` - Send a message
- `typing_start` - User started typing
- `typing_stop` - User stopped typing
- `mark_read` - Mark messages as read

### Server -> Client

- `new_message` - New message received
- `message_updated` - Message edited/deleted
- `user_typing` - User is typing
- `message_status` - Message status changed
- `user_online` - User came online
- `user_offline` - User went offline

## CORS Configuration

Both HTTP Express CORS and Socket.IO CORS are configured:

```javascript
// Express CORS
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Socket.IO CORS
io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST']
  }
});
```

## Project Structure

```
src/
├── config/           # Configuration
├── controllers/      # Request handlers
├── middleware/       # Express middleware
├── routes/          # Route definitions
├── services/        # Business logic
├── socket/          # Socket.IO setup
├── utils/           # Helper functions
├── validators/      # Validation schemas
└── app.js           # Express app setup
prisma/
├── schema.prisma    # Database schema
└── seed.js         # Seed data
tests/
├── setup.js        # Test setup
├── auth.test.js    # Auth tests
├── conversation.test.js
└── message.test.js
```

## License

MIT
