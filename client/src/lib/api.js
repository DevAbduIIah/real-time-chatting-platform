const API_URL = 'http://localhost:5000/api';

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');

  const config = {
    headers: {
      'Content-Type': 'application/json',
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

export const api = {
  auth: {
    register: (data) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    me: () => apiRequest('/auth/me'),
  },
  users: {
    getAll: () => apiRequest('/users'),
  },
  conversations: {
    getAll: () => apiRequest('/conversations'),
    create: (userId) => apiRequest('/conversations', { method: 'POST', body: JSON.stringify({ userId }) }),
    getMessages: (id) => apiRequest(`/conversations/${id}/messages`),
    sendMessage: (id, content) => apiRequest(`/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
  },
};
