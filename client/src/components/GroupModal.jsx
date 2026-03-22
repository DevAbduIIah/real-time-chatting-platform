import { useMemo, useState } from 'react';
import UserAvatar from './UserAvatar';

function GroupModal({
  isOpen,
  mode = 'create',
  users,
  initialName = '',
  initialParticipantIds = [],
  onClose,
  onSubmit,
  isSubmitting = false,
}) {
  const [name, setName] = useState(initialName);
  const [selectedIds, setSelectedIds] = useState(initialParticipantIds);

  const selectedCountLabel = useMemo(() => {
    if (selectedIds.length === 0) {
      return 'No participants selected yet';
    }

    return `${selectedIds.length} participant${selectedIds.length === 1 ? '' : 's'} selected`;
  }, [selectedIds.length]);

  if (!isOpen) {
    return null;
  }

  const toggleUser = (userId) => {
    setSelectedIds((prev) => (
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    ));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      name: name.trim(),
      participantIds: selectedIds,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
      <div className="theme-surface theme-border w-full max-w-xl rounded-[2rem] border shadow-2xl">
        <form onSubmit={handleSubmit}>
          <div className="flex items-start justify-between gap-4 border-b px-6 py-5 theme-border">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
                {mode === 'edit' ? 'Manage group' : 'New group'}
              </p>
              <h2 className="theme-text mt-2 text-2xl font-bold">
                {mode === 'edit' ? 'Update group details' : 'Create a group chat'}
              </h2>
              <p className="theme-muted mt-1 text-sm">
                {mode === 'edit'
                  ? 'Change the name or membership without leaving the chat.'
                  : 'Pick a name and the people you want in this conversation.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="theme-muted rounded-full p-2 transition hover:bg-slate-200/70 hover:text-slate-700"
              aria-label="Close group modal"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div>
              <label htmlFor="group-name" className="theme-text block text-sm font-semibold">
                Group name
              </label>
              <input
                id="group-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Weekend crew, Project team, Study circle..."
                className="theme-input mt-2 w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="theme-text block text-sm font-semibold">
                  Participants
                </label>
                <span className="theme-muted text-xs font-medium uppercase tracking-[0.12em]">
                  {selectedCountLabel}
                </span>
              </div>

              <div className="theme-surface-muted theme-border mt-3 max-h-72 space-y-2 overflow-y-auto rounded-2xl border p-3">
                {users.map((user) => {
                  const isSelected = selectedIds.includes(user.id);

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleUser(user.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                        isSelected
                          ? 'bg-indigo-500/10 ring-1 ring-indigo-400/25'
                          : 'hover:bg-slate-200/60'
                      }`}
                    >
                      <UserAvatar
                        name={user.name}
                        avatarUrl={user.avatarUrl}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="theme-text truncate font-medium">{user.name}</p>
                        <p className="theme-muted truncate text-sm">
                          {user.statusText || user.email}
                        </p>
                      </div>
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-600 text-white'
                            : 'theme-border bg-transparent'
                        }`}
                      >
                        {isSelected && (
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t px-6 py-4 theme-border">
            <button
              type="button"
              onClick={onClose}
              className="theme-surface theme-border theme-text rounded-full border px-4 py-2 text-sm font-medium transition hover:bg-slate-200/70"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || selectedIds.length === 0}
              className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? mode === 'edit'
                  ? 'Saving...'
                  : 'Creating...'
                : mode === 'edit'
                  ? 'Save changes'
                  : 'Create group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default GroupModal;
