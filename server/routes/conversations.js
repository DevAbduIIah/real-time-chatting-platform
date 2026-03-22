const express = require('express');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { connectedUsers } = require('../socket');
const { publicUserSelect } = require('./user-helpers');
const {
  formatConversationSummary,
  getConversationReadAt,
  getConversationReadUpdateData,
} = require('./conversation-helpers');
const {
  formatMessage,
  getMessageInclude,
  getMessagePreview,
  getRecipientId,
} = require('./message-helpers');

const router = express.Router();
const DEFAULT_MESSAGES_LIMIT = 30;
const MAX_MESSAGES_LIMIT = 60;

function getConversationWhereForUser(userId) {
  return {
    OR: [
      { user1Id: userId },
      { user2Id: userId },
    ],
  };
}

async function getConversationById(conversationId, userId) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      ...getConversationWhereForUser(userId),
    },
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

async function getUnreadCount(conversation, currentUserId) {
  const readAt = getConversationReadAt(conversation, currentUserId) || new Date(0);

  return prisma.message.count({
    where: {
      conversationId: conversation.id,
      senderId: { not: currentUserId },
      readAt: null,
      createdAt: { gt: readAt },
      deletedAt: null,
    },
  });
}

async function formatConversationWithUnread(conversation, currentUserId) {
  const unreadCount = await getUnreadCount(conversation, currentUserId);
  return formatConversationSummary(conversation, currentUserId, unreadCount);
}

async function markConversationAsSeen(conversation, currentUserId, io) {
  const seenAt = new Date();
  const messageRows = await prisma.message.findMany({
    where: {
      conversationId: conversation.id,
      senderId: { not: currentUserId },
      readAt: null,
    },
    select: {
      id: true,
      senderId: true,
    },
  });

  if (messageRows.length > 0) {
    const messageIds = messageRows.map((message) => message.id);

    await prisma.message.updateMany({
      where: { id: { in: messageIds } },
      data: {
        deliveredAt: seenAt,
        readAt: seenAt,
      },
    });

    const senderIds = [...new Set(messageRows.map((message) => message.senderId))];
    senderIds.forEach((senderId) => {
      io?.to(senderId).emit('messages_seen', {
        conversationId: conversation.id,
        messageIds,
        readAt: seenAt,
      });
    });
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: getConversationReadUpdateData(conversation, currentUserId, seenAt),
  });
}

async function validateReplyTarget(replyToMessageId, conversationId) {
  if (!replyToMessageId) {
    return null;
  }

  const replyMessage = await prisma.message.findFirst({
    where: {
      id: replyToMessageId,
      conversationId,
    },
    include: {
      sender: { select: { id: true, name: true } },
    },
  });

  return replyMessage;
}

function emitMessageUpdate(io, conversation, currentUserId, eventName, message) {
  const recipientId = getRecipientId(conversation, currentUserId);

  io?.to(currentUserId).emit(eventName, formatMessage(message, currentUserId));
  io?.to(recipientId).emit(eventName, formatMessage(message, recipientId));
}

// Get all conversations for the current user
router.get('/', auth, async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: getConversationWhereForUser(req.user.id),
      include: {
        user1: { select: publicUserSelect },
        user2: { select: publicUserSelect },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
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

// Get or create a conversation with another user
router.post('/', auth, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot create conversation with yourself.' });
    }

    const existingConversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { user1Id: req.user.id, user2Id: userId },
          { user1Id: userId, user2Id: req.user.id },
        ],
      },
      include: {
        user1: { select: publicUserSelect },
        user2: { select: publicUserSelect },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (existingConversation) {
      return res.json({
        conversation: await formatConversationWithUnread(existingConversation, req.user.id),
      });
    }

    const now = new Date();
    const conversation = await prisma.conversation.create({
      data: {
        user1Id: req.user.id,
        user2Id: userId,
        user1LastReadAt: now,
        user2LastReadAt: now,
      },
      include: {
        user1: { select: publicUserSelect },
        user2: { select: publicUserSelect },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    res.status(201).json({
      conversation: formatConversationSummary(conversation, req.user.id, 0),
    });
  } catch (err) {
    console.error('Create conversation error:', err);
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
    await markConversationAsSeen(conversation, req.user.id, io);

    res.json({ conversationId: id, readAt: new Date() });
  } catch (err) {
    console.error('Mark conversation read error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Send a message through API fallback
router.post('/:id/messages', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, clientTempId, replyToMessageId } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required.' });
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

    const recipientId = getRecipientId(conversation, req.user.id);
    const deliveredAt = connectedUsers.has(recipientId) ? new Date() : null;

    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        clientTempId: clientTempId || null,
        replyToMessageId: replyToMessage?.id || null,
        deliveredAt,
        senderId: req.user.id,
        conversationId: id,
      },
      include: getMessageInclude(),
    });

    await prisma.conversation.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        ...getConversationReadUpdateData(conversation, req.user.id),
      },
    });

    const io = req.app.get('io');
    io?.to(recipientId).emit('new_message', formatMessage(message, recipientId));
    io?.to(recipientId).emit('conversation_updated', {
      conversationId: id,
      lastMessage: getMessagePreview(message, recipientId),
      lastActivityAt: message.createdAt,
    });

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
    emitMessageUpdate(io, conversation, req.user.id, 'message_updated', message);

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
      const recipientId = getRecipientId(conversation, req.user.id);
      io?.to(req.user.id).emit('conversation_updated', {
        conversationId,
        lastMessage: getMessagePreview(message, req.user.id),
        lastActivityAt: message.createdAt,
      });
      io?.to(recipientId).emit('conversation_updated', {
        conversationId,
        lastMessage: getMessagePreview(message, recipientId),
        lastActivityAt: message.createdAt,
      });
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
    emitMessageUpdate(io, conversation, req.user.id, 'message_deleted', message);

    const latestMessage = await prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    });

    if (latestMessage?.id === message.id) {
      const preview = getMessagePreview(message, req.user.id);
      io?.to(req.user.id).emit('conversation_updated', {
        conversationId,
        lastMessage: preview,
        lastActivityAt: message.createdAt,
      });

      const recipientId = getRecipientId(conversation, req.user.id);
      io?.to(recipientId).emit('conversation_updated', {
        conversationId,
        lastMessage: getMessagePreview(message, recipientId),
        lastActivityAt: message.createdAt,
      });
    }

    res.json({ message: formatMessage(message, req.user.id) });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

module.exports = router;
