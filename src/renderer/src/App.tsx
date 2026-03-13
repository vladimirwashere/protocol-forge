import { useEffect } from 'react'
import ProtocolInspector from './components/inspector/ProtocolInspector'
import AppShell from './components/layout/AppShell'
import ServerSidebar from './components/sidebar/ServerSidebar'
import WorkspacePanel from './components/workspace/WorkspacePanel'
import { useServerStore } from './stores/server-store'
import { useSessionStore } from './stores/session-store'
import { useUIStore } from './stores/ui-store'

function App(): React.JSX.Element {
  const metaText = useUIStore((state) => state.metaText)
  const hydrateMeta = useUIStore((state) => state.hydrateMeta)

  const profiles = useServerStore((state) => state.profiles)
  const form = useServerStore((state) => state.form)
  const saveError = useServerStore((state) => state.saveError)
  const setFormField = useServerStore((state) => state.setFormField)
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

  return (
    <AppShell
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
      main={<WorkspacePanel metaText={metaText} />}
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
    />
  )
}

export default App
