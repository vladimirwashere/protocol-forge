import DiscoveryPanel from './components/discovery/DiscoveryPanel'
import { useEffect } from 'react'
import ProtocolInspector from './components/inspector/ProtocolInspector'
import AppShell from './components/layout/AppShell'
import StatusBar from './components/layout/StatusBar'
import ServerSidebar from './components/sidebar/ServerSidebar'
import WorkspacePanel from './components/workspace/WorkspacePanel'
import { useDiscoveryStore } from './stores/discovery-store'
import { useServerStore } from './stores/server-store'
import { useSessionStore } from './stores/session-store'
import { useUIStore } from './stores/ui-store'

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
  const connectSseUrl = useSessionStore((state) => state.connectSseUrl)
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
  const setDiscoveryTab = useDiscoveryStore((state) => state.setActiveTab)
  const clearDiscoveryResult = useDiscoveryStore((state) => state.clearResult)
  const hydrateDiscovery = useDiscoveryStore((state) => state.hydrateDiscovery)
  const invokeTool = useDiscoveryStore((state) => state.invokeTool)
  const loadResource = useDiscoveryStore((state) => state.loadResource)
  const loadPrompt = useDiscoveryStore((state) => state.loadPrompt)

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

  useEffect(() => {
    void hydrateDiscovery(sessionStatus)
  }, [hydrateDiscovery, sessionStatus])

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

  return (
    <AppShell
      inspectorHeight={inspectorHeight}
      onInspectorHeightChange={setInspectorHeight}
      sidebar={
        <ServerSidebar
          form={form}
          profiles={profiles}
          saveError={saveError}
          setFormField={setFormField}
          onSaveProfile={() => {
            void saveProfile()
          }}
          onConnectSseUrl={(url) => {
            void connectSseUrl(url)
          }}
          onDeleteProfile={(id) => {
            void deleteProfile(id)
          }}
          onConnectProfile={(profile) => {
            void connectProfile(profile)
          }}
        />
      }
      main={
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
      }
      inspector={
        <ProtocolInspector
          sessionStatus={sessionStatus}
          sessionMessages={sessionMessages}
          sessionHistory={sessionHistory}
          sessionError={sessionError}
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
        />
      }
      statusBar={
        <StatusBar
          sessionStatus={sessionStatus}
          sessionError={sessionError}
          profileCount={profiles.length}
        />
      }
    />
  )
}

export default App
