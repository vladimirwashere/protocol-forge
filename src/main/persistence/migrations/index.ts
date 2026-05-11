import * as initialSchema from './0001_initial_schema'
import * as migrateLegacySseProfiles from './0002_migrate_legacy_sse_profiles'
import type { Migration } from './types'

export const MIGRATIONS: readonly Migration[] = [initialSchema, migrateLegacySseProfiles]

export { runMigrations } from './runner'
export type { Migration } from './types'
