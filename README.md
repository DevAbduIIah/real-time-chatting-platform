# Real-Time Chat Application

A modern, full-stack real-time chat application built with React, Express.js, Socket.io, and Prisma. Features instant messaging, typing indicators, online/offline status, and a beautiful responsive UI.

## ✨ Features

### Core Functionality

- 🔐 **User Authentication** - Secure JWT-based authentication with password hashing
- 💬 **Real-Time Messaging** - Instant message delivery using Socket.io
- 👥 **User Management** - View all registered users and start conversations
- 💾 **Message Persistence** - All messages saved to SQLite database
- 🔄 **Auto-Reconnection** - Automatic reconnection when connection is lost

### UX Enhancements

- ⌨️ **Typing Indicators** - See when the other person is typing
- 🟢 **Online/Offline Status** - Real-time user presence indicators
- 📜 **Auto-Scroll** - Automatically scrolls to new messages
- 🎨 **Smooth Animations** - Fade-in effects for messages
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices
- 🔔 **Connection Status** - Visual indicator when reconnecting to server

## 🛠️ Tech Stack

### Frontend

- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS v4** - Utility-first CSS framework
- **Socket.io Client** - Real-time WebSocket client
- **React Router** - Client-side routing
- **Axios** - HTTP client for API calls

### Backend

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.io** - Real-time bidirectional communication
- **Prisma ORM v7** - Database ORM with SQLite adapter
- **SQLite** - Lightweight database
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing

## 📋 Prerequisites

Before running this project, make sure you have:

- **Node.js** (v18 or higher)
- **npm** or **yarn** package manager

## 🚀 Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd ChattingPlatform
```

### 2. Install Backend Dependencies

```bash
cd server
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../client
npm install
```

### 4. Set Up Environment Variables

Create a `.env` file in the `server` directory:

```env
PORT=5000
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
DATABASE_URL=file:./prisma/dev.db
```

**Important:** Change the `JWT_SECRET` to a strong, random string in production!

### 5. Set Up Database

```bash
cd server
npx prisma generate
npx prisma migrate dev --name init
```

## ▶️ Running the Application

### Start the Backend Server

```bash
cd server
npm run dev
```

The server will start on `http://localhost:5000`

### Start the Frontend Client

In a new terminal:

```bash
cd client
npm run dev
```

The client will start on `http://localhost:5173` (or 5174 if 5173 is taken)

### Access the Application

Open your browser and navigate to:

- **Frontend:** `http://localhost:5173`
- **Backend API:** `http://localhost:5000`

## 📁 Project Structure

```
ChattingPlatform/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── ChatHeader.jsx
│   │   │   ├── MessageInput.jsx
│   │   │   ├── MessageList.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── context/          # React Context providers
│   │   │   ├── AuthContext.jsx
│   │   │   └── SocketContext.jsx
│   │   ├── lib/              # Utilities and API client
│   │   │   └── api.js
│   │   ├── pages/            # Page components
│   │   │   ├── Chat.jsx
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   ├── App.jsx           # Main app component
│   │   ├── index.css         # Global styles
│   │   └── main.jsx          # Entry point
│   ├── package.json
│   └── vite.config.js
│
├── server/                    # Backend Express application
│   ├── generated/            # Generated Prisma client
│   ├── lib/
│   │   └── prisma.js         # Prisma client setup
│   ├── middleware/
│   │   └── auth.js           # JWT authentication middleware
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   └── dev.db            # SQLite database file
│   ├── routes/               # API routes
│   │   ├── auth.js           # Authentication routes
│   │   ├── conversations.js  # Conversation & message routes
│   │   └── users.js          # User routes
│   ├── socket.js             # Socket.io event handlers
│   ├── index.js              # Main server file
│   ├── package.json
│   └── .env                  # Environment variables
│
└── README.md                 # This file
```

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user and get JWT token

### Users

- `GET /api/users` - Get all users (requires auth)

### Conversations

- `GET /api/conversations` - Get all conversations for current user
- `POST /api/conversations` - Create or get conversation with a user
- `GET /api/conversations/:id/messages` - Get messages for a conversation
- `POST /api/conversations/:id/messages` - Send a message (API fallback)

