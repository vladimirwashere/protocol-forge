import type { ReactNode } from 'react'

import { useIsNarrow } from '../../hooks/useIsNarrow'
import type { InspectorView, NarrowTab } from '../../stores/ui-store-utils'

type AppShellProps = {
  sidebar: ReactNode
  main: ReactNode
  inspector: ReactNode
  statusBar: ReactNode
  inspectorView: InspectorView
  narrowTab: NarrowTab
  onCycleInspectorView: () => void
  onSetInspectorView: (value: InspectorView) => void
  onSetNarrowTab: (value: NarrowTab) => void
}

type TabDef = { id: NarrowTab; label: string }

const NARROW_TABS: readonly TabDef[] = [
  { id: 'servers', label: 'Servers' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'inspector', label: 'Inspector' }
]

function AppShell({
  sidebar,
  main,
  inspector,
  statusBar,
  inspectorView,
  narrowTab,
  onCycleInspectorView,
  onSetInspectorView,
  onSetNarrowTab
}: AppShellProps): React.JSX.Element {
  const isNarrow = useIsNarrow()

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <div className="min-h-0 flex-1">
        {isNarrow ? (
          <NarrowLayout
            sidebar={sidebar}
            main={main}
            inspector={inspector}
            narrowTab={narrowTab}
            onSetNarrowTab={onSetNarrowTab}
          />
        ) : (
          <WideLayout
            sidebar={sidebar}
            main={main}
            inspector={inspector}
            inspectorView={inspectorView}
            onCycleInspectorView={onCycleInspectorView}
            onSetInspectorView={onSetInspectorView}
          />
        )}
      </div>
      <footer className="shrink-0 border-t border-slate-800 bg-slate-950/90">{statusBar}</footer>
    </div>
  )
}

function WideLayout({
  sidebar,
  main,
  inspector,
  inspectorView,
  onCycleInspectorView,
  onSetInspectorView
}: {
  sidebar: ReactNode
  main: ReactNode
  inspector: ReactNode
  inspectorView: InspectorView
  onCycleInspectorView: () => void
  onSetInspectorView: (value: InspectorView) => void
}): React.JSX.Element {
  const mainHidden = inspectorView === 'expanded'

  return (
    <div className="grid h-full grid-cols-[300px_minmax(0,1fr)]">
      <aside className="min-h-0 overflow-y-auto border-r border-slate-800 bg-slate-900/70 p-4">
        {sidebar}
      </aside>
      <div className="flex min-h-0 flex-col">
        {!mainHidden ? (
          <main
            className={`min-h-0 overflow-y-auto p-6 ${
              inspectorView === 'split' ? 'flex-[1_1_55%]' : 'flex-1'
            }`}
          >
            {main}
          </main>
        ) : null}
        <InspectorDrawer
          view={inspectorView}
          onCycle={onCycleInspectorView}
          onSetView={onSetInspectorView}
        >
          {inspector}
        </InspectorDrawer>
      </div>
    </div>
  )
}

function InspectorDrawer({
  view,
  onCycle,
  onSetView,
  children
}: {
  view: InspectorView
  onCycle: () => void
  onSetView: (value: InspectorView) => void
  children: ReactNode
}): React.JSX.Element {
  const bodyHidden = view === 'collapsed'

  const flexClass =
    view === 'split' ? 'flex-[1_1_45%]' : view === 'expanded' ? 'flex-1' : 'shrink-0'

  return (
    <section
      className={`flex min-h-0 flex-col border-t border-slate-800 bg-slate-950/80 ${flexClass}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/60 px-4 py-2">
        <button
          type="button"
          onClick={onCycle}
          className="text-xs font-medium uppercase tracking-[0.12em] text-slate-300 hover:text-slate-100"
          title="Toggle inspector size"
        >
          Protocol Inspector
        </button>
        <div className="flex items-center gap-1">
          <DrawerButton
            label="Collapse inspector"
            active={view === 'collapsed'}
            onClick={() => {
              onSetView('collapsed')
            }}
          >
            <ChevronDown />
          </DrawerButton>
          <DrawerButton
            label="Split view"
            active={view === 'split'}
            onClick={() => {
              onSetView('split')
            }}
          >
            <SplitIcon />
          </DrawerButton>
          <DrawerButton
            label="Expand inspector"
            active={view === 'expanded'}
            onClick={() => {
              onSetView('expanded')
            }}
          >
            <ChevronUp />
          </DrawerButton>
        </div>
      </header>
      {!bodyHidden ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      ) : null}
    </section>
  )
}

function DrawerButton({
  label,
  active,
  onClick,
  children
}: {
  label: string
  active: boolean
  onClick: () => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded border text-[11px] ${
        active
          ? 'border-slate-500 bg-slate-700/70 text-white'
          : 'border-slate-700 text-slate-400 hover:text-slate-100'
      }`}
    >
      {children}
    </button>
  )
}

function NarrowLayout({
  sidebar,
  main,
  inspector,
  narrowTab,
  onSetNarrowTab
}: {
  sidebar: ReactNode
  main: ReactNode
  inspector: ReactNode
  narrowTab: NarrowTab
  onSetNarrowTab: (value: NarrowTab) => void
}): React.JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <nav
        role="tablist"
        className="flex shrink-0 gap-1 border-b border-slate-800 bg-slate-900/70 px-2 py-2"
      >
        {NARROW_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={narrowTab === tab.id}
            onClick={() => {
              onSetNarrowTab(tab.id)
            }}
            className={`flex-1 rounded px-3 py-1.5 text-sm ${
              narrowTab === tab.id
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {narrowTab === 'servers' ? <div className="p-4">{sidebar}</div> : null}
        {narrowTab === 'workspace' ? <div className="p-4">{main}</div> : null}
        {narrowTab === 'inspector' ? <div className="p-4">{inspector}</div> : null}
      </div>
    </div>
  )
}

function ChevronDown(): React.JSX.Element {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3">
      <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronUp(): React.JSX.Element {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3">
      <path d="M3 7l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SplitIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3">
      <rect x="2" y="2" width="8" height="8" rx="1" />
      <path d="M2 6h8" strokeLinecap="round" />
    </svg>
  )
}

export default AppShell
