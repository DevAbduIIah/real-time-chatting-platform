export function createClientTempId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createPendingMessage({ content, conversationId, user, replyToMessage }) {
  const clientTempId = createClientTempId();
  const createdAt = new Date().toISOString();

  return {
    id: clientTempId,
    clientTempId,
    content,
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
    replyToMessage: replyToMessage
      ? {
          id: replyToMessage.id,
          content: replyToMessage.content,
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

export function updateMessageById(messageList, messageId, updater) {
  return messageList.map((message) =>
    message.id === messageId ? updater(message) : message
  );
}
