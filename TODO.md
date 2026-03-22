# TODO — Real-Time Chat Application Improvements

## Goal

Upgrade the real-time chat application from a solid learning project into a polished, portfolio-ready product with better UX, richer messaging features, and stronger production readiness.

---

## Phase 1 — Conversation List and Chat UI Polish

### Objective

Improve the first impression and make the app feel more complete before adding bigger features.

### Tasks

- [x] Add **last message preview** for each conversation in the sidebar
- [x] Sort conversations by **most recent activity**
- [x] Add **unread message count badges**
- [x] Show **message timestamps** in a clean, readable way
- [x] Add **empty states**
  - [x] No conversation selected
  - [x] No messages yet
  - [x] No users found
- [x] Add **loading states / skeletons**
  - [x] Conversation list loading
  - [x] Messages loading
- [x] Improve **responsive mobile layout**
  - [x] Better sidebar/chat switching
  - [x] Better spacing on smaller screens
- [x] Improve **message bubble styling**
  - [x] Clear distinction between sent and received messages
  - [x] Better spacing and alignment
- [x] Keep chat header and message input visually cleaner
- [x] Make scrolling smoother and preserve UX consistency

### Done When

- [x] Sidebar looks more modern and useful
- [x] Conversations are easier to scan
- [x] Chat area feels polished on desktop and mobile

---

## Phase 2 — Messaging Experience Enhancements

### Objective

Make messaging feel closer to a real-world chat application.

### Tasks

- [x] Add **read receipts**
  - [x] Sent
  - [x] Delivered
  - [x] Seen
- [x] Add **message sending states**
  - [x] Pending
  - [x] Failed
  - [x] Retry if needed
- [x] Add **reply to message**
- [x] Add **edit message**
- [x] Add **delete message**
- [x] Add **emoji picker**
- [x] Add **typing indicator polish**
  - [x] Prevent flicker
  - [x] Better timing and cleanup
- [x] Add **date separators**
  - [x] Example: Today, Yesterday, older dates
- [x] Auto-focus message input when entering a conversation
- [x] Better handling for long messages and line breaks

### Done When

- [x] Users can interact with messages more naturally
- [x] Message lifecycle feels complete
- [x] Chat feels much more like a modern messaging app

---

## Phase 3 — User Identity and Personalization

### Objective

Make the application feel less generic and more human.

### Tasks

- [x] Add **user profile avatars**
  - [x] Upload avatar or generate placeholder initials
- [x] Add profile details
  - [x] Display name
  - [x] Email
  - [x] Optional bio/status
- [x] Show avatar in:
  - [x] Sidebar
  - [x] Chat header
  - [x] Message bubbles where appropriate
- [x] Add **online/offline status polish**
  - [x] Last seen text for offline users
- [x] Add a **settings/profile page**
- [x] Add **dark mode toggle**
- [x] Improve visual consistency across all pages

### Done When

- [x] Users have identity inside the app
- [x] App feels personalized and more portfolio-worthy

---

## Phase 4 — Search, Navigation, and Better Message History

### Objective

Improve usability for larger conversations and longer-term use.

### Tasks

- [x] Add **message search**
  - [x] Search within current conversation
  - [x] Highlight matched messages
- [x] Add **conversation search**
  - [x] Quickly find users or chats
- [x] Add **pagination or infinite scroll** for older messages
- [x] Preserve scroll position when loading older messages
- [x] Add **jump to latest message** button when user scrolls up
- [x] Improve route/state sync so refreshing the page preserves the selected conversation if possible
- [x] Add better URL structure for direct conversation access if suitable

### Done When

- [x] Large chats remain usable
- [x] Users can find old messages and conversations easily

---

## Phase 5 — Media and Rich Interactions

### Objective

Expand the app beyond text-only chat.

### Tasks

- [x] Add **file sharing**
- [x] Add **image sharing**
- [x] Show file/image previews inside messages
- [x] Add upload validation
  - [x] File size limit
  - [x] Allowed file types
