export function ConversationListSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="flex animate-pulse items-center gap-3 rounded-2xl px-3 py-3"
        >
          <div className="theme-skeleton h-12 w-12 rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="theme-skeleton mb-2 h-4 w-32 rounded" />
            <div className="theme-skeleton-soft h-3 w-44 max-w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageListSkeleton() {
  return (
    <div className="theme-surface-muted flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
      {Array.from({ length: 5 }).map((_, index) => {
        const isOwn = index % 2 === 0;

        return (
          <div
            key={index}
            className={`flex animate-pulse ${isOwn ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-3xl px-4 py-3 ${
                isOwn ? 'bg-indigo-300/50' : 'theme-surface shadow-sm ring-1 ring-[color:var(--border-subtle)]'
              }`}
            >
              <div className="theme-skeleton-soft h-4 w-44 max-w-full rounded" />
              <div className="theme-skeleton mt-2 h-3 w-16 rounded" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
