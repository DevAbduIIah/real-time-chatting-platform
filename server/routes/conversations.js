const express = require('express');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { connectedUsers } = require('../socket');
const {
  buildConversationRoom,
  formatConversationSummary,
  getConversationInclude,
  getConversationParticipantIds,
  getConversationReadAt,
  getConversationReadUpdateData,
  isGroupConversation,
} = require('./conversation-helpers');
const {
  formatMessage,
  getConversationRecipientIds,
  getMessageInclude,
  getMessagePreview,
} = require('./message-helpers');

const router = express.Router();
const DEFAULT_MESSAGES_LIMIT = 30;
const MAX_MESSAGES_LIMIT = 60;

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

async function getConversationById(conversationId, userId) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      ...getConversationWhereForUser(userId),
    },
    include: getConversationInclude(),
  });
}

function parseMessagesLimit(value) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_MESSAGES_LIMIT;
  }

  return Math.min(parsed, MAX_MESSAGES_LIMIT);
}

function encodeMessageCursor(message) {
  return `${message.createdAt.toISOString()}__${message.id}`;
}

function parseMessageCursor(cursor) {
  if (!cursor) {
    return null;
  }

  const separatorIndex = cursor.lastIndexOf('__');
  if (separatorIndex === -1) {
    return null;
  }

  const createdAt = cursor.slice(0, separatorIndex);
  const id = cursor.slice(separatorIndex + 2);
  const date = new Date(createdAt);

  if (!id || Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    id,
    createdAt: date,
  };
}

function buildMessageWhereClause(conversationId, searchTerm, cursor) {
  const normalizedSearchTerm = searchTerm?.trim();
  const where = {
    conversationId,
  };

  if (normalizedSearchTerm) {
    where.deletedAt = null;
    where.content = {
      contains: normalizedSearchTerm,
    };
  }

  if (cursor) {
    where.OR = [
      {
        createdAt: { lt: cursor.createdAt },
      },
      {
        AND: [
          { createdAt: cursor.createdAt },
          { id: { lt: cursor.id } },
        ],
      },
    ];
  }

  return where;
}

