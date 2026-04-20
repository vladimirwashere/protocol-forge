import DiscoveryPanel from './components/discovery/DiscoveryPanel'
import { useEffect, useRef } from 'react'
import ProtocolInspector from './components/inspector/ProtocolInspector'
import AppShell from './components/layout/AppShell'
import SectionErrorBoundary from './components/layout/SectionErrorBoundary'
import StatusBar from './components/layout/StatusBar'
import ToastViewport from './components/notifications/ToastViewport'
import ServerSidebar from './components/sidebar/ServerSidebar'
import WorkspacePanel from './components/workspace/WorkspacePanel'
import { useDiscoveryStore } from './stores/discovery-store'
import { useMessageStore } from './stores/message-store'
import { useServerStore } from './stores/server-store'
import { useSessionStore } from './stores/session-store'
import { useToastStore } from './stores/toast-store'
import { useUIStore } from './stores/ui-store'
import { useUpdateStore } from './stores/update-store'

function App(): React.JSX.Element {
  const metaText = useUIStore((state) => state.metaText)
  const hydrateMeta = useUIStore((state) => state.hydrateMeta)
  const inspectorHeight = useUIStore((state) => state.inspectorHeight)
  const setInspectorHeight = useUIStore((state) => state.setInspectorHeight)

  const profiles = useServerStore((state) => state.profiles)
  const form = useServerStore((state) => state.form)
  const saveError = useServerStore((state) => state.saveError)
  const setFormField = useServerStore((state) => state.setFormField)
  const resetForm = useServerStore((state) => state.resetForm)
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
  const disconnectActiveSession = useSessionStore((state) => state.disconnectActiveSession)
  const refreshActiveSessionMessages = useSessionStore(
    (state) => state.refreshActiveSessionMessages
  )
  const hydrateSessionList = useSessionStore((state) => state.hydrateSessionList)

  const discoveryTab = useDiscoveryStore((state) => state.activeTab)
  const discoveryTools = useDiscoveryStore((state) => state.tools)
  const discoveryResources = useDiscoveryStore((state) => state.resources)
  const discoveryPrompts = useDiscoveryStore((state) => state.prompts)
  const discoveryLoading = useDiscoveryStore((state) => state.loading)
  const discoveryError = useDiscoveryStore((state) => state.error)
  const discoveryResult = useDiscoveryStore((state) => state.activeResult)
  const discoveryResultTitle = useDiscoveryStore((state) => state.activeResultTitle)
  const discoveryResultLatencyMs = useDiscoveryStore((state) => state.activeResultLatencyMs)
  const setDiscoveryTab = useDiscoveryStore((state) => state.setActiveTab)
  const clearDiscoveryResult = useDiscoveryStore((state) => state.clearResult)
  const hydrateDiscovery = useDiscoveryStore((state) => state.hydrateDiscovery)
  const invokeTool = useDiscoveryStore((state) => state.invokeTool)
  const loadResource = useDiscoveryStore((state) => state.loadResource)
  const loadPrompt = useDiscoveryStore((state) => state.loadPrompt)

  const inspectorMessages = useMessageStore((state) => state.messages)
  const inspectorPaused = useMessageStore((state) => state.paused)
  const inspectorFilters = useMessageStore((state) => state.filters)
  const ingestMessages = useMessageStore((state) => state.ingestMessages)
  const toggleInspectorPaused = useMessageStore((state) => state.togglePaused)
  const clearInspectorMessages = useMessageStore((state) => state.clearMessages)
  const setInspectorDirectionFilter = useMessageStore((state) => state.setDirectionFilter)
  const setInspectorMethodFilter = useMessageStore((state) => state.setMethodFilter)
  const setInspectorSearchFilter = useMessageStore((state) => state.setSearchFilter)
  const showToast = useToastStore((state) => state.showToast)

  const updateStatus = useUpdateStore((state) => state.status)
  const subscribeUpdate = useUpdateStore((state) => state.subscribe)
  const installUpdate = useUpdateStore((state) => state.installUpdate)

  const sessionId = sessionStatus?.sessionId ?? null
  const lastDiscoverySessionKeyRef = useRef<string>('')
  const lastSaveErrorRef = useRef<string | null>(null)
  const lastSessionErrorRef = useRef<string | null>(null)
  const lastDiscoveryErrorRef = useRef<string | null>(null)
  const lastUpdateStateRef = useRef<string>('idle')

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
    const nextKey = sessionStatus ? `${sessionStatus.sessionId}:${sessionStatus.state}` : 'none'
    if (lastDiscoverySessionKeyRef.current === nextKey) {
      return
    }

    lastDiscoverySessionKeyRef.current = nextKey
    void hydrateDiscovery(sessionStatus)
  }, [hydrateDiscovery, sessionStatus])

  useEffect(() => {
    void ingestMessages(sessionId, sessionMessages)
  }, [ingestMessages, sessionMessages, sessionId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const isShortcut = event.metaKey && !event.ctrlKey && !event.altKey
      if (!isShortcut) {
        return
      }

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        resetForm()
        setSessionError(null)
        return
      }

      if (event.key === ',') {
        event.preventDefault()
        setSessionError('Settings panel is coming in a later milestone')
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [resetForm, setSessionError])

  useEffect(() => {
    if (!saveError || lastSaveErrorRef.current === saveError) {
      return
    }

    lastSaveErrorRef.current = saveError
    showToast({
      title: 'Profile Save Failed',
      message: saveError,
      kind: 'error'
    })
  }, [saveError, showToast])

  useEffect(() => {
    if (!sessionError || lastSessionErrorRef.current === sessionError) {
      return
    }

    lastSessionErrorRef.current = sessionError
    showToast({
      title: 'Session Error',
      message: sessionError,
      kind: 'error'
    })
  }, [sessionError, showToast])

  useEffect(() => {
    if (!discoveryError || lastDiscoveryErrorRef.current === discoveryError) {
      return
    }

    lastDiscoveryErrorRef.current = discoveryError
    showToast({
      title: 'Discovery Error',
      message: discoveryError,
      kind: 'error'
    })
  }, [discoveryError, showToast])

  useEffect(() => {
    subscribeUpdate()
  }, [subscribeUpdate])

  useEffect(() => {
    if (lastUpdateStateRef.current === updateStatus.state) {
      return
    }
    lastUpdateStateRef.current = updateStatus.state

    if (updateStatus.state === 'available') {
      showToast({
        title: 'Update Available',
        message: `Protocol Forge v${updateStatus.version} is downloading…`,
        kind: 'info'
      })
    } else if (updateStatus.state === 'downloaded') {
      showToast({
        title: 'Update Ready',
        message: `Protocol Forge v${updateStatus.version} is ready to install.`,
        kind: 'success',
        durationMs: 0,
        action: {
          label: 'Restart',
          onClick: () => {
            void installUpdate()
          }
        }
      })
    } else if (updateStatus.state === 'error') {
      showToast({
        title: 'Update Error',
        message: updateStatus.message,
        kind: 'error'
      })
    }
  }, [updateStatus, showToast, installUpdate])

  return (
    <>
      <AppShell
        inspectorHeight={inspectorHeight}
        onInspectorHeightChange={setInspectorHeight}
        sidebar={
          <SectionErrorBoundary sectionName="Sidebar">
            <ServerSidebar
              form={form}
              profiles={profiles}
              saveError={saveError}
              setFormField={setFormField}
              onSaveProfile={() => {
                void saveProfile()
              }}
              onDeleteProfile={(id) => {
                void deleteProfile(id)
              }}
              onConnectProfile={(profile) => {
                void connectProfile(profile)
              }}
            />
          </SectionErrorBoundary>
        }
        main={
          <SectionErrorBoundary sectionName="Workspace and Discovery">
            <>
              <WorkspacePanel
                metaText={metaText}
                profileCount={profiles.length}
                sessionStatus={sessionStatus}
                sessionError={sessionError}
              />
              <DiscoveryPanel
                sessionStatus={sessionStatus}
                activeTab={discoveryTab}
                tools={discoveryTools}
                resources={discoveryResources}
                prompts={discoveryPrompts}
                loading={discoveryLoading}
                error={discoveryError}
                activeResult={discoveryResult}
                activeResultTitle={discoveryResultTitle}
                activeResultLatencyMs={discoveryResultLatencyMs}
                onChangeTab={setDiscoveryTab}
                onReload={() => {
                  void hydrateDiscovery(sessionStatus)
                }}
                onInvokeTool={(name, args) => {
                  void invokeTool(sessionStatus, name, args)
                }}
                onReadResource={(uri) => {
                  void loadResource(sessionStatus, uri)
                }}
                onGetPrompt={(name, args) => {
                  void loadPrompt(sessionStatus, name, args)
                }}
                onClearResult={clearDiscoveryResult}
              />
            </>
          </SectionErrorBoundary>
        }
        inspector={
          <SectionErrorBoundary sectionName="Protocol Inspector">
            <ProtocolInspector
              sessionStatus={sessionStatus}
              sessionMessages={inspectorMessages}
              sessionHistory={sessionHistory}
              sessionError={sessionError}
              paused={inspectorPaused}
              directionFilter={inspectorFilters.direction}
              methodFilter={inspectorFilters.method}
              searchFilter={inspectorFilters.search}
              onRefreshSessions={() => {
                void refreshSessionHistory()
              }}
              onRefreshMessages={() => {
                void refreshActiveSessionMessages()
              }}
              onDisconnect={() => {
                void disconnectActiveSession()
              }}
              onInspectSession={(sessionId) => {
                void inspectSession(sessionId)
              }}
              onTogglePaused={toggleInspectorPaused}
              onClearMessages={clearInspectorMessages}
              onDirectionFilterChange={setInspectorDirectionFilter}
              onMethodFilterChange={setInspectorMethodFilter}
              onSearchFilterChange={setInspectorSearchFilter}
            />
          </SectionErrorBoundary>
        }
        statusBar={
          <SectionErrorBoundary sectionName="Status Bar">
            <StatusBar
              sessionStatus={sessionStatus}
              sessionError={sessionError}
              profileCount={profiles.length}
            />
          </SectionErrorBoundary>
        }
      />
      <ToastViewport />
    </>
  )
}

export default App
