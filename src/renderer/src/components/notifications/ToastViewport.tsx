import { useToastStore } from '../../stores/toast-store'

const kindStyles: Record<'info' | 'success' | 'error', string> = {
  info: 'border-slate-700/90 bg-slate-900/95 text-slate-100',
  success: 'border-emerald-700/70 bg-emerald-950/60 text-emerald-100',
  error: 'border-rose-700/70 bg-rose-950/70 text-rose-100'
}

function ToastViewport(): React.JSX.Element | null {
  const toasts = useToastStore((state) => state.toasts)
  const dismissToast = useToastStore((state) => state.dismissToast)

  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <article
          key={toast.id}
          className={`pointer-events-auto rounded border px-3 py-2 shadow-xl backdrop-blur ${kindStyles[toast.kind]}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em]">{toast.title}</p>
              <p className="mt-1 text-xs opacity-90">{toast.message}</p>
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick()
                    dismissToast(toast.id)
                  }}
                  className="mt-2 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-900 hover:bg-white"
                >
                  {toast.action.label}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                dismissToast(toast.id)
              }}
              className="rounded border border-current/30 px-2 py-0.5 text-[11px] opacity-90 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

export default ToastViewport
