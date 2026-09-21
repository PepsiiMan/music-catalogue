import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

const app = createApp()

describe('middleware', () => {
  it('GET /health returns 200', async () => {
    const res = await app.request('http://localhost/health')
    expect(res.status).toBe(200)
  })

  it('rejects oversized bodies on /api/import with 413', async () => {
    const res = await app.request(
      new Request('http://localhost/api/import/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=x',
          'Content-Length': String(31 << 20),
        },
        body: 'x',
      }),
    )
    expect(res.status).toBe(413)
  })

  it('rejects oversized bodies on /api/search with 413', async () => {
    const res = await app.request(
      new Request('http://localhost/api/search/albums', {
        method: 'POST',
        headers: { 'Content-Length': String(2 << 20) },
        body: 'x',
      }),
    )
    expect(res.status).toBe(413)
  })
})
