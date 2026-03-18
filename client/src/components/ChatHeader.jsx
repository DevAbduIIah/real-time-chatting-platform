import { useSocket } from '../context/SocketContext';

function ChatHeader({ user, onMenuClick, isTyping }) {
  const { isUserOnline } = useSocket();

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-full transition"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* User info */}
        {user && (
          <>
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-medium">
                {getInitials(user.name)}
              </div>
              {isUserOnline(user.id) && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
              )}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{user.name}</h2>
              {isTyping ? (
                <p className="text-sm text-indigo-600 font-medium">typing...</p>
              ) : (
                <p className="text-sm text-gray-500">
                  {isUserOnline(user.id) ? 'Online' : user.email}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="p-2 hover:bg-gray-100 rounded-full transition">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>
    </header>
  );
}

export default ChatHeader;
