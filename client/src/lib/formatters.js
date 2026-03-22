function formatRuntimeTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatRuntimeDate(date, options) {
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

export function formatConversationTime(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return formatRuntimeTime(date);
  }

  if (diffDays === 1) {
    return 'Yesterday';
  }

  if (diffDays < 7) {
    return formatRuntimeDate(date, { weekday: 'short' });
  }

  return formatRuntimeDate(date, { month: 'short', day: 'numeric' });
}

export function formatMessageTime(dateString) {
  if (!dateString) return '';

  return formatRuntimeTime(new Date(dateString));
}

export function formatMessageDateLabel(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = date.toDateString() === today.toDateString();
  const sameAsYesterday = date.toDateString() === yesterday.toDateString();

  if (sameDay) {
    return 'Today';
  }

  if (sameAsYesterday) {
    return 'Yesterday';
  }

  return formatRuntimeDate(date, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

export function formatLastSeen(dateString) {
  if (!dateString) {
    return 'Offline';
  }

  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const time = formatRuntimeTime(date);

  if (date.toDateString() === today.toDateString()) {
    return `Last seen today at ${time}`;
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return `Last seen yesterday at ${time}`;
  }

  return `Last seen ${formatRuntimeDate(date, {
    month: 'short',
    day: 'numeric',
  })} at ${time}`;
}

export function formatFileSize(sizeInBytes) {
  if (typeof sizeInBytes !== 'number' || Number.isNaN(sizeInBytes)) {
    return '';
  }

  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = sizeInBytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
