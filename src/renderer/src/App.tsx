import { useEffect } from 'react'
import { useServerStore } from './stores/server-store'
import { useSessionStore } from './stores/session-store'
import { useUIStore } from './stores/ui-store'

function App(): React.JSX.Element {
  const metaText = useUIStore((state) => state.metaText)
  const hydrateMeta = useUIStore((state) => state.hydrateMeta)

  const profiles = useServerStore((state) => state.profiles)
  const form = useServerStore((state) => state.form)
  const saveError = useServerStore((state) => state.saveError)
  const setFormField = useServerStore((state) => state.setFormField)
  const refreshProfiles = useServerStore((state) => state.refreshProfiles)
  const saveProfile = useServerStore((state) => state.saveProfile)
  const deleteProfile = useServerStore((state) => state.deleteProfile)

  const sessionStatus = useSessionStore((state) => state.sessionStatus)
  const sessionMessages = useSessionStore((state) => state.sessionMessages)
  const sessionHistory = useSessionStore((state) => state.sessionHistory)
  const sessionError = useSessionStore((state) => state.sessionError)
  const setSessionError = useSessionStore((state) => state.setSessionError)
  const refreshSessionHistory = useSessionStore((state) => state.refreshSessionHistory)
  const inspectSession = useSessionStore((state) => state.inspectSession)
  const connectProfile = useSessionStore((state) => state.connectProfile)
  const connectSseUrl = useSessionStore((state) => state.connectSseUrl)
  const disconnectActiveSession = useSessionStore((state) => state.disconnectActiveSession)
  const refreshActiveSessionMessages = useSessionStore(
    (state) => state.refreshActiveSessionMessages
  )
  const hydrateSessionList = useSessionStore((state) => state.hydrateSessionList)

  useEffect(() => {
    let mounted = true

    const load = async (): Promise<void> => {
      await Promise.all([hydrateMeta(), refreshProfiles(), hydrateSessionList()])

      if (!mounted) {
        return
      }
    }

    void load().catch((error: unknown) => {
      if (!mounted) {
        return
      }

      setSessionError(
        error instanceof Error ? error.message : 'Failed to initialize renderer state'
      )
    })

    return () => {
      mounted = false
    }
  }, [hydrateMeta, refreshProfiles, hydrateSessionList, setSessionError])

  useEffect(() => {
    if (
      !sessionStatus ||
      sessionStatus.state === 'disconnected' ||
      sessionStatus.state === 'error'
    ) {
      return
    }

    const timer = window.setInterval(() => {
      void refreshActiveSessionMessages().catch((error: unknown) => {
        setSessionError(error instanceof Error ? error.message : 'Failed to refresh session')
      })
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [refreshActiveSessionMessages, sessionStatus, setSessionError])

  return (
    <div className="h-screen bg-slate-950 text-slate-100">
      <div className="grid h-full grid-rows-[1fr_220px]">
        <div className="grid min-h-0 grid-cols-[300px_1fr]">
          <aside className="border-r border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">MCP Scope</div>
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
                onChange={(event) =>
                  setFormField('transport', event.target.value as 'stdio' | 'sse')
                }
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
              >
                <option value="stdio">Stdio</option>
                <option value="sse">SSE</option>
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
                <input
                  value={form.sseUrl}
                  onChange={(event) => setFormField('sseUrl', event.target.value)}
                  placeholder="SSE endpoint URL"
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                />
              )}
              <button
                onClick={() => {
                  void saveProfile()
                }}
                className="w-full rounded bg-slate-200 px-2 py-1 text-sm font-medium text-slate-900"
              >
                Save Profile
              </button>
              <div className="pt-2">
                <input
                  value={form.sseUrl}
                  onChange={(event) => setFormField('sseUrl', event.target.value)}
                  placeholder="SSE endpoint URL"
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                />
                <button
                  onClick={() => {
                    void connectSseUrl(form.sseUrl)
                  }}
                  className="mt-2 w-full rounded border border-slate-700 px-2 py-1 text-sm text-slate-300"
                >
                  Connect SSE URL
                </button>
              </div>
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
                      {profile.transport === 'stdio'
                        ? `${profile.command ?? ''} ${(profile.args ?? []).join(' ')}`
                        : profile.url}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {profile.transport === 'stdio' ? `cwd: ${profile.cwd}` : 'transport: sse'}
                    </p>
                    <button
                      onClick={() => {
                        void deleteProfile(profile.id)
                      }}
                      className="mt-2 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => {
                        void connectProfile(profile)
                      }}
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
                onClick={() => {
                  void refreshSessionHistory()
                }}
                className="mt-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
              >
                Refresh Sessions
              </button>
              <button
                onClick={() => {
                  void refreshActiveSessionMessages()
                }}
                className="mt-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
              >
                Refresh Messages
              </button>
              <button
                onClick={() => {
                  void disconnectActiveSession()
                }}
                className="mt-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
              >
                Disconnect Active Session
              </button>
              <div className="mt-3 max-h-40 space-y-2 overflow-auto rounded border border-slate-800 bg-slate-950/60 p-2">
                {sessionMessages.length === 0 ? (
                  <p className="text-xs text-slate-500">No captured messages yet.</p>
                ) : (
                  sessionMessages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded border border-slate-800 bg-slate-900/50 p-2"
                    >
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.08em]">
                        <span
                          className={
                            message.direction === 'outbound' ? 'text-emerald-400' : 'text-sky-400'
                          }
                        >
                          {message.direction}
                        </span>
                        <span className="text-slate-500">
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <pre className="mt-2 overflow-x-auto text-xs text-slate-300">
                        {JSON.stringify(message.payload, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 max-h-40 space-y-2 overflow-auto rounded border border-slate-800 bg-slate-950/60 p-2">
                {sessionHistory.length === 0 ? (
                  <p className="text-xs text-slate-500">No recent sessions.</p>
                ) : (
                  sessionHistory.map((session) => (
                    <button
                      key={session.sessionId}
                      onClick={() => {
                        void inspectSession(session.sessionId)
                      }}
                      className={`w-full rounded border p-2 text-left text-xs ${
                        sessionStatus.sessionId === session.sessionId
                          ? 'border-slate-500 bg-slate-800/70'
                          : 'border-slate-800 bg-slate-900/40'
                      }`}
                    >
                      <p className="font-medium text-slate-300">{session.sessionId}</p>
                      <p className="mt-1 text-slate-500">
                        {session.state} • {session.messageCount} messages
                      </p>
                    </button>
                  ))
                )}
              </div>
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
