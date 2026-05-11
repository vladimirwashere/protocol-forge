import type Database from 'better-sqlite3'

export function addColumnIfMissing(db: Database.Database, table: string, definition: string): void {
  const columnName = definition.split(' ')[0]
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
  }
}
