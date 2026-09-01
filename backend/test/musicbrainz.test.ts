import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from './setup.js'
import { createApp } from '../src/app.js'
import type { MusicBrainzResponse } from '../src/musicbrainz/models.js'
import { RateLimiter } from '../src/musicbrainz/client.js'

const app = createApp(new RateLimiter(1))

const BASE = 'https://musicbrainz.org/ws/2'

function release(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mbid-1',
    title: 'Yellow Loveless',
    disambiguation: '',
    'artist-credit': [
      {
        name: 'My Dead Girlfriend',
        joinphrase: '',
        artist: { id: 'a-1', name: 'My Dead Girlfriend', 'sort-name': 'My Dead Girlfriend', disambiguation: '' },
      },
    ],
    date: '2013-02-14',
    ...overrides,
  }
}

describe('GET /api/search/albums', () => {
  it('maps MusicBrainz releases to the ReleaseDTO contract', async () => {
    let sawQuery = ''
    server.use(
      http.get(`${BASE}/release/`, ({ request }) => {
        const url = new URL(request.url)
        sawQuery = url.searchParams.get('query') ?? ''
        const body: MusicBrainzResponse = {
          created: new Date().toISOString(),
          count: 1,
          offset: 0,
          releases: [release()] as MusicBrainzResponse['releases'],
        }
        return HttpResponse.json(body)
      }),
    )

    const res = await app.request('http://localhost/api/search/albums?title=Yellow%20Loveless&artist=My%20Dead%20Girlfriend')

    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<Record<string, unknown>>
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      mbid: 'mbid-1',
      title: 'Yellow Loveless',
      artist: 'My Dead Girlfriend',
      date: '2013-02-14',
    })
    expect(sawQuery).toBe('title:"Yellow Loveless" AND artist:"My Dead Girlfriend"')
  })

  it('skips releases with an empty artist-credit instead of failing', async () => {
    server.use(
      http.get(`${BASE}/release/`, () =>
        HttpResponse.json({ created: '', count: 2, offset: 0, releases: [release({ 'artist-credit': [] }), release({ id: 'mbid-2' })] }),
      ),
    )

    const res = await app.request('http://localhost/api/search/albums?title=x')

    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<Record<string, unknown>>
    expect(results).toHaveLength(1)
    expect(results[0]?.mbid).toBe('mbid-2')
  })

  it('returns 503 when MusicBrainz responds with an error status', async () => {
    server.use(http.get(`${BASE}/release/`, () => new HttpResponse(null, { status: 503 })))

    const res = await app.request('http://localhost/api/search/albums?title=x')

    expect(res.status).toBe(503)
  })

  it('returns 503 when MusicBrainz is unreachable', async () => {
    server.use(http.get(`${BASE}/release/`, () => HttpResponse.error()))

    const res = await app.request('http://localhost/api/search/albums?title=x')

    expect(res.status).toBe(503)
  })
})
