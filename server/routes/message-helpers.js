function getRecipientId(conversation, currentUserId) {
  return conversation.user1Id === currentUserId
    ? conversation.user2Id
    : conversation.user1Id;
}

function normalizeAttachmentIds(attachmentIds) {
  if (!Array.isArray(attachmentIds)) {
    return [];
  }

  return [...new Set(attachmentIds.filter(Boolean))];
}

function orderAttachmentsByIds(attachments, attachmentIds) {
  if (!attachmentIds.length) {
    return attachments;
  }

  const attachmentMap = new Map(attachments.map((attachment) => [attachment.id, attachment]));
  return attachmentIds
    .map((attachmentId) => attachmentMap.get(attachmentId))
    .filter(Boolean);
}

async function resolvePendingAttachments(prismaClient, attachmentIds, userId) {
  const normalizedAttachmentIds = normalizeAttachmentIds(attachmentIds);

  if (normalizedAttachmentIds.length === 0) {
    return [];
  }

  const attachments = await prismaClient.attachment.findMany({
    where: {
      id: { in: normalizedAttachmentIds },
      uploadedById: userId,
      messageId: null,
    },
  });

  return orderAttachmentsByIds(attachments, normalizedAttachmentIds);
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

function buildAttachmentSummaryText(attachments = []) {
  if (!attachments.length) {
    return '';
  }

  const imageCount = attachments.filter((attachment) => attachment.kind === 'image').length;
  const fileCount = attachments.length - imageCount;

  if (attachments.length === 1) {
    return imageCount === 1 ? 'Sent an image' : 'Sent a file';
  }

  if (imageCount === attachments.length) {
    return `Sent ${attachments.length} images`;
  }

  if (fileCount === attachments.length) {
    return `Sent ${attachments.length} files`;
  }

  return `Sent ${attachments.length} attachments`;
}

function buildMessageDisplayText(message, currentUserId) {
  if (message.deletedAt) {
    return message.senderId === currentUserId
      ? 'You deleted a message'
      : 'Message deleted';
  }

  const trimmedContent = message.content?.trim();
  if (trimmedContent) {
    return trimmedContent;
  }

  return buildAttachmentSummaryText(message.attachments || []);
}

function formatReactions(reactions = [], currentUserId) {
  const groupedReactions = new Map();

  reactions.forEach((reaction) => {
    const existingReaction = groupedReactions.get(reaction.emoji);

    if (!existingReaction) {
      groupedReactions.set(reaction.emoji, {
        emoji: reaction.emoji,
        count: 1,
        reactedByMe: reaction.userId === currentUserId,
      });
      return;
    }

    existingReaction.count += 1;
    existingReaction.reactedByMe = existingReaction.reactedByMe || reaction.userId === currentUserId;
  });

  return Array.from(groupedReactions.values()).sort((leftReaction, rightReaction) =>
    leftReaction.emoji.localeCompare(rightReaction.emoji)
  );
}

function getMessageInclude() {
  return {
    sender: { select: { id: true, name: true, avatarUrl: true } },
    attachments: {
      orderBy: { createdAt: 'asc' },
    },
    reactions: {
      orderBy: [
        { emoji: 'asc' },
        { createdAt: 'asc' },
      ],
    },
    replyToMessage: {
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    },
  };
}

function formatReplyMessage(replyMessage, currentUserId) {
  if (!replyMessage) {
    return null;
  }

  return {
    id: replyMessage.id,
    content: replyMessage.deletedAt ? '' : buildMessageDisplayText(replyMessage, currentUserId),
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
    content: buildMessageDisplayText(message, currentUserId),
    createdAt: message.createdAt,
    isOwn: message.senderId === currentUserId,
  };
}

function formatMessage(message, currentUserId) {
  const isOwn = message.senderId === currentUserId;
  const previewText = buildMessageDisplayText(message, currentUserId);

  return {
    id: message.id,
    clientTempId: message.clientTempId || null,
    content: message.deletedAt ? '' : (message.content || ''),
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
    previewText,
    attachments: (message.attachments || []).map(formatAttachment),
    reactions: formatReactions(message.reactions || [], currentUserId),
    replyToMessage: formatReplyMessage(message.replyToMessage, currentUserId),
  };
}

module.exports = {
  buildAttachmentSummaryText,
  formatMessage,
  getMessageInclude,
  getMessagePreview,
  getRecipientId,
  normalizeAttachmentIds,
  resolvePendingAttachments,
};
