import type Database from 'better-sqlite3'

export type Migration = {
  readonly id: number
  readonly name: string
  up(db: Database.Database): void
}
