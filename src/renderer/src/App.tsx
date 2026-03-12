import { useEffect, useState } from 'react'
import type { ServerProfile, SessionStatus } from '../../shared/ipc'

function App(): React.JSX.Element {
  const [metaText, setMetaText] = useState('Loading runtime metadata...')
  const [profiles, setProfiles] = useState<ServerProfile[]>([])
  const [name, setName] = useState('')
  const [command, setCommand] = useState('npx')
  const [argsRaw, setArgsRaw] = useState('')
  const [cwd, setCwd] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const refreshProfiles = async (): Promise<void> => {
    const items = await window.api.listServerProfiles()
    setProfiles(items)
  }

  useEffect(() => {
    let mounted = true

    const load = async (): Promise<void> => {
      try {
        const [meta, ping] = await Promise.all([window.api.getAppMeta(), window.api.ping()])
        if (!mounted) {
          return
        }

        const items = await window.api.listServerProfiles()
        if (!mounted) {
          return
        }

        setProfiles(items)
        setMetaText(
          `${meta.name} v${meta.version} on ${meta.platform} (ipc ok: ${ping.ok ? 'yes' : 'no'})`
        )
      } catch {
        if (mounted) {
          setMetaText('IPC unavailable')
          setSaveError('Could not initialize profile storage')
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  const handleSaveProfile = async (): Promise<void> => {
    setSaveError(null)

    try {
      const args = argsRaw
        .split(' ')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)

      await window.api.upsertServerProfile({
        name,
        command,
        args,
        cwd
      })

      setName('')
      setArgsRaw('')

      await refreshProfiles()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save profile')
    }
  }

  const handleDeleteProfile = async (id: string): Promise<void> => {
    await window.api.deleteServerProfile({ id })
    await refreshProfiles()
  }

  const handleConnectProfile = async (profile: ServerProfile): Promise<void> => {
    setSessionError(null)

    try {
      const connected = await window.api.connectSession({
        transport: 'stdio',
        stdio: {
          command: profile.command,
          args: profile.args,
          cwd: profile.cwd
        }
      })

      const status = await window.api.getSessionStatus({ sessionId: connected.sessionId })
      setSessionStatus(status)
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : 'Failed to connect')
    }
  }

  const handleDisconnectSession = async (): Promise<void> => {
    if (!sessionStatus) {
      return
    }

    setSessionError(null)

    try {
      await window.api.disconnectSession({ sessionId: sessionStatus.sessionId })
      const status = await window.api.getSessionStatus({ sessionId: sessionStatus.sessionId })
      setSessionStatus(status)
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : 'Failed to disconnect')
    }
  }

  return (
    <div className="h-screen bg-slate-950 text-slate-100">
      <div className="grid h-full grid-rows-[1fr_220px]">
        <div className="grid min-h-0 grid-cols-[300px_1fr]">
          <aside className="border-r border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">MCP Scope</div>
            <h1 className="mt-2 text-lg font-semibold">Servers</h1>

            <div className="mt-4 space-y-2 rounded border border-slate-800 bg-slate-950/60 p-3">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Profile name"
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
              />
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="Command"
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
              />
              <input
                value={argsRaw}
                onChange={(event) => setArgsRaw(event.target.value)}
                placeholder="Args (space separated)"
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
              />
              <input
                value={cwd}
                onChange={(event) => setCwd(event.target.value)}
                placeholder="Working directory"
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
              />
              <button
                onClick={handleSaveProfile}
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
                  <div
                    key={profile.id}
                    className="rounded border border-slate-800 bg-slate-950/50 p-3"
                  >
                    <p className="text-sm font-medium">{profile.name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {profile.command} {profile.args.join(' ')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">cwd: {profile.cwd}</p>
                    <button
                      onClick={() => handleDeleteProfile(profile.id)}
                      className="mt-2 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handleConnectProfile(profile)}
                      className="mt-2 ml-2 rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-900"
                    >
                      Connect
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>

          <main className="p-6">
            <div className="rounded border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-base font-semibold">Workspace</h2>
              <p className="mt-2 text-sm text-slate-400">
                Foundation scaffold is ready. Secure IPC, persistence, and MCP session features are
                next.
              </p>
              <p className="mt-3 text-xs text-slate-500">{metaText}</p>
            </div>
          </main>
        </div>

        <section className="border-t border-slate-800 bg-slate-950/80 p-4">
          <h3 className="text-sm font-medium text-slate-300">Protocol Inspector</h3>
          {sessionStatus ? (
            <div className="mt-2 space-y-1 text-sm text-slate-400">
              <p>Session: {sessionStatus.sessionId}</p>
              <p>State: {sessionStatus.state}</p>
              <p>Messages: {sessionStatus.messageCount}</p>
              <button
                onClick={handleDisconnectSession}
                className="mt-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
              >
                Disconnect Active Session
              </button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No session traffic yet.</p>
          )}
          {sessionError ? <p className="mt-2 text-xs text-rose-400">{sessionError}</p> : null}
        </section>
      </div>
    </div>
  )
}

export default App
