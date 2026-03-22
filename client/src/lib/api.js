const API_ROOT = 'http://localhost:5000';
const API_URL = `${API_ROOT}/api`;

export function getAssetUrl(assetPath) {
  if (!assetPath) {
    return null;
  }

  if (
    assetPath.startsWith('http://')
    || assetPath.startsWith('https://')
    || assetPath.startsWith('blob:')
    || assetPath.startsWith('data:')
  ) {
    return assetPath;
  }

  return `${API_ROOT}${assetPath}`;
}

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const isFormData = options.body instanceof FormData;

  const config = {
    headers: {
      ...(!isFormData && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_URL}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}

function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.set(key, value);
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export const api = {
  auth: {
    register: (data) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    me: () => apiRequest('/auth/me'),
  },
  users: {
    getAll: () => apiRequest('/users'),
    updateMe: (data) => apiRequest('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
    uploadAvatar: (formData) => apiRequest('/users/me/avatar', { method: 'POST', body: formData }),
  },
  uploads: {
    uploadAttachment: (formData) => apiRequest('/uploads', { method: 'POST', body: formData }),
  },
  conversations: {
    getAll: () => apiRequest('/conversations'),
    create: (userId) => apiRequest('/conversations', { method: 'POST', body: JSON.stringify({ userId }) }),
    createGroup: (data) => apiRequest('/conversations/group', { method: 'POST', body: JSON.stringify(data) }),
    updateGroup: (id, data) => apiRequest(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    getMessages: (id, params = {}) =>
      apiRequest(`/conversations/${id}/messages${buildQueryString(params)}`),
    markRead: (id) => apiRequest(`/conversations/${id}/read`, { method: 'POST' }),
    sendMessage: (id, data) => apiRequest(`/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify(data) }),
    editMessage: (conversationId, messageId, content) =>
      apiRequest(`/conversations/${conversationId}/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      }),
    deleteMessage: (conversationId, messageId) =>
      apiRequest(`/conversations/${conversationId}/messages/${messageId}`, {
        method: 'DELETE',
      }),
  },
};
