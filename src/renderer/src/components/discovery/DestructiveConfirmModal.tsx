type DestructiveConfirmModalProps = {
  toolName: string
  toolTitle?: string
  onConfirm: () => void
  onCancel: () => void
}

function DestructiveConfirmModal({
  toolName,
  toolTitle,
  onConfirm,
  onCancel
}: DestructiveConfirmModalProps): React.JSX.Element {
  const displayName = toolTitle && toolTitle !== toolName ? `${toolTitle} (${toolName})` : toolName
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md space-y-3 rounded border border-rose-900 bg-slate-950 p-4">
        <div>
          <p className="text-sm font-semibold text-rose-300">Destructive tool invocation</p>
          <p className="mt-1 text-xs text-slate-400">
            The server marked <span className="font-mono text-slate-200">{displayName}</span> as
            destructive. It may make irreversible changes. Annotations come from an untrusted server
            and are hints, not guarantees — review the arguments before proceeding.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded border border-rose-700 bg-rose-900/40 px-3 py-1 text-xs font-semibold text-rose-100"
          >
            Invoke anyway
          </button>
        </div>
      </div>
    </div>
  )
}

export default DestructiveConfirmModal
