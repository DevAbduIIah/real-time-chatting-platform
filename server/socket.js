const prisma = require('./lib/prisma');
const {
  buildConversationRoom,
  getConversationInclude,
  getConversationReadUpdateData,
} = require('./routes/conversation-helpers');
const {
  formatMessage,
  getConversationRecipientIds,
  getMessageInclude,
  getMessagePreview,
} = require('./routes/message-helpers');

// Store connected users: { userId: socketId }
const connectedUsers = new Map();

function getConversationWhereForUser(userId) {
  return {
    OR: [
      { user1Id: userId },
      { user2Id: userId },
      {
        participants: {
          some: { userId },
        },
      },
    ],
  };
}

async function getConversationForUser(conversationId, userId) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      ...getConversationWhereForUser(userId),
    },
    include: getConversationInclude(),
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

async function validateAttachmentIds(attachmentIds, userId) {
  const normalizedIds = Array.isArray(attachmentIds)
    ? [...new Set(attachmentIds.filter(Boolean))]
    : [];

  if (normalizedIds.length === 0) {
    return [];
  }

  const attachments = await prisma.attachment.findMany({
    where: {
      id: { in: normalizedIds },
      uploadedById: userId,
      messageId: null,
    },
  });

  if (attachments.length !== normalizedIds.length) {
    return null;
  }

  return attachments;
}

async function joinConversationRooms(socket, userId) {
  const conversations = await prisma.conversation.findMany({
    where: getConversationWhereForUser(userId),
    select: { id: true },
  });

  conversations.forEach((conversation) => {
    socket.join(buildConversationRoom(conversation.id));
  });
}

function emitConversationActivity(io, conversationId, message, senderId) {
  const conversationRoom = buildConversationRoom(conversationId);

  io.to(senderId).emit('conversation_updated', {
    conversationId,
    lastMessage: getMessagePreview(message, senderId),
    lastActivityAt: message.createdAt,
  });

  io.to(conversationRoom).except(senderId).emit('conversation_updated', {
    conversationId,
    lastMessage: getMessagePreview(message, null),
    lastActivityAt: message.createdAt,
  });
}

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${userId}`);

    connectedUsers.set(userId, socket.id);
    socket.join(userId);

    joinConversationRooms(socket, userId).catch((error) => {
      console.error('Join conversation rooms error:', error);
    });

    socket.broadcast.emit('user_online', { userId });
    socket.emit('online_users', { userIds: Array.from(connectedUsers.keys()) });

    socket.on('send_message', async (data) => {
      const { conversationId, content, clientTempId, replyToMessageId, attachmentIds } = data || {};
      const trimmedContent = typeof content === 'string' ? content.trim() : '';

      try {
        if (!conversationId || (!trimmedContent && (!Array.isArray(attachmentIds) || attachmentIds.length === 0))) {
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

        if (replyToMessageId && !replyMessage) {
          socket.emit('message_error', {
            clientTempId: clientTempId || null,
            error: 'Reply target not found.',
          });
          return;
        }

        const validAttachments = await validateAttachmentIds(attachmentIds, userId);
        if (attachmentIds?.length && !validAttachments) {
          socket.emit('message_error', {
            clientTempId: clientTempId || null,
            error: 'One or more attachments are invalid.',
          });
          return;
        }

        const recipientIds = getConversationRecipientIds(conversation, userId);
        const deliveredAt = recipientIds.some((recipientId) => connectedUsers.has(recipientId))
          ? new Date()
          : null;

        const message = await prisma.message.create({
          data: {
            content: trimmedContent,
            clientTempId: clientTempId || null,
            replyToMessageId: replyMessage?.id || null,
            deliveredAt,
            senderId: userId,
            conversationId,
            ...(validAttachments?.length
              ? {
                  attachments: {
                    connect: validAttachments.map((attachment) => ({ id: attachment.id })),
                  },
                }
              : {}),
          },
          include: getMessageInclude(),
        });

        const readUpdateData = getConversationReadUpdateData(conversation, userId);
        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            updatedAt: new Date(),
            ...readUpdateData,
          },
        });

        socket.emit('message_ack', {
          clientTempId: clientTempId || null,
          message: formatMessage(message, userId),
        });

        io.to(buildConversationRoom(conversationId)).except(userId).emit('new_message', formatMessage(message, null));
        emitConversationActivity(io, conversationId, message, userId);
      } catch (err) {
        console.error('Send message error:', err);
        socket.emit('message_error', {
          clientTempId: clientTempId || null,
          error: 'Failed to send message.',
        });
      }
    });

    socket.on('typing', async (data) => {
      const { conversationId } = data || {};

      if (!conversationId) {
        return;
      }

      try {
        const conversation = await getConversationForUser(conversationId, userId);
        if (!conversation) {
          return;
        }

        io.to(buildConversationRoom(conversationId)).except(userId).emit('user_typing', {
          conversationId,
          userId,
        });
      } catch (error) {
        console.error('Typing event error:', error);
      }
    });

    socket.on('stop_typing', async (data) => {
      const { conversationId } = data || {};

      if (!conversationId) {
        return;
      }

      try {
        const conversation = await getConversationForUser(conversationId, userId);
        if (!conversation) {
          return;
        }

        io.to(buildConversationRoom(conversationId)).except(userId).emit('user_stop_typing', {
          conversationId,
          userId,
        });
      } catch (error) {
        console.error('Stop typing event error:', error);
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
