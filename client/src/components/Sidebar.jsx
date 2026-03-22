import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import UserAvatar from './UserAvatar';
import EmptyState from './EmptyState';
import { ConversationListSkeleton } from './LoadingSkeletons';
import { formatConversationTime } from '../lib/formatters';

function Sidebar({
  items,
  selectedConversationId,
  onSelectItem,
  onCreateGroup,
  isOpen,
  onToggle,
  currentUser,
  onLogout,
  isLoading,
  searchQuery,
  onSearchChange,
}) {
  const navigate = useNavigate();
  const { isUserOnline } = useSocket();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`
          theme-surface fixed inset-y-0 left-0 z-30 flex w-[21rem] max-w-[88vw] flex-col border-r shadow-xl theme-border
          transform transition-transform duration-300 ease-in-out lg:static lg:shadow-none
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="border-b px-4 pb-4 pt-5 theme-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="theme-text text-xl font-bold">Messages</h1>
              <p className="theme-muted mt-1 text-sm">
                Stay on top of your latest conversations
              </p>
            </div>

            <button
              type="button"
              onClick={onCreateGroup}
              className="rounded-full bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              New group
            </button>
          </div>

          <div className="relative mt-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search conversations..."
              className="theme-input w-full rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none transition"
            />
            <svg
              className="theme-muted absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35m1.6-5.15a6.75 6.75 0 11-13.5 0 6.75 6.75 0 0113.5 0z" />
            </svg>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <ConversationListSkeleton />
          ) : items.length === 0 ? (
            <EmptyState
              title={searchQuery ? 'No conversations found' : 'No conversations yet'}
              description={
                searchQuery
                  ? 'Try a different name, group title, or message preview.'
                  : 'Start a direct chat or create a group to get things moving.'
              }
              icon={(
                <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M21 21l-4.35-4.35m1.6-5.15a6.75 6.75 0 11-13.5 0 6.75 6.75 0 0113.5 0z" />
                </svg>
              )}
            />
          ) : (
            <div className="space-y-1 p-3">
              {items.map((item) => {
                const isSelected = item.kind === 'conversation' && selectedConversationId === item.id;
                const showStatus = item.kind === 'conversation' && item.type === 'direct';
                const online = showStatus ? isUserOnline(item.otherUser?.id) : false;

                return (
                  <button
                    key={`${item.kind}-${item.id}`}
                    onClick={() => onSelectItem(item)}
                    className={`
                      w-full rounded-2xl px-3 py-3 text-left transition
                      hover:bg-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                      ${isSelected ? 'bg-indigo-500/10 ring-1 ring-indigo-400/20' : ''}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={item.title}
                        avatarUrl={item.avatarUrl}
                        isOnline={online}
                        showStatus={showStatus}
                        size="lg"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="theme-text truncate font-semibold">{item.title}</span>
                            {item.kind === 'conversation' && item.type === 'group' && (
                              <span className="ml-2 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-600">
                                Group
                              </span>
                            )}
                          </div>
                          {item.lastActivityAt && (
                            <span className="theme-muted ml-2 flex-shrink-0 text-xs font-medium">
                              {formatConversationTime(item.lastActivityAt)}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex items-center gap-2">
                          <p className="theme-muted min-w-0 flex-1 truncate text-sm">
                            {item.subtitle}
                          </p>
                          {item.unreadCount > 0 && (
                            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">
                              {item.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="theme-surface-muted border-t p-4 theme-border">
          <div className="flex items-center gap-3">
            <UserAvatar
              name={currentUser?.name}
              avatarUrl={currentUser?.avatarUrl}
              isOnline
              showStatus
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="theme-text truncate font-medium">
                {currentUser?.name || 'User'}
              </p>
              <p className="theme-muted truncate text-sm">
                {currentUser?.statusText || currentUser?.email || 'Online'}
              </p>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="rounded-full p-2 transition hover:bg-slate-200/70"
              title="Profile settings"
            >
              <svg className="theme-muted h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.983 5.5a2 2 0 100 4 2 2 0 000-4zM11.983 14.5a2 2 0 100 4 2 2 0 000-4zM5.5 11.983a2 2 0 104 0 2 2 0 00-4 0zM14.5 11.983a2 2 0 104 0 2 2 0 00-4 0z" />
              </svg>
            </button>
            <button
              onClick={handleLogout}
              className="rounded-full p-2 transition hover:bg-slate-200/70"
              title="Logout"
            >
              <svg className="theme-muted h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
