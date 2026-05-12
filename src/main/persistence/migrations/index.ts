import * as initialSchema from './0001_initial_schema'
import * as migrateLegacySseProfiles from './0002_migrate_legacy_sse_profiles'
import * as addProfileRoots from './0003_add_profile_roots'
import type { Migration } from './types'

export const MIGRATIONS: readonly Migration[] = [
  initialSchema,
  migrateLegacySseProfiles,
  addProfileRoots
]

export { runMigrations } from './runner'
export type { Migration } from './types'
