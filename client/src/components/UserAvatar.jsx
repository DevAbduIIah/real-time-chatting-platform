import { getAssetUrl } from '../lib/api';

function getInitials(name) {
  if (!name) return '?';

  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function UserAvatar({
  name,
  avatarUrl = null,
  isOnline = false,
  size = 'md',
  showStatus = false,
}) {
  const sizeClasses = {
    sm: 'h-9 w-9 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  const statusClasses = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-3.5 w-3.5',
  };

  const resolvedAvatarUrl = getAssetUrl(avatarUrl);

  return (
    <div className="relative flex-shrink-0">
      {resolvedAvatarUrl ? (
        <img
          src={resolvedAvatarUrl}
          alt={name || 'User avatar'}
          className={`${
            sizeClasses[size] || sizeClasses.md
          } rounded-full object-cover shadow-sm ring-1 ring-black/5`}
        />
      ) : (
        <div
          className={`${
            sizeClasses[size] || sizeClasses.md
          } flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-indigo-500 to-sky-500 font-semibold text-white shadow-sm`}
        >
          {getInitials(name)}
        </div>
      )}
      {showStatus && (
        <span
          className={`${
            statusClasses[size] || statusClasses.md
          } absolute bottom-0 right-0 rounded-full border-2 border-[color:var(--surface-primary)] ${
            isOnline ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        />
      )}
    </div>
  );
}

export default UserAvatar;
