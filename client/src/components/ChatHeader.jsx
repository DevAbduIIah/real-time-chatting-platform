import { useSocket } from '../context/SocketContext';
import UserAvatar from './UserAvatar';
import { formatLastSeen } from '../lib/formatters';

function ChatHeader({ user, onMenuClick, isTyping }) {
  const { isUserOnline } = useSocket();
  const online = user ? isUserOnline(user.id) : false;

  return (
    <header className="theme-surface flex h-[4.5rem] flex-shrink-0 items-center justify-between border-b px-4 backdrop-blur sm:px-5 theme-border">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-full p-2 transition hover:bg-slate-200/70 lg:hidden"
        >
          <svg className="theme-muted h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {user && (
          <>
            <UserAvatar
              name={user.name}
              avatarUrl={user.avatarUrl}
              isOnline={online}
              showStatus
              size="md"
            />
            <div className="min-w-0">
              <h2 className="theme-text truncate font-semibold">{user.name}</h2>
              {isTyping ? (
                <p className="text-sm font-medium text-indigo-600">typing...</p>
              ) : (
                <p className="theme-muted truncate text-sm">
                  {online
                    ? user.statusText || 'Online'
                    : formatLastSeen(user.lastSeenAt) || user.email}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button className="rounded-full p-2 transition hover:bg-slate-200/70">
          <svg className="theme-muted h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>
    </header>
  );
}

export default ChatHeader;