async function getPaginatedMessages({
  conversationId,
  currentUserId,
  cursor,
  limit,
  searchTerm,
}) {
  const rows = await prisma.message.findMany({
    where: buildMessageWhereClause(conversationId, searchTerm, cursor),
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
    take: limit + 1,
    include: getMessageInclude(),
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeMessageCursor(pageRows[pageRows.length - 1]) : null;

  return {
    messages: pageRows.reverse().map((message) => formatMessage(message, currentUserId)),
    pagination: {
      hasMore,
      nextCursor,
    },
  };
}

function getUniqueUserIds(userIds) {
  return [...new Set(userIds.filter(Boolean))];
}

function sortDirectParticipantIds(leftUserId, rightUserId) {
  return [leftUserId, rightUserId].sort((leftId, rightId) => leftId.localeCompare(rightId));
}

async function getUnreadCount(conversation, currentUserId) {
  const readAt = getConversationReadAt(conversation, currentUserId) || new Date(0);

  return prisma.message.count({
    where: {
      conversationId: conversation.id,
      senderId: { not: currentUserId },
      createdAt: { gt: readAt },
      deletedAt: null,
    },
  });
}

async function formatConversationWithUnread(conversation, currentUserId) {
  const unreadCount = await getUnreadCount(conversation, currentUserId);
  return formatConversationSummary(conversation, currentUserId, unreadCount);
}

async function emitConversationSummaries(io, eventName, conversation, userIds) {
  if (!io || !conversation) {
    return;
  }

  await Promise.all(
    getUniqueUserIds(userIds).map(async (userId) => {
      const summary = await formatConversationWithUnread(conversation, userId);
      io.to(userId).emit(eventName, { conversation: summary });
    })
  );
}

async function markConversationAsSeen(conversation, currentUserId, io) {
  const seenAt = new Date();
  const readAt = getConversationReadAt(conversation, currentUserId) || new Date(0);
  const messageRows = await prisma.message.findMany({
    where: {
      conversationId: conversation.id,
      senderId: { not: currentUserId },
      createdAt: { gt: readAt },
    },
    select: {
      id: true,
      senderId: true,
      readAt: true,
    },
  });

  const unseenMessages = messageRows.filter((message) => !message.readAt);

  if (unseenMessages.length > 0) {
    const messageIds = unseenMessages.map((message) => message.id);

    await prisma.message.updateMany({
      where: { id: { in: messageIds } },
      data: {
        deliveredAt: seenAt,
        readAt: seenAt,
      },
    });

    const senderIds = [...new Set(unseenMessages.map((message) => message.senderId))];
    senderIds.forEach((senderId) => {
      io?.to(senderId).emit('messages_seen', {
        conversationId: conversation.id,
        messageIds,
        readAt: seenAt,
      });
    });
  }

  const readUpdateData = getConversationReadUpdateData(conversation, currentUserId, seenAt);
  if (Object.keys(readUpdateData).length === 0) {
    return seenAt;
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: readUpdateData,
  });

  return seenAt;
}

async function validateReplyTarget(replyToMessageId, conversationId) {
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

async function validateAttachmentIds(attachmentIds, currentUserId) {
  const normalizedIds = Array.isArray(attachmentIds)
    ? [...new Set(attachmentIds.filter(Boolean))]
    : [];

  if (normalizedIds.length === 0) {
    return [];
  }

  const attachments = await prisma.attachment.findMany({
    where: {
      id: { in: normalizedIds },
      uploadedById: currentUserId,
      messageId: null,
    },
  });

  if (attachments.length !== normalizedIds.length) {
    return null;
  }

  return attachments;
}

function emitConversationActivity(io, conversationId, message, senderId) {
  const conversationRoom = buildConversationRoom(conversationId);

  io?.to(senderId).emit('conversation_updated', {
    conversationId,
    lastMessage: getMessagePreview(message, senderId),
    lastActivityAt: message.createdAt,
  });

  io?.to(conversationRoom).except(senderId).emit('conversation_updated', {
    conversationId,
    lastMessage: getMessagePreview(message, null),
    lastActivityAt: message.createdAt,
  });
}

function emitMessageUpdate(io, conversationId, eventName, message, currentUserId) {
  const conversationRoom = buildConversationRoom(conversationId);

  io?.to(currentUserId).emit(eventName, formatMessage(message, currentUserId));
  io?.to(conversationRoom).except(currentUserId).emit(eventName, formatMessage(message, null));
}

async function syncConversationRoomMembership(io, conversationId, addedUserIds = [], removedUserIds = []) {
  if (!io) {
    return;
  }

  const room = buildConversationRoom(conversationId);

  if (addedUserIds.length > 0) {
    await Promise.all(addedUserIds.map((userId) => io.in(userId).socketsJoin(room)));
  }

  if (removedUserIds.length > 0) {
    await Promise.all(removedUserIds.map((userId) => io.in(userId).socketsLeave(room)));
  }
}

async function getGroupConversationForEdit(conversationId, userId) {
  const conversation = await getConversationById(conversationId, userId);

  if (!conversation) {
    return null;
  }

  if (!isGroupConversation(conversation)) {
    return false;
  }

  return conversation;
}

// Get all conversations for the current user
router.get('/', auth, async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: getConversationWhereForUser(req.user.id),
      include: getConversationInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    const formattedConversations = await Promise.all(
      conversations.map((conversation) =>
        formatConversationWithUnread(conversation, req.user.id)
      )
    );

    res.json({ conversations: formattedConversations });
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Get or create a direct conversation with another user
router.post('/', auth, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot create conversation with yourself.' });
    }

    const [user1Id, user2Id] = sortDirectParticipantIds(req.user.id, userId);
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        type: 'direct',
        OR: [
          { user1Id: req.user.id, user2Id: userId },
          { user1Id: userId, user2Id: req.user.id },
        ],
      },
      include: getConversationInclude(),
    });

    if (existingConversation) {
      return res.json({
        conversation: await formatConversationWithUnread(existingConversation, req.user.id),
      });
    }

    const now = new Date();
    const conversation = await prisma.conversation.create({
      data: {
        type: 'direct',
        user1Id,
        user2Id,
        user1LastReadAt: now,
        user2LastReadAt: now,
        participants: {
          create: [
            { userId: req.user.id, lastReadAt: now },
            { userId, lastReadAt: now },
          ],
        },
      },
      include: getConversationInclude(),
    });

    const io = req.app.get('io');
    await syncConversationRoomMembership(io, conversation.id, [req.user.id, userId]);
    await emitConversationSummaries(io, 'conversation_created', conversation, [userId]);

    res.status(201).json({
      conversation: await formatConversationWithUnread(conversation, req.user.id),
    });
  } catch (err) {
    console.error('Create conversation error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Create a group conversation
router.post('/group', auth, async (req, res) => {
  try {
    const { name, participantIds } = req.body;
    const otherParticipantIds = getUniqueUserIds(Array.isArray(participantIds) ? participantIds : [])
      .filter((userId) => userId !== req.user.id);

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Group name is required.' });
    }

    if (otherParticipantIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one participant.' });
    }

    const existingUsers = await prisma.user.findMany({
      where: {
        id: { in: otherParticipantIds },
      },
      select: { id: true },
    });

    if (existingUsers.length !== otherParticipantIds.length) {
      return res.status(400).json({ error: 'One or more selected users do not exist.' });
    }

    const allParticipantIds = [req.user.id, ...otherParticipantIds];
    const now = new Date();
    const conversation = await prisma.conversation.create({
      data: {
        type: 'group',
        name: name.trim(),
        participants: {
          create: allParticipantIds.map((userId) => ({
            userId,
            lastReadAt: now,
          })),
        },
      },
      include: getConversationInclude(),
    });

    const io = req.app.get('io');
    await syncConversationRoomMembership(io, conversation.id, allParticipantIds);
    await emitConversationSummaries(io, 'conversation_created', conversation, otherParticipantIds);

    res.status(201).json({
      conversation: await formatConversationWithUnread(conversation, req.user.id),
    });
  } catch (err) {
    console.error('Create group conversation error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Update a group conversation
router.patch('/:id', auth, async (req, res) => {
  try {
    const conversation = await getGroupConversationForEdit(req.params.id, req.user.id);

    if (conversation === null) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    if (conversation === false) {
      return res.status(400).json({ error: 'Only group conversations can be updated here.' });
    }

    const nextName = typeof req.body.name === 'string'
      ? req.body.name.trim()
      : conversation.name;
    const requestedParticipantIds = Array.isArray(req.body.participantIds)
      ? getUniqueUserIds(req.body.participantIds).filter((userId) => userId !== req.user.id)
      : null;

    if (!nextName) {
      return res.status(400).json({ error: 'Group name is required.' });
    }

    let nextParticipantIds = null;
    if (requestedParticipantIds) {
      if (requestedParticipantIds.length === 0) {
        return res.status(400).json({ error: 'A group needs at least one other participant.' });
      }

      const existingUsers = await prisma.user.findMany({
        where: {
          id: { in: requestedParticipantIds },
        },
        select: { id: true },
      });

      if (existingUsers.length !== requestedParticipantIds.length) {
        return res.status(400).json({ error: 'One or more selected users do not exist.' });
      }

      nextParticipantIds = [req.user.id, ...requestedParticipantIds];
    }

    const currentParticipantIds = getConversationParticipantIds(conversation);
    const addedUserIds = nextParticipantIds
      ? nextParticipantIds.filter((userId) => !currentParticipantIds.includes(userId))
      : [];
    const removedUserIds = nextParticipantIds
      ? currentParticipantIds.filter((userId) => !nextParticipantIds.includes(userId))
      : [];

    const updatedConversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        name: nextName,
        ...(nextParticipantIds
          ? {
              participants: {
                deleteMany: {
                  userId: { in: removedUserIds },
                },
                create: addedUserIds.map((userId) => ({
                  userId,
                  lastReadAt: new Date(),
                })),
              },
            }
          : {}),
      },
      include: getConversationInclude(),
    });

    const io = req.app.get('io');
    if (nextParticipantIds) {
      await syncConversationRoomMembership(io, updatedConversation.id, addedUserIds, removedUserIds);
    }

    const remainingUserIds = getConversationParticipantIds(updatedConversation);
    await emitConversationSummaries(io, 'conversation_meta_updated', updatedConversation, remainingUserIds);
    removedUserIds.forEach((userId) => {
      io?.to(userId).emit('conversation_removed', { conversationId: updatedConversation.id });
    });

    res.json({
      conversation: await formatConversationWithUnread(updatedConversation, req.user.id),
    });
  } catch (err) {
    console.error('Update group conversation error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Get messages for a conversation
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseMessagesLimit(req.query.limit);
    const cursor = parseMessageCursor(req.query.cursor);
    const searchTerm = typeof req.query.search === 'string' ? req.query.search : '';
    const conversation = await getConversationById(id, req.user.id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    await markConversationAsSeen(conversation, req.user.id, req.app.get('io'));
    const messagePage = await getPaginatedMessages({
      conversationId: id,
      currentUserId: req.user.id,
      cursor,
      limit,
      searchTerm,
    });

    res.json({
      ...messagePage,
      search: searchTerm.trim(),
    });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Mark a conversation as read
router.post('/:id/read', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await getConversationById(id, req.user.id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const io = req.app.get('io');
    const readAt = await markConversationAsSeen(conversation, req.user.id, io);

    res.json({ conversationId: id, readAt: readAt || new Date() });
  } catch (err) {
    console.error('Mark conversation read error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Send a message through API fallback
router.post('/:id/messages', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, clientTempId, replyToMessageId, attachmentIds } = req.body;
    const trimmedContent = typeof content === 'string' ? content.trim() : '';

    if (!trimmedContent && (!Array.isArray(attachmentIds) || attachmentIds.length === 0)) {
      return res.status(400).json({ error: 'Message content or an attachment is required.' });
    }

    const conversation = await getConversationById(id, req.user.id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    if (clientTempId) {
      const existingMessage = await prisma.message.findFirst({
        where: {
          senderId: req.user.id,
          clientTempId,
        },
        include: getMessageInclude(),
      });

      if (existingMessage) {
        return res.status(201).json({
          message: formatMessage(existingMessage, req.user.id),
        });
      }
    }

    const replyToMessage = await validateReplyTarget(replyToMessageId, id);

    if (replyToMessageId && !replyToMessage) {
      return res.status(400).json({ error: 'Reply target not found.' });
    }

    const validAttachments = await validateAttachmentIds(attachmentIds, req.user.id);
    if (attachmentIds?.length && !validAttachments) {
      return res.status(400).json({ error: 'One or more attachments are invalid.' });
    }

    const recipientIds = getConversationRecipientIds(conversation, req.user.id);
    const deliveredAt = recipientIds.some((recipientId) => connectedUsers.has(recipientId))
      ? new Date()
      : null;

    const message = await prisma.message.create({
      data: {
        content: trimmedContent,
        clientTempId: clientTempId || null,
        replyToMessageId: replyToMessage?.id || null,
        deliveredAt,
        senderId: req.user.id,
        conversationId: id,
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

    const readUpdateData = getConversationReadUpdateData(conversation, req.user.id);
    await prisma.conversation.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        ...readUpdateData,
      },
    });

    const io = req.app.get('io');
    const conversationRoom = buildConversationRoom(id);

    io?.to(req.user.id).emit('message_ack', {
      clientTempId: clientTempId || null,
      message: formatMessage(message, req.user.id),
    });
    io?.to(conversationRoom).except(req.user.id).emit('new_message', formatMessage(message, null));
    emitConversationActivity(io, id, message, req.user.id);

    res.status(201).json({
      message: formatMessage(message, req.user.id),
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Edit a message
router.patch('/:conversationId/messages/:messageId', auth, async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    const conversation = await getConversationById(conversationId, req.user.id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const existingMessage = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      include: getMessageInclude(),
    });

    if (!existingMessage) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    if (existingMessage.senderId !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own messages.' });
    }

    if (existingMessage.deletedAt) {
      return res.status(400).json({ error: 'Deleted messages cannot be edited.' });
    }

    const message = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: content.trim(),
        editedAt: new Date(),
      },
      include: getMessageInclude(),
    });

    const io = req.app.get('io');
    emitMessageUpdate(io, conversationId, 'message_updated', message, req.user.id);

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
      },
    });

    const latestMessage = await prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    });

    if (latestMessage?.id === message.id) {
      emitConversationActivity(io, conversationId, message, req.user.id);
    }

    res.json({ message: formatMessage(message, req.user.id) });
  } catch (err) {
    console.error('Edit message error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Delete a message
router.delete('/:conversationId/messages/:messageId', auth, async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const conversation = await getConversationById(conversationId, req.user.id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const existingMessage = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      include: getMessageInclude(),
    });

    if (!existingMessage) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    if (existingMessage.senderId !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own messages.' });
    }

    if (existingMessage.deletedAt) {
      return res.json({ message: formatMessage(existingMessage, req.user.id) });
    }

    const message = await prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
      },
      include: getMessageInclude(),
    });

    const io = req.app.get('io');
    emitMessageUpdate(io, conversationId, 'message_deleted', message, req.user.id);

    const latestMessage = await prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    });

    if (latestMessage?.id === message.id) {
      emitConversationActivity(io, conversationId, message, req.user.id);
    }

    res.json({ message: formatMessage(message, req.user.id) });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

module.exports = router;
