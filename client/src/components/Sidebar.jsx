import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';

function Sidebar({ users, selectedUser, onSelectUser, isOpen, onToggle, currentUser, onLogout }) {
  const navigate = useNavigate();
  const { isUserOnline } = useSocket();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-80 bg-white border-r border-gray-200
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Messages</h1>
          </div>
          {/* Search */}
          <div className="mt-4 relative">
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-lg border-0 focus:ring-2 focus:ring-indigo-500 outline-none transition"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {users.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>No users available</p>
            </div>
          ) : (
            users.map((user) => (
              <button
                key={user.id}
                onClick={() => onSelectUser(user)}
                className={`
                  w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition
                  ${selectedUser?.id === user.id ? 'bg-indigo-50 border-r-2 border-indigo-600' : ''}
                `}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-medium">
                    {getInitials(user.name)}
                  </div>
                  {isUserOnline(user.id) && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 truncate">{user.name}</span>
                    {user.lastMessageTime && (
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                        {formatTime(user.lastMessageTime)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-1">
                    {user.lastMessage || (user.hasConversation ? 'No messages yet' : 'Start a conversation')}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Current user */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium text-sm">
              {currentUser ? getInitials(currentUser.name) : '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {currentUser?.name || 'User'}
              </p>
              <p className="text-sm text-gray-500">Online</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-200 rounded-full transition"
              title="Logout"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
