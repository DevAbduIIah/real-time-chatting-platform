const express = require('express');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all conversations for the current user
router.get('/', auth, async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { user1Id: req.user.id },
          { user2Id: req.user.id },
        ],
      },
      include: {
        user1: { select: { id: true, name: true, email: true } },
        user2: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Transform to include the other user info
    const formattedConversations = conversations.map((conv) => {
      const otherUser = conv.user1Id === req.user.id ? conv.user2 : conv.user1;
      const lastMessage = conv.messages[0] || null;

      return {
        id: conv.id,
        otherUser,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              createdAt: lastMessage.createdAt,
              isOwn: lastMessage.senderId === req.user.id,
            }
          : null,
        updatedAt: conv.updatedAt,
      };
    });

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

    // Check if conversation already exists
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { user1Id: req.user.id, user2Id: userId },
          { user1Id: userId, user2Id: req.user.id },
        ],
      },
      include: {
        user1: { select: { id: true, name: true, email: true } },
        user2: { select: { id: true, name: true, email: true } },
      },
    });

    if (existingConversation) {
      const otherUser =
        existingConversation.user1Id === req.user.id
          ? existingConversation.user2
          : existingConversation.user1;

      return res.json({
        conversation: {
          id: existingConversation.id,
          otherUser,
        },
      });
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        user1Id: req.user.id,
        user2Id: userId,
      },
      include: {
        user1: { select: { id: true, name: true, email: true } },
        user2: { select: { id: true, name: true, email: true } },
      },
    });

    const otherUser =
      conversation.user1Id === req.user.id ? conversation.user2 : conversation.user1;

    res.status(201).json({
      conversation: {
        id: conversation.id,
        otherUser,
      },
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

    // Verify user is part of the conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        OR: [
          { user1Id: req.user.id },
          { user2Id: req.user.id },
        ],
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true } },
      },
    });

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      createdAt: msg.createdAt,
      senderId: msg.senderId,
      senderName: msg.sender.name,
      isOwn: msg.senderId === req.user.id,
    }));

    res.json({ messages: formattedMessages });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Send a message
router.post('/:id/messages', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    // Verify user is part of the conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        OR: [
          { user1Id: req.user.id },
          { user2Id: req.user.id },
        ],
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    // Create message and update conversation timestamp
    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        senderId: req.user.id,
        conversationId: id,
      },
      include: {
        sender: { select: { id: true, name: true } },
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    res.status(201).json({
      message: {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        senderId: message.senderId,
        senderName: message.sender.name,
        isOwn: true,
      },
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

module.exports = router;
