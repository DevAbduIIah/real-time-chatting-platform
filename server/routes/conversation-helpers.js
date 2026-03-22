const { publicUserSelect } = require('./user-helpers');

function isGroupConversation(conversation) {
  return conversation.type === 'group';
}

function buildConversationRoom(conversationId) {
  return `conversation:${conversationId}`;
}

function getConversationInclude() {
  return {
    user1: { select: publicUserSelect },
    user2: { select: publicUserSelect },
    participants: {
      include: {
        user: { select: publicUserSelect },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    },
    messages: {
      orderBy: { createdAt: 'desc' },
      take: 1,
    },
  };
}

function getConversationParticipantEntries(conversation) {
  if (conversation.participants?.length) {
    return conversation.participants.map((participant) => ({
      userId: participant.userId,
      user: participant.user,
      joinedAt: participant.joinedAt,
      lastReadAt: participant.lastReadAt,
      role: participant.role,
    }));
  }

  const entries = [];

  if (conversation.user1Id && conversation.user1) {
    entries.push({
      userId: conversation.user1Id,
      user: conversation.user1,
      joinedAt: conversation.createdAt,
      lastReadAt: conversation.user1LastReadAt,
      role: 'member',
    });
  }

  if (conversation.user2Id && conversation.user2) {
    entries.push({
      userId: conversation.user2Id,
      user: conversation.user2,
      joinedAt: conversation.createdAt,
      lastReadAt: conversation.user2LastReadAt,
      role: 'member',
    });
  }

  return entries;
}

function getConversationParticipantIds(conversation) {
  return getConversationParticipantEntries(conversation).map((participant) => participant.userId);
}

function getConversationOtherUser(conversation, currentUserId) {
  return getConversationParticipantEntries(conversation)
    .find((participant) => participant.userId !== currentUserId)?.user || null;
}

function getConversationReadAt(conversation, currentUserId) {
  const participant = getConversationParticipantEntries(conversation)
    .find((entry) => entry.userId === currentUserId);

  if (participant) {
    return participant.lastReadAt;
  }

  return null;
}

function getConversationReadUpdateData(conversation, currentUserId, date = new Date()) {
  const participant = conversation.participants?.find((entry) => entry.userId === currentUserId);

  if (participant) {
    return {
      participants: {
        update: {
          where: {
            conversationId_userId: {
              conversationId: conversation.id,
              userId: currentUserId,
            },
          },
          data: {
            lastReadAt: date,
          },
        },
      },
    };
  }

  if (conversation.user1Id === currentUserId) {
    return { user1LastReadAt: date };
  }

  if (conversation.user2Id === currentUserId) {
    return { user2LastReadAt: date };
  }

  return {};
}

function getConversationDisplayName(conversation, currentUserId) {
  if (isGroupConversation(conversation)) {
    const participantEntries = getConversationParticipantEntries(conversation)
      .filter((participant) => participant.userId !== currentUserId);
    const fallbackName = participantEntries
      .map((participant) => participant.user?.name)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');

    return conversation.name || fallbackName || 'Untitled group';
  }

  return getConversationOtherUser(conversation, currentUserId)?.name || 'Conversation';
}

function getLastMessagePreview(lastMessage, currentUserId) {
  if (!lastMessage) {
    return null;
  }

  return {
    id: lastMessage.id,
    content: lastMessage.deletedAt
      ? lastMessage.senderId === currentUserId
        ? 'You deleted a message'
        : 'Message deleted'
      : lastMessage.content,
    createdAt: lastMessage.createdAt,
    isOwn: lastMessage.senderId === currentUserId,
  };
}

function formatConversationSummary(conversation, currentUserId, unreadCount = 0) {
  const participantEntries = getConversationParticipantEntries(conversation);
  const visibleParticipants = participantEntries
    .filter((participant) => participant.userId !== currentUserId)
    .map((participant) => participant.user)
    .filter(Boolean);
  const lastMessage = conversation.messages?.[0] || null;
  const lastActivityAt = lastMessage?.createdAt || conversation.updatedAt;

  return {
    id: conversation.id,
    type: conversation.type || 'direct',
    name: isGroupConversation(conversation)
      ? getConversationDisplayName(conversation, currentUserId)
      : null,
    otherUser: isGroupConversation(conversation)
      ? null
      : getConversationOtherUser(conversation, currentUserId),
    participants: visibleParticipants,
    participantCount: participantEntries.length,
    lastMessage: getLastMessagePreview(lastMessage, currentUserId),
    unreadCount,
    lastActivityAt,
    updatedAt: conversation.updatedAt,
  };
}

module.exports = {
  buildConversationRoom,
  formatConversationSummary,
  getConversationDisplayName,
  getConversationInclude,
  getConversationOtherUser,
  getConversationParticipantEntries,
  getConversationParticipantIds,
  getConversationReadAt,
  getConversationReadUpdateData,
  isGroupConversation,
};
