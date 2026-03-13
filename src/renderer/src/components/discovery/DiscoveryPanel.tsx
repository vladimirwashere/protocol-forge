import type {
  DiscoveryPrompt,
  DiscoveryResource,
  DiscoveryTool,
  SessionStatus
} from '../../../../shared/ipc'
import SchemaForm from '../forms/SchemaForm'

type DiscoveryPanelProps = {
  sessionStatus: SessionStatus | null
  activeTab: 'tools' | 'resources' | 'prompts'
  tools: DiscoveryTool[]
  resources: DiscoveryResource[]
  prompts: DiscoveryPrompt[]
  loading: boolean
  error: string | null
  activeResult: unknown | null
  activeResultTitle: string | null
  onChangeTab: (tab: 'tools' | 'resources' | 'prompts') => void
  onReload: () => void
  onInvokeTool: (name: string, args: Record<string, unknown>) => void
  onReadResource: (uri: string) => void
  onGetPrompt: (name: string, args: Record<string, string>) => void
  onClearResult: () => void
}

const parseKeyValueLines = (raw: string): Record<string, string> => {
  const result: Record<string, string> = {}

  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) {
      throw new Error(`Invalid prompt argument on line ${index + 1}. Use key=value.`)
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()

    if (key.length === 0) {
      throw new Error(`Invalid prompt argument key on line ${index + 1}`)
    }

    result[key] = value
  }

  return result
}

function PromptArgsEditor({
  prompt,
  disabled,
  onSubmit
}: {
  prompt: DiscoveryPrompt
  disabled: boolean
  onSubmit: (args: Record<string, string>) => void
}): React.JSX.Element {
  const hasArgs = (prompt.arguments?.length ?? 0) > 0

  if (!hasArgs) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          onSubmit({})
        }}
        className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
      >
        Get Prompt
      </button>
    )
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        const raw = String(formData.get('promptArgs') ?? '')
        onSubmit(parseKeyValueLines(raw))
      }}
    >
      <textarea
        name="promptArgs"
        rows={3}
        placeholder={prompt.arguments?.map((argument) => `${argument.name}=...`).join('\n')}
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
      />
      <button
        type="submit"
        disabled={disabled}
        className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
      >
        Get Prompt
      </button>
    </form>
  )
}

function DiscoveryPanel({
  sessionStatus,
  activeTab,
  tools,
  resources,
  prompts,
  loading,
  error,
  activeResult,
  activeResultTitle,
  onChangeTab,
  onReload,
  onInvokeTool,
  onReadResource,
  onGetPrompt,
  onClearResult
}: DiscoveryPanelProps): React.JSX.Element {
  const isReady = sessionStatus?.state === 'ready'

  return (
    <div className="mt-4 rounded border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">Discovery</h3>
        <button
          onClick={onReload}
          disabled={!isReady || loading}
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
        >
          Reload
        </button>
      </div>

      <div className="mt-3 inline-flex rounded border border-slate-800 p-1 text-xs">
        {(['tools', 'resources', 'prompts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              onChangeTab(tab)
            }}
            className={`rounded px-2 py-1 capitalize ${
              activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {!isReady ? (
        <p className="mt-3 text-xs text-slate-500">
          Connect and initialize a session to list tools, resources, and prompts.
        </p>
      ) : null}

      {loading ? <p className="mt-3 text-xs text-slate-400">Loading discovery data…</p> : null}
      {error ? <p className="mt-3 text-xs text-rose-400">{error}</p> : null}

      {isReady && activeTab === 'tools' ? (
        <div className="mt-3 max-h-72 space-y-3 overflow-auto rounded border border-slate-800 bg-slate-950/50 p-3">
          {tools.length === 0 ? (
            <p className="text-xs text-slate-500">No tools reported by this server.</p>
          ) : (
            tools.map((tool) => (
              <div key={tool.name} className="rounded border border-slate-800 bg-slate-900/40 p-3">
                <div className="mb-2">
                  <p className="text-xs font-medium text-slate-200">{tool.name}</p>
                  {tool.description ? (
                    <p className="mt-1 text-xs text-slate-500">{tool.description}</p>
                  ) : null}
                </div>
                <SchemaForm
                  schema={tool.inputSchema}
                  submitLabel="Invoke Tool"
                  disabled={loading}
                  onSubmit={(args) => {
                    onInvokeTool(tool.name, args)
                  }}
                />
              </div>
            ))
          )}
        </div>
      ) : null}

      {isReady && activeTab === 'resources' ? (
        <div className="mt-3 max-h-72 space-y-2 overflow-auto rounded border border-slate-800 bg-slate-950/50 p-3">
          {resources.length === 0 ? (
            <p className="text-xs text-slate-500">No resources reported by this server.</p>
          ) : (
            resources.map((resource) => (
              <div
                key={resource.uri}
                className="rounded border border-slate-800 bg-slate-900/40 p-2"
              >
                <p className="text-xs font-medium text-slate-200">{resource.name}</p>
                <p className="mt-1 break-all text-[11px] text-slate-500">{resource.uri}</p>
                <button
                  className="mt-2 rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
                  onClick={() => {
                    onReadResource(resource.uri)
                  }}
                >
                  Read Resource
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}

      {isReady && activeTab === 'prompts' ? (
        <div className="mt-3 max-h-72 space-y-2 overflow-auto rounded border border-slate-800 bg-slate-950/50 p-3">
          {prompts.length === 0 ? (
            <p className="text-xs text-slate-500">No prompts reported by this server.</p>
          ) : (
            prompts.map((prompt) => (
              <div
                key={prompt.name}
                className="rounded border border-slate-800 bg-slate-900/40 p-2"
              >
                <p className="text-xs font-medium text-slate-200">{prompt.name}</p>
                {prompt.description ? (
                  <p className="mt-1 text-[11px] text-slate-500">{prompt.description}</p>
                ) : null}
                <div className="mt-2">
                  <PromptArgsEditor
                    prompt={prompt}
                    disabled={loading}
                    onSubmit={(args) => {
                      onGetPrompt(prompt.name, args)
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {activeResult ? (
        <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-300">{activeResultTitle ?? 'Result'}</p>
            <button
              onClick={onClearResult}
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
            >
              Clear
            </button>
          </div>
          <pre className="max-h-48 overflow-auto text-xs text-slate-300">
            {JSON.stringify(activeResult, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  )
}

export default DiscoveryPanel
