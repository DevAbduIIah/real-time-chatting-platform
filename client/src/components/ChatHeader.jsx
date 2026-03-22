import { useSocket } from '../context/SocketContext';
import UserAvatar from './UserAvatar';
import { formatLastSeen } from '../lib/formatters';

function ChatHeader({ conversation, onMenuClick, onManageConversation, isTyping }) {
  const { isUserOnline } = useSocket();
  const directUser = conversation?.type === 'direct' ? conversation.otherUser : null;
  const online = directUser ? isUserOnline(directUser.id) : false;
  const groupParticipants = conversation?.type === 'group' ? conversation.participants || [] : [];
  const groupSubtitle = groupParticipants.length > 0
    ? `${conversation.participantCount} members - ${groupParticipants.map((participant) => participant.name).slice(0, 3).join(', ')}`
    : `${conversation?.participantCount || 1} members`;

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

        {conversation && (
          <>
            <UserAvatar
              name={conversation.type === 'group' ? conversation.name : directUser?.name}
              avatarUrl={directUser?.avatarUrl || null}
              isOnline={online}
              showStatus={conversation.type === 'direct'}
              size="md"
            />
            <div className="min-w-0">
              <h2 className="theme-text truncate font-semibold">
                {conversation.type === 'group' ? conversation.name : directUser?.name}
              </h2>
              {isTyping ? (
                <p className="text-sm font-medium text-indigo-600">typing...</p>
              ) : conversation.type === 'group' ? (
                <p className="theme-muted truncate text-sm">
                  {groupSubtitle}
                </p>
              ) : (
                <p className="theme-muted truncate text-sm">
                  {online
                    ? directUser?.statusText || 'Online'
                    : formatLastSeen(directUser?.lastSeenAt) || directUser?.email}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {conversation?.type === 'group' && (
          <button
            type="button"
            onClick={onManageConversation}
            className="theme-surface theme-border theme-text rounded-full border px-3 py-2 text-sm font-medium transition hover:bg-slate-200/70"
          >
            Manage
          </button>
        )}
      </div>
    </header>
  );
}

export default ChatHeader;
