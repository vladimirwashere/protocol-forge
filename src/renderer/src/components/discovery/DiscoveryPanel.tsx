import { useEffect, useRef, useState } from 'react'

import type {
  DiscoveryPrompt,
  DiscoveryResource,
  DiscoveryResourceTemplate,
  DiscoveryTool,
  SessionStatus
} from '../../../../shared/ipc'
import SchemaForm from '../forms/SchemaForm'
import ResultRenderer from '../results/ResultRenderer'
import DestructiveConfirmModal from './DestructiveConfirmModal'
import ToolBadges from './ToolBadges'

type PendingDestructiveInvocation = {
  tool: DiscoveryTool
  args: Record<string, unknown>
}

type DiscoveryPanelProps = {
  sessionStatus: SessionStatus | null
  activeTab: 'tools' | 'resources' | 'prompts'
  tools: DiscoveryTool[]
  resources: DiscoveryResource[]
  resourceTemplates: DiscoveryResourceTemplate[]
  prompts: DiscoveryPrompt[]
  loading: boolean
  error: string | null
  activeResult: unknown | null
  activeResultTitle: string | null
  activeResultLatencyMs: number | null
  activeOutputSchema: Record<string, unknown> | null
  onChangeTab: (tab: 'tools' | 'resources' | 'prompts') => void
  onReload: () => void
  onInvokeTool: (name: string, args: Record<string, unknown>) => void
  onReadResource: (uri: string) => void
  onGetPrompt: (name: string, args: Record<string, string>) => void
  onClearResult: () => void
}

function PromptArgumentField({
  argument,
  value,
  onChange,
  onFocus,
  onBlur,
  suggestions,
  showSuggestions,
  loading
}: {
  argument: DiscoveryPrompt['arguments'] extends Array<infer T> | undefined ? T : never
  value: string
  onChange: (next: string) => void
  onFocus: () => void
  onBlur: () => void
  suggestions: string[] | null
  showSuggestions: boolean
  loading: boolean
}): React.JSX.Element {
  return (
    <label className="block text-xs text-slate-300">
      <span className="font-mono text-[11px] text-slate-400">
        {argument.name}
        {argument.required ? <span className="ml-1 text-rose-400">*</span> : null}
      </span>
      <div className="relative mt-1">
        <input
          type="text"
          value={value}
          required={argument.required ?? false}
          onChange={(event) => {
            onChange(event.target.value)
          }}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={argument.description ?? ''}
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
        />
        {showSuggestions && suggestions && suggestions.length > 0 ? (
          <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-32 overflow-auto rounded border border-slate-700 bg-slate-900 text-xs shadow-lg">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onChange(suggestion)
                  }}
                  className="block w-full px-2 py-1 text-left text-slate-200 hover:bg-slate-800"
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {loading ? (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
            …
          </span>
        ) : null}
      </div>
    </label>
  )
}

