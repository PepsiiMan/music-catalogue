type ExecResult = { columns: string[]; rows: any[][] }

class DbClient {
  private worker: Worker | null = null
  private nextId = 1
  private pending = new Map<number, { resolve: (value: any) => void; reject: (reason: any) => void }>()

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (e: MessageEvent) => {
        const { id, result, error } = e.data
        const p = this.pending.get(id)
        if (p) {
          this.pending.delete(id)
          if (error) p.reject(new Error(error))
          else p.resolve(result)
        }
      }
      this.worker.onerror = () => {
        for (const [, p] of this.pending) {
          p.reject(new Error('DB worker crashed'))
        }
        this.pending.clear()
      }
    }
    return this.worker
  }

  async execWithParams(sql: string, params: any[] = []): Promise<ExecResult> {
    const worker = this.getWorker()
    return new Promise((resolve, reject) => {
      const id = this.nextId++
      this.pending.set(id, { resolve, reject })
      worker.postMessage({ id, method: 'exec', sql, params })
    })
  }
}

let client: DbClient | null = null

export async function getDb(): Promise<DbClient> {
  if (!client) {
    client = new DbClient()
  }
  return client
}
