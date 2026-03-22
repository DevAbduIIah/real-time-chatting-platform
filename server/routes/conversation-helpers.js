function getConversationOtherUser(conversation, currentUserId) {
  return conversation.user1Id === currentUserId ? conversation.user2 : conversation.user1;
}

function getConversationReadAt(conversation, currentUserId) {
  return conversation.user1Id === currentUserId
    ? conversation.user1LastReadAt
    : conversation.user2LastReadAt;
}

function getConversationReadUpdateData(conversation, currentUserId, date = new Date()) {
  return conversation.user1Id === currentUserId
    ? { user1LastReadAt: date }
    : { user2LastReadAt: date };
}

function formatConversationSummary(conversation, currentUserId, unreadCount = 0) {
  const otherUser = getConversationOtherUser(conversation, currentUserId);
  const lastMessage = conversation.messages?.[0] || null;
  const lastActivityAt = lastMessage?.createdAt || conversation.updatedAt;
  const lastMessageContent = lastMessage
    ? lastMessage.deletedAt
      ? lastMessage.senderId === currentUserId
        ? 'You deleted a message'
        : 'Message deleted'
      : lastMessage.content
    : null;

  return {
    id: conversation.id,
    otherUser,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          content: lastMessageContent,
          createdAt: lastMessage.createdAt,
          isOwn: lastMessage.senderId === currentUserId,
        }
      : null,
    unreadCount,
    lastActivityAt,
    updatedAt: conversation.updatedAt,
  };
}

module.exports = {
  formatConversationSummary,
  getConversationOtherUser,
  getConversationReadAt,
  getConversationReadUpdateData,
};
