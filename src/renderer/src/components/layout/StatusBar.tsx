import type { SessionStatus } from '../../../../shared/ipc'

type StatusBarProps = {
  sessionStatus: SessionStatus | null
  sessionError: string | null
  profileCount: number
}

function StatusBar({
  sessionStatus,
  sessionError,
  profileCount
}: StatusBarProps): React.JSX.Element {
  const connectionText = sessionStatus
    ? `${sessionStatus.state} (${sessionStatus.transport})`
    : 'idle'

  return (
    <div className="flex items-center justify-between gap-3 bg-slate-900/70 px-4 py-1 text-xs text-slate-400">
      <div className="flex min-w-0 overflow-hidden items-center gap-3">
        <span className="uppercase tracking-[0.08em] text-slate-500">Status</span>
        <span className="truncate">Connection: {connectionText}</span>
        <span className="truncate">Profiles: {profileCount}</span>
        {sessionStatus ? <span className="truncate">Messages: {sessionStatus.messageCount}</span> : null}
        {sessionError ? <span className="truncate text-rose-400">{sessionError}</span> : null}
      </div>
      <div className="shrink-0 text-slate-500">⌘N New profile · ⌘, Settings</div>
    </div>
  )
}

export default StatusBar
