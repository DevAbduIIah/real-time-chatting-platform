function EmptyState({ title, description, icon }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center px-6 py-10">
      <div className="max-w-sm text-center">
        <div className="theme-surface theme-border mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-sm">
          {icon}
        </div>
        <h3 className="theme-text text-lg font-semibold">{title}</h3>
        <p className="theme-muted mt-2 text-sm leading-6">{description}</p>
      </div>
    </div>
  );
}

export default EmptyState;
