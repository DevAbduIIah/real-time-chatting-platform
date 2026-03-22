const prisma = require('./lib/prisma');
const { getConversationReadUpdateData } = require('./routes/conversation-helpers');
const {
  formatMessage,
  getMessageInclude,
  getMessagePreview,
  getRecipientId,
  normalizeAttachmentIds,
  resolvePendingAttachments,
} = require('./routes/message-helpers');

// Store connected users: { userId: socketId }
const connectedUsers = new Map();

async function getConversationForUser(conversationId, userId) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [
        { user1Id: userId },
        { user2Id: userId },
      ],
    },
  });
}

async function getReplyMessage(replyToMessageId, conversationId) {
  if (!replyToMessageId) {
    return null;
  }

  return prisma.message.findFirst({
    where: {
      id: replyToMessageId,
      conversationId,
    },
    include: {
      sender: { select: { id: true, name: true } },
    },
  });
}

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${userId}`);

    connectedUsers.set(userId, socket.id);
    socket.join(userId);

    socket.broadcast.emit('user_online', { userId });
    socket.emit('online_users', { userIds: Array.from(connectedUsers.keys()) });

    socket.on('send_message', async (data) => {
      const {
        conversationId,
        content,
        clientTempId,
        replyToMessageId,
        attachmentIds,
      } = data || {};

      try {
        const normalizedContent = content?.trim() || '';
        const normalizedAttachmentIds = normalizeAttachmentIds(attachmentIds);

        if (!conversationId || (!normalizedContent && normalizedAttachmentIds.length === 0)) {
          socket.emit('message_error', {
            clientTempId: clientTempId || null,
            error: 'Invalid message data.',
          });
          return;
        }

        const conversation = await getConversationForUser(conversationId, userId);

        if (!conversation) {
          socket.emit('message_error', {
            clientTempId: clientTempId || null,
            error: 'Conversation not found.',
          });
          return;
        }

        if (clientTempId) {
          const existingMessage = await prisma.message.findFirst({
            where: {
              senderId: userId,
              clientTempId,
            },
            include: getMessageInclude(),
          });

          if (existingMessage) {
            socket.emit('message_ack', {
              clientTempId,
              message: formatMessage(existingMessage, userId),
            });
            return;
          }
        }

        const replyMessage = await getReplyMessage(replyToMessageId, conversationId);
        const attachments = await resolvePendingAttachments(prisma, normalizedAttachmentIds, userId);

        if (replyToMessageId && !replyMessage) {
          socket.emit('message_error', {
            clientTempId: clientTempId || null,
            error: 'Reply target not found.',
          });
          return;
        }

        if (attachments.length !== normalizedAttachmentIds.length) {
          socket.emit('message_error', {
            clientTempId: clientTempId || null,
            error: 'One or more attachments are invalid.',
          });
          return;
        }

        const recipientId = getRecipientId(conversation, userId);
        const deliveredAt = connectedUsers.has(recipientId) ? new Date() : null;

        const message = await prisma.message.create({
          data: {
            content: normalizedContent || null,
            clientTempId: clientTempId || null,
            replyToMessageId: replyMessage?.id || null,
            deliveredAt,
            senderId: userId,
            conversationId,
            attachments: normalizedAttachmentIds.length > 0
              ? {
                  connect: attachments.map((attachment) => ({ id: attachment.id })),
                }
              : undefined,
          },
          include: getMessageInclude(),
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            updatedAt: new Date(),
            ...getConversationReadUpdateData(conversation, userId),
          },
        });

        socket.emit('message_ack', {
          clientTempId: clientTempId || null,
          message: formatMessage(message, userId),
        });

        io.to(userId).emit('conversation_updated', {
          conversationId,
          lastMessage: getMessagePreview(message, userId),
          lastActivityAt: message.createdAt,
        });

        if (connectedUsers.has(recipientId)) {
          io.to(recipientId).emit('new_message', formatMessage(message, recipientId));
          io.to(recipientId).emit('conversation_updated', {
            conversationId,
            lastMessage: getMessagePreview(message, recipientId),
            lastActivityAt: message.createdAt,
          });
        }
      } catch (err) {
        console.error('Send message error:', err);
        socket.emit('message_error', {
          clientTempId: clientTempId || null,
          error: 'Failed to send message.',
        });
      }
    });

    socket.on('typing', (data) => {
      const { conversationId, recipientId } = data || {};

      if (connectedUsers.has(recipientId)) {
        io.to(recipientId).emit('user_typing', {
          conversationId,
          userId,
        });
      }
    });

    socket.on('stop_typing', (data) => {
      const { conversationId, recipientId } = data || {};

      if (connectedUsers.has(recipientId)) {
        io.to(recipientId).emit('user_stop_typing', {
          conversationId,
          userId,
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}`);
      connectedUsers.delete(userId);
      prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt: new Date() },
      }).catch((error) => {
        console.error('Update last seen error:', error);
      });
      socket.broadcast.emit('user_offline', { userId });
    });
  });
}

module.exports = { setupSocketHandlers, connectedUsers };
