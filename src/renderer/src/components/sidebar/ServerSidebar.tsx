import { useState } from 'react'
import type { ServerProfile } from '../../../../shared/ipc'
import type { ProfileTransport, ServerFormState } from '../../stores/server-store'
import { stringifyRoots } from '../../stores/server-store-utils'

type ServerSidebarProps = {
  form: ServerFormState
  profiles: ServerProfile[]
  saveError: string | null
  setFormField: <K extends keyof ServerFormState>(field: K, value: ServerFormState[K]) => void
  onSaveProfile: () => void
  onDeleteProfile: (id: string) => void
  onConnectProfile: (profile: ServerProfile) => void
  onUpdateRoots: (profileId: string, rootsRaw: string) => Promise<void>
}

function RootsEditor({
  profile,
  onUpdateRoots
}: {
  profile: ServerProfile
  onUpdateRoots: (profileId: string, rootsRaw: string) => Promise<void>
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => stringifyRoots(profile.roots))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onSave = async (): Promise<void> => {
    setError(null)
    setSaving(true)
    try {
      await onUpdateRoots(profile.id, draft)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update roots')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setDraft(stringifyRoots(profile.roots))
          setError(null)
          setOpen(true)
        }}
        className="mt-2 ml-2 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
      >
        Roots ({profile.roots.length})
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-1">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={3}
        placeholder={'file:///path/to/workspace\nlabel|file:///path/with-name'}
        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-mono"
      />
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      <div className="flex gap-2">
        <button
          onClick={() => void onSave()}
          disabled={saving}
          className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-900 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Roots'}
        </button>
        <button
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function ServerSidebar({
  form,
  profiles,
  saveError,
  setFormField,
  onSaveProfile,
  onDeleteProfile,
  onConnectProfile,
  onUpdateRoots
}: ServerSidebarProps): React.JSX.Element {
  return (
    <>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Protocol Forge</div>
      <h1 className="mt-2 text-lg font-semibold">Servers</h1>

      <div className="mt-4 space-y-2 rounded border border-slate-800 bg-slate-950/60 p-3">
        <input
          value={form.name}
          onChange={(event) => setFormField('name', event.target.value)}
          placeholder="Profile name"
          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
        />
        <select
          value={form.transport}
          onChange={(event) => setFormField('transport', event.target.value as ProfileTransport)}
          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
        >
          <option value="stdio">Stdio</option>
          <option value="streamable-http">Streamable HTTP</option>
        </select>
        {form.transport === 'stdio' ? (
          <>
            <input
              value={form.command}
              onChange={(event) => setFormField('command', event.target.value)}
              placeholder="Command"
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            />
            <input
              value={form.argsRaw}
              onChange={(event) => setFormField('argsRaw', event.target.value)}
              placeholder="Args (space separated)"
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            />
            <input
              value={form.cwd}
              onChange={(event) => setFormField('cwd', event.target.value)}
              placeholder="Working directory"
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            />
          </>
        ) : (
          <>
            <input
              value={form.httpUrl}
              onChange={(event) => setFormField('httpUrl', event.target.value)}
              placeholder="Streamable HTTP endpoint URL"
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            />
            <textarea
              value={form.httpHeadersRaw}
              onChange={(event) => setFormField('httpHeadersRaw', event.target.value)}
              placeholder={'Headers (optional)\nAuthorization: Bearer token\nX-Trace-Id: 123'}
              rows={3}
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            />
          </>
        )}
        <textarea
          value={form.rootsRaw}
          onChange={(event) => setFormField('rootsRaw', event.target.value)}
          placeholder={'Roots (optional, one file:// URI per line)\nfile:///path/to/workspace'}
          rows={2}
          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
        />
        <button
          onClick={onSaveProfile}
          className="w-full rounded bg-slate-200 px-2 py-1 text-sm font-medium text-slate-900"
        >
          Save Profile
        </button>
        {saveError ? <p className="text-xs text-rose-400">{saveError}</p> : null}
      </div>

      <div className="mt-3 space-y-2">
        {profiles.length === 0 ? (
          <div className="rounded border border-dashed border-slate-700 p-3 text-sm text-slate-400">
            No servers configured yet.
          </div>
        ) : (
          profiles.map((profile) => (
            <div key={profile.id} className="rounded border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-sm font-medium">{profile.name}</p>
              <p className="mt-1 text-xs text-slate-400">
                {profile.transport === 'stdio'
                  ? `${profile.command ?? ''} ${(profile.args ?? []).join(' ')}`
                  : profile.url}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {profile.transport === 'stdio'
                  ? `cwd: ${profile.cwd}`
                  : `transport: ${profile.transport} | headers: ${Object.keys(profile.headers ?? {}).length}`}
              </p>
              <button
                onClick={() => onDeleteProfile(profile.id)}
                className="mt-2 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
              >
                Delete
              </button>
              <button
                onClick={() => onConnectProfile(profile)}
                className="mt-2 ml-2 rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-900"
              >
                Connect
              </button>
              <RootsEditor profile={profile} onUpdateRoots={onUpdateRoots} />
            </div>
          ))
        )}
      </div>
    </>
  )
}

export default ServerSidebar
