export function createClientTempId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

export function createPendingMessage({ content, conversationId, user, replyToMessage, attachments = [] }) {
  const clientTempId = createClientTempId();
  const createdAt = new Date().toISOString();
  const trimmedContent = content.trim();
  const previewText = trimmedContent || buildAttachmentSummaryText(attachments);

  return {
    id: clientTempId,
    clientTempId,
    content: trimmedContent,
    createdAt,
    updatedAt: createdAt,
    editedAt: null,
    deletedAt: null,
    deliveredAt: null,
    readAt: null,
    senderId: user.id,
    senderName: user.name,
    conversationId,
    isOwn: true,
    status: 'pending',
    previewText,
    attachments,
    reactions: [],
    replyToMessage: replyToMessage
      ? {
          id: replyToMessage.id,
          content: replyToMessage.previewText || replyToMessage.content,
          deletedAt: replyToMessage.deletedAt,
          senderId: replyToMessage.senderId,
          senderName: replyToMessage.senderName,
        }
      : null,
  };
}

export function upsertMessage(messageList, nextMessage) {
  const existingIndex = messageList.findIndex((message) => {
    if (nextMessage.id && message.id === nextMessage.id) {
      return true;
    }

    return Boolean(
      nextMessage.clientTempId &&
      message.clientTempId &&
      nextMessage.clientTempId === message.clientTempId
    );
  });

  if (existingIndex === -1) {
    return [...messageList, nextMessage];
  }

  return messageList.map((message, index) =>
    index === existingIndex
      ? {
          ...message,
          ...nextMessage,
        }
      : message
  );
}

export function compareMessages(leftMessage, rightMessage) {
  const leftTimestamp = new Date(leftMessage.createdAt).getTime();
  const rightTimestamp = new Date(rightMessage.createdAt).getTime();

  if (leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }

  const leftKey = leftMessage.id || leftMessage.clientTempId || '';
  const rightKey = rightMessage.id || rightMessage.clientTempId || '';

  return leftKey.localeCompare(rightKey);
}

export function mergeMessages(messageList, nextMessages) {
  return nextMessages
    .reduce((list, nextMessage) => upsertMessage(list, nextMessage), messageList)
    .sort(compareMessages);
}

export function removeMessage(messageList, targetMessage) {
  return messageList.filter((message) => {
    if (targetMessage.id && message.id === targetMessage.id) {
      return false;
    }

    if (
      targetMessage.clientTempId
      && message.clientTempId
      && targetMessage.clientTempId === message.clientTempId
    ) {
      return false;
    }

    return true;
  });
}

export function updateMessageById(messageList, messageId, updater) {
  return messageList.map((message) =>
    message.id === messageId ? updater(message) : message
  );
}
