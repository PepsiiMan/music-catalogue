import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs'
import * as SQLite from 'wa-sqlite'
// @ts-expect-error — no declaration file, but the JS module exists at runtime
import { OriginPrivateFileSystemVFS } from 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js'
import wasmUrl from 'wa-sqlite/dist/wa-sqlite-async.wasm?url'

let sqlite3: any = null
let db: number | null = null
let initPromise: Promise<void> | null = null
let queryQueue: Promise<void> = Promise.resolve()

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queryQueue = queryQueue.then(() => fn().then(resolve, reject))
  })
}

async function ensureInit() {
  if (sqlite3) return
  if (!initPromise) {
    initPromise = (async () => {
      const module = await SQLiteESMFactory({
        locateFile(url: string) {
          if (url.endsWith('.wasm')) return wasmUrl
          return url
        },
      })
      sqlite3 = SQLite.Factory(module)

      const vfs = new OriginPrivateFileSystemVFS()
      sqlite3.vfs_register(vfs, true)
      db = await sqlite3.open_v2('music-catalogue.db')

      const SCHEMA = `
        CREATE TABLE IF NOT EXISTS albums (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          artist TEXT NOT NULL,
          release TEXT,
          mbid TEXT
        )
      `
      await sqlite3.exec(db, SCHEMA)
    })()
  }
  await initPromise
}

addEventListener('message', async (e: any) => {
  const { id, method, sql, params } = e.data

  try {
    await ensureInit()

    let result: any
    switch (method) {
      case 'exec': {
        const execResult: any = await enqueue(() => sqlite3.execWithParams(db, sql, params ?? []))
        result = { columns: execResult.columns, rows: execResult.rows }
        break
      }
      default:
        throw new Error(`Unknown method: ${method}`)
    }
    ;(self as any).postMessage({ id, result })
  } catch (error: any) {
    ;(self as any).postMessage({ id, error: error.message })
  }
})
