import { useSyncExternalStore } from 'react'

const NARROW_BREAKPOINT_PX = 900

const subscribe = (callback: () => void): (() => void) => {
  window.addEventListener('resize', callback)
  return () => {
    window.removeEventListener('resize', callback)
  }
}

const getSnapshot = (): boolean => window.innerWidth < NARROW_BREAKPOINT_PX

const getServerSnapshot = (): boolean => false

export const useIsNarrow = (): boolean => {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