- [x] Store uploaded files safely
- [x] Add **message reactions**
- [x] Add optional **copy message** action
- [x] Add optional **link detection**
  - [x] Clickable URLs in messages

### Done When

- [x] The app supports richer communication
- [x] Messages feel more dynamic and practical

---

## Phase 6 — Group Chat Support

### Objective

Introduce more advanced chat functionality.

### Tasks

- Add **group conversation model**
- Allow users to:
  - Create a group
  - Name a group
  - Add/remove participants
- Show group details in chat header
- Update sidebar to support both direct and group chats
- Adjust socket events and API logic for group messaging
- Show sender identity clearly in group messages

### Done When

- Users can create and use group chats reliably
- UI clearly supports both one-to-one and group messaging

---

## Phase 7 — Notifications and Reconnection Quality

### Objective

Make the real-time system feel more reliable and polished.

### Tasks

- Improve socket reconnection handling
- Prevent duplicated messages during reconnect scenarios
- Add **toast notifications** for important events
  - New message
  - Error
  - Reconnected
- Add optional browser notifications for new messages
- Improve typing and online presence cleanup on disconnect
- Handle edge cases when a user opens multiple tabs
- Ensure real-time state stays in sync after refresh or reconnect

### Done When

- Reconnection is smooth
- Real-time behavior feels stable and trustworthy

---

## Phase 8 — Security and Backend Hardening

### Objective

Make the backend more professional and production-ready.

### Tasks

- Add **request validation** for all important endpoints
- Sanitize user input where needed
- Add **rate limiting**
  - Login/register endpoints
  - Message sending endpoints
- Improve centralized error handling
- Improve auth error responses
- Strengthen socket authentication and invalid token handling
- Add proper environment variable validation
- Review CORS configuration for production safety
- Improve logging for server errors and socket events
- Add database indexes for important fields
  - conversationId
  - senderId
  - createdAt
- Refactor backend code where necessary for maintainability

### Done When

- Backend is safer, cleaner, and easier to scale
- Common abuse and validation issues are handled properly

---

## Phase 9 — Database and Scalability Improvements

### Objective

Prepare the app for real deployment beyond local development.

### Tasks

- Migrate from **SQLite** to **PostgreSQL**
- Update Prisma configuration accordingly
- Review schema for scalability
- Ensure conversation queries are efficient
- Optimize message retrieval queries
- Add proper migration scripts
- Prepare seed data if useful for development
- Review how presence/online users are tracked in memory
- Consider future-friendly structure for scaling Socket.io

### Done When

- App can run on a more realistic production database
- Data layer is more scalable and robust

---

## Phase 10 — Testing, Cleanup, and Deployment Readiness

### Objective

Finish the project like a real product.

### Tasks

- Clean up codebase
  - Remove dead code
  - Remove duplication
  - Improve naming consistency
- Add better comments only where useful
- Improve folder structure if needed
- Add frontend error boundaries or better UI fallbacks
- Test key flows carefully:
  - Register
  - Login
  - Start chat
  - Send/receive message
  - Typing indicator
  - Online/offline status
  - Read receipts
  - Uploads
  - Reconnect behavior
- Improve README with updated features and setup steps
- Add screenshots or GIFs for GitHub
- Prepare production environment configs
- Deploy frontend and backend
- Verify app works in production

### Done When

- Project is polished, tested, and presentable on GitHub and in a portfolio

---

# Priority Order

## High Priority

- Last message preview
- Unread badges
- Read receipts
- Avatars
- Message edit/delete
- Search
- Better mobile UX
- Validation and rate limiting

## Medium Priority

- File/image sharing
- Reactions
- Dark mode
- Group chat
- Notifications

## Lower Priority

- Voice/video calling
- Blocking/reporting
- Advanced presence features

---

# Final Goal

By the end of these phases, the app should feel like a real modern chat platform instead of just a basic real-time messaging demo.
