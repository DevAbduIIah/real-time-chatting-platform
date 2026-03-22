import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';
import UserAvatar from '../components/UserAvatar';

function Settings() {
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [statusText, setStatusText] = useState(user?.statusText || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setStatusText(user?.statusText || '');
    setBio(user?.bio || '');
  }, [user]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  const currentAvatarUrl = useMemo(
    () => avatarPreview || user?.avatarUrl || null,
    [avatarPreview, user?.avatarUrl]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const profileResponse = await api.users.updateMe({
        name,
        email,
        statusText,
        bio,
      });

      let nextUser = profileResponse.user;

      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        const avatarResponse = await api.users.uploadAvatar(formData);
        nextUser = avatarResponse.user;
      }

      updateUser(nextUser);
      setAvatarFile(null);
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="theme-gradient-page min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold theme-text">Profile & Settings</h1>
            <p className="mt-2 text-sm theme-muted">
              Personalize your account, update your avatar, and choose how the app looks.
            </p>
          </div>
          <Link
            to="/chat"
            className="rounded-full border px-4 py-2 text-sm font-medium transition hover:opacity-90 theme-border theme-surface theme-text"
          >
            Back to chat
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="rounded-[1.75rem] border p-6 shadow-sm theme-border theme-surface">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <UserAvatar
                  name={user?.name}
                  avatarUrl={currentAvatarUrl}
                  size="lg"
                />
                <div className="flex-1">
                  <h2 className="text-lg font-semibold theme-text">Avatar</h2>
                  <p className="mt-1 text-sm theme-muted">
                    Upload a profile image or keep the automatic initials placeholder.
                  </p>
                </div>
                <label className="cursor-pointer rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
                  Choose image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[1.75rem] border p-6 shadow-sm theme-border theme-surface">
              <h2 className="text-lg font-semibold theme-text">Profile details</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium theme-text">Display name</label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium theme-text">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium theme-text">Status</label>
                  <input
                    value={statusText}
                    onChange={(event) => setStatusText(event.target.value)}
                    placeholder="Available for coffee and code"
                    className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium theme-text">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    rows={4}
                    className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none"
                    placeholder="Tell people a little more about you."
                  />
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border p-6 shadow-sm theme-border theme-surface">
              <h2 className="text-lg font-semibold theme-text">Appearance</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {['system', 'light', 'dark'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTheme(option)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium capitalize transition ${
                      theme === option
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'theme-border theme-surface-muted theme-text'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </section>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </form>

          <aside className="space-y-6">
            <section className="rounded-[1.75rem] border p-6 shadow-sm theme-border theme-surface">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
                Live preview
              </p>
              <div className="mt-4 flex items-center gap-4">
                <UserAvatar
                  name={name}
                  avatarUrl={currentAvatarUrl}
                  size="lg"
                />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold theme-text">{name || 'Your name'}</p>
                  <p className="truncate text-sm theme-muted">{statusText || 'Add a short status message'}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 theme-muted">
                Your avatar, display name, and status will appear throughout the app so the experience feels more personal and portfolio-ready.
              </p>
            </section>

            <section className="rounded-[1.75rem] border p-6 shadow-sm theme-border theme-surface">
              <h2 className="text-lg font-semibold theme-text">Theme notes</h2>
              <p className="mt-3 text-sm leading-6 theme-muted">
                System follows your device preference automatically. Light and dark stay locked until you switch them again here.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default Settings;