function PromptArgsEditor({
  prompt,
  disabled,
  sessionId,
  completionsAvailable,
  onSubmit
}: {
  prompt: DiscoveryPrompt
  disabled: boolean
  sessionId: string | null
  completionsAvailable: boolean
  onSubmit: (args: Record<string, string>) => void
}): React.JSX.Element {
  const promptArgs = prompt.arguments ?? []
  const hasArgs = promptArgs.length > 0

  const [values, setValues] = useState<Record<string, string>>({})
  const [focused, setFocused] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({})
  const [loadingField, setLoadingField] = useState<string | null>(null)
  const requestSeq = useRef(0)

  const canComplete = completionsAvailable && sessionId !== null

  useEffect(() => {
    if (!canComplete || focused === null) return
    const argumentName = focused
    const argumentValue = values[argumentName] ?? ''

    const requestId = ++requestSeq.current
    const timer = window.setTimeout(() => {
      setLoadingField(argumentName)
      const otherArgs = Object.fromEntries(
        Object.entries(values).filter(([key, val]) => key !== argumentName && val.length > 0)
      )
      window.api
        .complete({
          sessionId: sessionId!,
          ref: { type: 'ref/prompt', name: prompt.name },
          argument: { name: argumentName, value: argumentValue },
          ...(Object.keys(otherArgs).length > 0 ? { context: { arguments: otherArgs } } : {})
        })
        .then((result) => {
          if (requestId !== requestSeq.current) return
          setSuggestions((prev) => ({ ...prev, [argumentName]: result.values }))
        })
        .catch(() => {
          if (requestId !== requestSeq.current) return
          setSuggestions((prev) => ({ ...prev, [argumentName]: [] }))
        })
        .finally(() => {
          if (requestId !== requestSeq.current) return
          setLoadingField(null)
        })
    }, 200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [canComplete, focused, prompt.name, sessionId, values])

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
        const filled: Record<string, string> = {}
        for (const argument of promptArgs) {
          const val = values[argument.name] ?? ''
          if (val.length > 0) filled[argument.name] = val
        }
        onSubmit(filled)
      }}
    >
      {promptArgs.map((argument) => (
        <PromptArgumentField
          key={argument.name}
          argument={argument}
          value={values[argument.name] ?? ''}
          onChange={(next) => {
            setValues((prev) => ({ ...prev, [argument.name]: next }))
          }}
          onFocus={() => {
            setFocused(argument.name)
          }}
          onBlur={() => {
            // Slight delay so click on a suggestion fires before the list closes.
            window.setTimeout(() => {
              setFocused((current) => (current === argument.name ? null : current))
            }, 100)
          }}
          suggestions={suggestions[argument.name] ?? null}
          showSuggestions={canComplete && focused === argument.name}
          loading={loadingField === argument.name}
        />
      ))}
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

function parseTemplatePlaceholders(uriTemplate: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  const regex = /\{([^}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(uriTemplate)) !== null) {
    const raw = match[1]
    if (raw === undefined) continue
    // Drop RFC 6570 operator prefix and split on commas for the variable list.
    const body = raw.replace(/^[+#./;?&]/, '')
    for (const segment of body.split(',')) {
      const name = segment.replace(/[*:].*$/, '').trim()
      if (name.length === 0 || seen.has(name)) continue
      seen.add(name)
      names.push(name)
    }
  }
  return names
}

function expandTemplateUri(uriTemplate: string, values: Record<string, string>): string {
  return uriTemplate.replace(/\{([^}]+)\}/g, (_, raw: string) => {
    const body = raw.replace(/^[+#./;?&]/, '')
    const parts = body.split(',').map((segment) => {
      const name = segment.replace(/[*:].*$/, '').trim()
      const value = values[name] ?? ''
      return encodeURIComponent(value)
    })
    return parts.join(',')
  })
}

function ResourceTemplateForm({
  template,
  disabled,
  sessionId,
  completionsAvailable,
  onSubmit
}: {
  template: DiscoveryResourceTemplate
  disabled: boolean
  sessionId: string | null
  completionsAvailable: boolean
  onSubmit: (uri: string) => void
}): React.JSX.Element {
  const placeholders = parseTemplatePlaceholders(template.uriTemplate)
  const hasArgs = placeholders.length > 0

  const [values, setValues] = useState<Record<string, string>>({})
  const [focused, setFocused] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({})
  const [loadingField, setLoadingField] = useState<string | null>(null)
  const requestSeq = useRef(0)

  const canComplete = completionsAvailable && sessionId !== null

  useEffect(() => {
    if (!canComplete || focused === null) return
    const argumentName = focused
    const argumentValue = values[argumentName] ?? ''

    const requestId = ++requestSeq.current
    const timer = window.setTimeout(() => {
      setLoadingField(argumentName)
      const otherArgs = Object.fromEntries(
        Object.entries(values).filter(([key, val]) => key !== argumentName && val.length > 0)
      )
      window.api
        .complete({
          sessionId: sessionId!,
          ref: { type: 'ref/resource', uri: template.uriTemplate },
          argument: { name: argumentName, value: argumentValue },
          ...(Object.keys(otherArgs).length > 0 ? { context: { arguments: otherArgs } } : {})
        })
        .then((result) => {
          if (requestId !== requestSeq.current) return
          setSuggestions((prev) => ({ ...prev, [argumentName]: result.values }))
        })
        .catch(() => {
          if (requestId !== requestSeq.current) return
          setSuggestions((prev) => ({ ...prev, [argumentName]: [] }))
        })
        .finally(() => {
          if (requestId !== requestSeq.current) return
          setLoadingField(null)
        })
    }, 200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [canComplete, focused, template.uriTemplate, sessionId, values])

  if (!hasArgs) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          onSubmit(template.uriTemplate)
        }}
        className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
      >
        Read Resource
      </button>
    )
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(expandTemplateUri(template.uriTemplate, values))
      }}
    >
      {placeholders.map((name) => (
        <PromptArgumentField
          key={name}
          argument={{ name, required: true }}
          value={values[name] ?? ''}
          onChange={(next) => {
            setValues((prev) => ({ ...prev, [name]: next }))
          }}
          onFocus={() => {
            setFocused(name)
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setFocused((current) => (current === name ? null : current))
            }, 100)
          }}
          suggestions={suggestions[name] ?? null}
          showSuggestions={canComplete && focused === name}
          loading={loadingField === name}
        />
      ))}
      <button
        type="submit"
        disabled={disabled}
        className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
      >
        Read Resource
      </button>
    </form>
  )
}

