import type { SessionStatus } from '../../../../shared/ipc'

type WorkspacePanelProps = {
  metaText: string
  profileCount: number
  sessionStatus: SessionStatus | null
  sessionError: string | null
}

function WorkspacePanel({
  metaText,
  profileCount,
  sessionStatus,
  sessionError
}: WorkspacePanelProps): React.JSX.Element {
  const hasProfiles = profileCount > 0
  const isConnected =
    sessionStatus !== null &&
    sessionStatus.state !== 'disconnected' &&
    sessionStatus.state !== 'error'

  return (
    <div className="rounded border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-base font-semibold">Workspace</h2>

      {!hasProfiles ? (
        <div className="mt-3 rounded border border-dashed border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-400">
          Add your first server profile from the sidebar to begin a new MCP session.
        </div>
      ) : null}

      {hasProfiles && !isConnected ? (
        <div className="mt-3 rounded border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-400">
          Select a saved profile and click Connect to start capturing protocol traffic.
        </div>
      ) : null}

      {isConnected && sessionStatus ? (
        <div className="mt-3 rounded border border-emerald-900/60 bg-emerald-950/20 p-3 text-sm text-emerald-200">
          Active session: {sessionStatus.sessionId}
          <div className="mt-1 text-xs text-emerald-300/90">
            Transport {sessionStatus.transport} · State {sessionStatus.state} · Messages{' '}
            {sessionStatus.messageCount}
          </div>
        </div>
      ) : null}

      {sessionError ? (
        <div className="mt-3 rounded border border-rose-900/70 bg-rose-950/20 p-3 text-sm text-rose-300">
          {sessionError}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-slate-500">{metaText}</p>
    </div>
  )
}

export default WorkspacePanel
