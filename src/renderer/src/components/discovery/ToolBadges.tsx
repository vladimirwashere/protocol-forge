import type { ToolAnnotations } from '../../../../shared/ipc'

type ToolBadgesProps = {
  annotations: ToolAnnotations | undefined
}

type BadgeDef = {
  label: string
  tone: 'info' | 'warn' | 'danger' | 'muted'
  title: string
}

function badgesFor(annotations: ToolAnnotations): BadgeDef[] {
  const badges: BadgeDef[] = []
  if (annotations.readOnlyHint === true) {
    badges.push({
      label: 'read-only',
      tone: 'info',
      title: 'Server hints this tool does not modify state.'
    })
  }
  if (annotations.destructiveHint === true) {
    badges.push({
      label: 'destructive',
      tone: 'danger',
      title:
        'Server hints this tool may make irreversible changes. Invocation requires confirmation.'
    })
  }
  if (annotations.idempotentHint === true) {
    badges.push({
      label: 'idempotent',
      tone: 'muted',
      title: 'Server hints repeated calls with the same args have no additional effect.'
    })
  }
  if (annotations.openWorldHint === true) {
    badges.push({
      label: 'open-world',
      tone: 'warn',
      title: 'Server hints this tool reaches external systems beyond its own state.'
    })
  }
  return badges
}

const TONE_CLASSES: Record<BadgeDef['tone'], string> = {
  info: 'border-sky-800 bg-sky-950/40 text-sky-300',
  warn: 'border-amber-800 bg-amber-950/40 text-amber-300',
  danger: 'border-rose-800 bg-rose-950/40 text-rose-300',
  muted: 'border-slate-700 bg-slate-900/60 text-slate-400'
}

function ToolBadges({ annotations }: ToolBadgesProps): React.JSX.Element | null {
  if (!annotations) return null
  const badges = badgesFor(annotations)
  if (badges.length === 0) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          key={badge.label}
          title={badge.title}
          className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${TONE_CLASSES[badge.tone]}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  )
}

export default ToolBadges
