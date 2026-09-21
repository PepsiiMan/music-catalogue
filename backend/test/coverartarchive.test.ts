import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from './setup.js'
import { createApp } from '../src/app.js'

const app = createApp()

const BASE = 'https://coverartarchive.org'

describe('GET /api/search/coverart/:mbid/front', () => {
  it('returns the redirect Location as {url}', async () => {
    server.use(
      http.get(`${BASE}/release/mbid-1/front`, () =>
        new HttpResponse(null, {
          status: 307,
          headers: { Location: 'https://archive.org/download/mbid-1/front.jpg' },
        }),
      ),
    )

    const res = await app.request('http://localhost/api/search/coverart/mbid-1/front')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://archive.org/download/mbid-1/front.jpg' })
  })

  it('returns 503 when there is no cover art (404)', async () => {
    server.use(http.get(`${BASE}/release/mbid-1/front`, () => new HttpResponse(null, { status: 404 })))

    const res = await app.request('http://localhost/api/search/coverart/mbid-1/front')

    expect(res.status).toBe(503)
  })

  it('returns 503 when coverartarchive is unreachable', async () => {
    server.use(http.get(`${BASE}/release/mbid-1/front`, () => HttpResponse.error()))

    const res = await app.request('http://localhost/api/search/coverart/mbid-1/front')

    expect(res.status).toBe(503)
  })
})
