import type { ServerProfile } from '../../../../shared/ipc'
import type { ProfileTransport, ServerFormState } from '../../stores/server-store'

type ServerSidebarProps = {
  form: ServerFormState
  profiles: ServerProfile[]
  saveError: string | null
  setFormField: <K extends keyof ServerFormState>(field: K, value: ServerFormState[K]) => void
  onSaveProfile: () => void
  onDeleteProfile: (id: string) => void
  onConnectProfile: (profile: ServerProfile) => void
}

function ServerSidebar({
  form,
  profiles,
  saveError,
  setFormField,
  onSaveProfile,
  onDeleteProfile,
  onConnectProfile
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
          <option value="sse">SSE</option>
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
              value={form.sseUrl}
              onChange={(event) => setFormField('sseUrl', event.target.value)}
              placeholder={
                form.transport === 'sse' ? 'SSE endpoint URL' : 'Streamable HTTP endpoint URL'
              }
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            />
            <textarea
              value={form.sseHeadersRaw}
              onChange={(event) => setFormField('sseHeadersRaw', event.target.value)}
              placeholder={'Headers (optional)\nAuthorization: Bearer token\nX-Trace-Id: 123'}
              rows={3}
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            />
          </>
        )}
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
                  : `transport: sse | headers: ${Object.keys(profile.headers ?? {}).length}`}
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
            </div>
          ))
        )}
      </div>
    </>
  )
}

export default ServerSidebar
