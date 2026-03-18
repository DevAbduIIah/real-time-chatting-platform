const prisma = require('./lib/prisma');

// Store connected users: { oderId: socketId }
const connectedUsers = new Map();

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${userId}`);

    // Store user's socket connection
    connectedUsers.set(userId, socket.id);

    // Join user to their own room for direct messaging
    socket.join(userId);

    // Broadcast user online status
    socket.broadcast.emit('user_online', { userId });

    // Send list of currently online users to the newly connected user
    const onlineUserIds = Array.from(connectedUsers.keys());
    socket.emit('online_users', { userIds: onlineUserIds });

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, content } = data;

        if (!conversationId || !content?.trim()) {
          socket.emit('error', { message: 'Invalid message data' });
          return;
        }

        // Verify user is part of the conversation
        const conversation = await prisma.conversation.findFirst({
          where: {
            id: conversationId,
            OR: [
              { user1Id: userId },
              { user2Id: userId },
            ],
          },
        });

        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        // Create the message
        const message = await prisma.message.create({
          data: {
            content: content.trim(),
            senderId: userId,
            conversationId,
          },
          include: {
            sender: { select: { id: true, name: true } },
          },
        });

        // Update conversation timestamp
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        // Format the message for clients
        const formattedMessage = {
          id: message.id,
          content: message.content,
          createdAt: message.createdAt,
          senderId: message.senderId,
          senderName: message.sender.name,
          conversationId,
        };

        // Determine the recipient
        const recipientId = conversation.user1Id === userId
          ? conversation.user2Id
          : conversation.user1Id;

        // Send to sender (mark as own)
        socket.emit('new_message', {
          ...formattedMessage,
          isOwn: true,
        });

        // Send to recipient if online (mark as not own)
        if (connectedUsers.has(recipientId)) {
          io.to(recipientId).emit('new_message', {
            ...formattedMessage,
            isOwn: false,
          });
        }

      } catch (err) {
        console.error('Send message error:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle user typing indicator
    socket.on('typing', (data) => {
      const { conversationId, recipientId } = data;
      if (connectedUsers.has(recipientId)) {
        io.to(recipientId).emit('user_typing', {
          conversationId,
          userId,
        });
      }
    });

    // Handle user stopped typing
    socket.on('stop_typing', (data) => {
      const { conversationId, recipientId } = data;
      if (connectedUsers.has(recipientId)) {
        io.to(recipientId).emit('user_stop_typing', {
          conversationId,
          userId,
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}`);
      connectedUsers.delete(userId);

      // Broadcast user offline status
      socket.broadcast.emit('user_offline', { userId });
    });
  });
}

module.exports = { setupSocketHandlers, connectedUsers };