## 🔊 Socket.io Events

### Client → Server

- `send_message` - Send a new message
- `typing` - User started typing
- `stop_typing` - User stopped typing

### Server → Client

- `new_message` - Receive a new message
- `user_typing` - Other user started typing
- `user_stop_typing` - Other user stopped typing
- `user_online` - User came online
- `user_offline` - User went offline
- `online_users` - List of currently online users

## 🗄️ Database Schema

### User

- `id` (String, UUID)
- `name` (String)
- `email` (String, unique)
- `password` (String, hashed)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### Conversation

- `id` (String, UUID)
- `user1Id` (String)
- `user2Id` (String)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### Message

- `id` (String, UUID)
- `content` (String)
- `senderId` (String)
- `conversationId` (String)
- `createdAt` (DateTime)

## 🧪 Testing the Application

1. **Register Two Users:**
   - Open the app in a regular browser window
   - Register a new user (e.g., "Alice")
   - Open the app in an incognito/private window
   - Register another user (e.g., "Bob")

2. **Test Real-Time Messaging:**
   - Select the other user from the sidebar in both windows
   - Send messages from either window
   - Messages should appear instantly in both windows

3. **Test Typing Indicators:**
   - Start typing in one window
   - See "typing..." appear in the other window's header
   - See animated typing bubble in message list

4. **Test Online/Offline Status:**
   - Both users should show green dot when online
   - Close one browser window
   - Green dot should disappear for that user

## 🎨 Key Features Implementation

### Authentication Flow

1. User registers/logs in
2. Server generates JWT token
3. Token stored in localStorage
4. Token sent with all API requests and Socket.io connection

### Real-Time Messaging Flow

1. User types message and hits send
2. Message sent via Socket.io to server
3. Server saves message to database
4. Server emits message to both sender and recipient
5. Both clients receive and display message instantly
6. Message list auto-scrolls to bottom

### Typing Indicators Flow

1. User starts typing
2. `typing` event sent to server after first keystroke
3. Server forwards to recipient if online
4. Recipient sees "typing..." indicator
5. After 3 seconds of inactivity, `stop_typing` event sent
6. Indicator removed from recipient's view

## 🔐 Security Features

- Passwords hashed with bcryptjs before storing
- JWT tokens for secure authentication
- Protected API routes requiring valid JWT
- Socket.io connections authenticated with JWT
- CORS properly configured
- SQL injection prevention via Prisma ORM

## 🚧 Future Enhancements

Potential features to add:

- [ ] Group chat support
- [ ] Message read receipts
- [ ] File/image sharing
- [ ] Message search functionality
- [ ] User profiles with avatars
- [ ] Message deletion/editing
- [ ] Emoji picker
- [ ] Voice/video calling
- [ ] Push notifications
- [ ] Dark mode toggle
- [ ] Message reactions
- [ ] User blocking/reporting

## 📝 Development Notes

### Prisma v7 Setup

This project uses Prisma v7 which requires driver adapters for all databases, including SQLite. The setup includes:

- `@prisma/adapter-better-sqlite3` - SQLite driver adapter
- `better-sqlite3` - SQLite database driver
- Custom Prisma client instantiation with adapter

### Tailwind CSS v4

Using the latest Tailwind CSS v4 with PostCSS:

- Requires `@tailwindcss/postcss` package
- Simplified configuration in `postcss.config.js`
- Import via `@import "tailwindcss"` in CSS

## 🐛 Troubleshooting

### Port Already in Use

If you get `EADDRINUSE` error:

```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

### Socket Connection Issues

- Check CORS settings in `server/index.js`
- Ensure both frontend and backend are running
- Check browser console for connection errors
- Verify JWT_SECRET is set in .env file

### Database Issues

```bash
# Reset database
cd server
rm -rf prisma/dev.db
npx prisma migrate reset
npx prisma generate
```

## 👤 Author

Built as a learning project to demonstrate modern web development practices with real-time features.

---

**Happy Chatting! 💬✨**