function DiscoveryPanel({
  sessionStatus,
  activeTab,
  tools,
  resources,
  resourceTemplates,
  prompts,
  loading,
  error,
  activeResult,
  activeResultTitle,
  activeResultLatencyMs,
  activeOutputSchema,
  onChangeTab,
  onReload,
  onInvokeTool,
  onReadResource,
  onGetPrompt,
  onClearResult
}: DiscoveryPanelProps): React.JSX.Element {
  const isReady = sessionStatus?.state === 'ready'
  const sessionId = sessionStatus?.sessionId ?? null
  const completionsAvailable = sessionStatus?.serverCapabilities?.completions === true
  const [pendingDestructive, setPendingDestructive] = useState<PendingDestructiveInvocation | null>(
    null
  )

  const handleToolSubmit = (tool: DiscoveryTool, args: Record<string, unknown>): void => {
    if (tool.annotations?.destructiveHint === true) {
      setPendingDestructive({ tool, args })
      return
    }
    onInvokeTool(tool.name, args)
  }

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
            tools.map((tool) => {
              const displayTitle = tool.title ?? tool.annotations?.title
              const isDestructive = tool.annotations?.destructiveHint === true
              return (
                <div
                  key={tool.name}
                  className="rounded border border-slate-800 bg-slate-900/40 p-3"
                >
                  <div className="mb-2">
                    {displayTitle ? (
                      <>
                        <p className="text-xs font-medium text-slate-200">{displayTitle}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">{tool.name}</p>
                      </>
                    ) : (
                      <p className="text-xs font-medium text-slate-200">{tool.name}</p>
                    )}
                    {tool.description ? (
                      <p className="mt-1 text-xs text-slate-500">{tool.description}</p>
                    ) : null}
                    <ToolBadges annotations={tool.annotations} />
                  </div>
                  <SchemaForm
                    schema={tool.inputSchema}
                    submitLabel={isDestructive ? 'Invoke Tool…' : 'Invoke Tool'}
                    disabled={loading}
                    onSubmit={(args) => {
                      handleToolSubmit(tool, args)
                    }}
                  />
                </div>
              )
            })
          )}
        </div>
      ) : null}

      {isReady && activeTab === 'resources' ? (
        <div className="mt-3 max-h-72 space-y-4 overflow-auto rounded border border-slate-800 bg-slate-950/50 p-3">
          <section className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Resources
            </h4>
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
          </section>

          <section className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Templates
            </h4>
            {resourceTemplates.length === 0 ? (
              <p className="text-xs text-slate-500">
                No resource templates reported by this server.
              </p>
            ) : (
              resourceTemplates.map((template) => (
                <div
                  key={template.uriTemplate}
                  className="rounded border border-slate-800 bg-slate-900/40 p-2"
                >
                  <p className="text-xs font-medium text-slate-200">
                    {template.title ?? template.name}
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
                    {template.uriTemplate}
                  </p>
                  {template.description ? (
                    <p className="mt-1 text-[11px] text-slate-500">{template.description}</p>
                  ) : null}
                  <div className="mt-2">
                    <ResourceTemplateForm
                      template={template}
                      disabled={loading}
                      sessionId={sessionId}
                      completionsAvailable={completionsAvailable}
                      onSubmit={(uri) => {
                        onReadResource(uri)
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </section>
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
                    sessionId={sessionId}
                    completionsAvailable={completionsAvailable}
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
        <ResultRenderer
          key={activeResultTitle ?? 'result'}
          title={activeResultTitle}
          result={activeResult}
          latencyMs={activeResultLatencyMs}
          outputSchema={activeOutputSchema}
          onClear={onClearResult}
        />
      ) : null}

      {pendingDestructive ? (
        <DestructiveConfirmModal
          toolName={pendingDestructive.tool.name}
          {...(() => {
            const title =
              pendingDestructive.tool.title ?? pendingDestructive.tool.annotations?.title
            return title ? { toolTitle: title } : {}
          })()}
          onCancel={() => {
            setPendingDestructive(null)
          }}
          onConfirm={() => {
            const captured = pendingDestructive
            setPendingDestructive(null)
            onInvokeTool(captured.tool.name, captured.args)
          }}
        />
      ) : null}
    </div>
  )
}

export default DiscoveryPanel
