function getRecipientId(conversation, currentUserId) {
  return conversation.user1Id === currentUserId
    ? conversation.user2Id
    : conversation.user1Id;
}

function getMessageInclude() {
  return {
    sender: { select: { id: true, name: true, avatarUrl: true } },
    replyToMessage: {
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    },
  };
}

function formatReplyMessage(replyMessage) {
  if (!replyMessage) {
    return null;
  }

  return {
    id: replyMessage.id,
    content: replyMessage.deletedAt ? '' : replyMessage.content,
    deletedAt: replyMessage.deletedAt,
    senderId: replyMessage.senderId,
    senderName: replyMessage.sender?.name || 'Unknown user',
    senderAvatarUrl: replyMessage.sender?.avatarUrl || null,
  };
}

function formatReceiptStatus(message, isOwn) {
  if (!isOwn) {
    return null;
  }

  if (message.readAt) {
    return 'seen';
  }

  if (message.deliveredAt) {
    return 'delivered';
  }

  return 'sent';
}

function getMessagePreview(message, currentUserId) {
  return {
    id: message.id,
    content: message.deletedAt
      ? message.senderId === currentUserId
        ? 'You deleted a message'
        : 'Message deleted'
      : message.content,
    createdAt: message.createdAt,
    isOwn: message.senderId === currentUserId,
  };
}

function formatMessage(message, currentUserId) {
  const isOwn = message.senderId === currentUserId;

  return {
    id: message.id,
    clientTempId: message.clientTempId || null,
    content: message.deletedAt ? '' : message.content,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt || message.createdAt,
    editedAt: message.editedAt,
    deletedAt: message.deletedAt,
    deliveredAt: message.deliveredAt,
    readAt: message.readAt,
    senderId: message.senderId,
    senderName: message.sender?.name || 'Unknown user',
    senderAvatarUrl: message.sender?.avatarUrl || null,
    conversationId: message.conversationId,
    isOwn,
    status: formatReceiptStatus(message, isOwn),
    replyToMessage: formatReplyMessage(message.replyToMessage),
  };
}

module.exports = {
  formatMessage,
  getMessageInclude,
  getMessagePreview,
  getRecipientId,
};
