const { getConversationParticipantIds } = require('./conversation-helpers');

function getConversationRecipientIds(conversation, currentUserId) {
  return getConversationParticipantIds(conversation)
    .filter((userId) => userId !== currentUserId);
}

function getMessageInclude() {
  return {
    sender: { select: { id: true, name: true, avatarUrl: true } },
    attachments: {
      orderBy: { createdAt: 'asc' },
    },
    replyToMessage: {
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    },
  };
}

function formatAttachment(attachment) {
  return {
    id: attachment.id,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    kind: attachment.kind,
    url: attachment.url,
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
  const attachmentCount = message.attachments?.length || 0;
  const attachmentLabel = attachmentCount > 0
    ? message.attachments.some((attachment) => attachment.kind === 'image')
      ? attachmentCount > 1 ? 'sent images' : 'sent an image'
      : attachmentCount > 1 ? 'sent files' : 'sent a file'
    : null;

  return {
    id: message.id,
    content: message.deletedAt
      ? message.senderId === currentUserId
        ? 'You deleted a message'
        : 'Message deleted'
      : message.content || attachmentLabel || '',
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
    attachments: (message.attachments || []).map(formatAttachment),
  };
}

module.exports = {
  formatMessage,
  getConversationRecipientIds,
  getMessageInclude,
  getMessagePreview,
};
