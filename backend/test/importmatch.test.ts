import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from './setup.js'
import { createApp } from '../src/app.js'
import type { MusicBrainzResponse } from '../src/musicbrainz/models.js'
import { RateLimiter } from '../src/musicbrainz/client.js'
import type { MatchResponse } from '../src/importmatch/types.js'

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
    score: 100,
    ...overrides,
  }
}

function matchRequest(albums: unknown): Request {
  return new Request('http://localhost/api/import/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ albums }),
  })
}

function mockMusicBrainz(handler: (request: Request) => Response | Promise<Response>) {
  server.use(http.get(`${BASE}/release/`, ({ request }) => handler(request)))
}

function musicBrainzResponse(releases: ReturnType<typeof release>[]): MusicBrainzResponse {
  return {
    created: new Date().toISOString(),
    count: releases.length,
    offset: 0,
    releases: releases as MusicBrainzResponse['releases'],
  }
}

type MatchBody = MatchResponse

describe('POST /api/import/match', () => {
  it('returns each input with its best match and score-sorted alternatives', async () => {
    mockMusicBrainz(() =>
      HttpResponse.json(
        musicBrainzResponse([
          release({ id: 'mbid-best', score: 100 }),
          release({ id: 'mbid-low', score: 50 }),
          release({ id: 'mbid-second', score: 93 }),
          release({ id: 'mbid-third', score: 80 }),
          release({ id: 'mbid-fourth', score: 70 }),
        ]),
      ),
    )

    const res = await app.request(
      matchRequest([
        { title: 'Yellow Loveless', artist: 'My Dead Girlfriend' },
        { title: 'Loveless', artist: 'My Bloody Valentine' },
        { title: 'Souvlaki', artist: 'Slowdive' },
      ]),
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as MatchBody
    expect(body.matches).toHaveLength(3)
    for (const match of body.matches) {
      expect(match.best).toEqual({
        mbid: 'mbid-best',
        title: 'Yellow Loveless',
        artist: 'My Dead Girlfriend',
        date: '2013-02-14',
      })
      expect(match.alternatives.map((r) => r.mbid)).toEqual(['mbid-second', 'mbid-third', 'mbid-fourth', 'mbid-low'])
      expect(match.error).toBeUndefined()
    }
  })

  it('returns empty alternatives when MusicBrainz returns a single release', async () => {
    mockMusicBrainz(() => HttpResponse.json(musicBrainzResponse([release()])))

    const res = await app.request(matchRequest([{ title: 'Yellow Loveless', artist: 'My Dead Girlfriend' }]))

    expect(res.status).toBe(200)
    const body = (await res.json()) as MatchBody
    expect(body.matches[0]?.best).toEqual({
      mbid: 'mbid-1',
      title: 'Yellow Loveless',
      artist: 'My Dead Girlfriend',
      date: '2013-02-14',
    })
    expect(body.matches[0]?.alternatives).toEqual([])
    expect(body.matches[0]?.error).toBeUndefined()
  })

  it('returns best null and no error when MusicBrainz finds no candidates', async () => {
    mockMusicBrainz(() => HttpResponse.json(musicBrainzResponse([])))

    const res = await app.request(matchRequest([{ title: 'Nonexistent', artist: 'Nobody' }]))

    expect(res.status).toBe(200)
    const body = (await res.json()) as MatchBody
    expect(body.matches[0]?.best).toBeNull()
    expect(body.matches[0]?.alternatives).toEqual([])
    expect(body.matches[0]?.error).toBeUndefined()
  })

  it('returns matches: [] and 200 OK for an empty input array', async () => {
    const res = await app.request(matchRequest([]))

    expect(res.status).toBe(200)
    const body = (await res.json()) as MatchBody
    expect(body.matches).toEqual([])
  })

  it('takes best from MusicBrainz order even when it is not the top-scored release', async () => {
    mockMusicBrainz(() =>
      HttpResponse.json(
        musicBrainzResponse([
          release({ id: 'mbid-first-returned', score: 40 }),
          release({ id: 'mbid-higher-score', score: 90 }),
        ]),
      ),
    )

    const res = await app.request(matchRequest([{ title: 'Yellow Loveless', artist: 'My Dead Girlfriend' }]))

    expect(res.status).toBe(200)
    const body = (await res.json()) as MatchBody
    expect(body.matches[0]?.best?.mbid).toBe('mbid-first-returned')
    expect(body.matches[0]?.alternatives.map((r) => r.mbid)).toEqual(['mbid-higher-score'])
  })

  it('retries a row once when MusicBrainz fails and succeeds on the second call', async () => {
    let calls = 0
    mockMusicBrainz(() => {
      calls += 1
      if (calls === 1) return new HttpResponse(null, { status: 503 })
      return HttpResponse.json(musicBrainzResponse([release()]))
    })

    const res = await app.request(matchRequest([{ title: 'Yellow Loveless', artist: 'My Dead Girlfriend' }]))

    expect(res.status).toBe(200)
    expect(calls).toBe(2)
    const body = (await res.json()) as MatchBody
    expect(body.matches[0]?.best?.mbid).toBe('mbid-1')
    expect(body.matches[0]?.error).toBeUndefined()
  })

  it('returns a per-row musicbrainz_unavailable error after the retry fails, without failing the request', async () => {
    let calls = 0
    mockMusicBrainz(() => {
      calls += 1
      return new HttpResponse(null, { status: 503 })
    })

    const res = await app.request(matchRequest([{ title: 'Yellow Loveless', artist: 'My Dead Girlfriend' }]))

    expect(res.status).toBe(200)
    expect(calls).toBe(2)
    const body = (await res.json()) as MatchBody
    expect(body.matches[0]?.best).toBeNull()
    expect(body.matches[0]?.alternatives).toEqual([])
    expect(body.matches[0]?.error).toBe('musicbrainz_unavailable')
  })

  it('keeps successful rows when only some rows fail', async () => {
    mockMusicBrainz((request) => {
      const query = new URL(request.url).searchParams.get('query') ?? ''
      if (query.includes('Broken')) return new HttpResponse(null, { status: 503 })
      return HttpResponse.json(musicBrainzResponse([release()]))
    })
    const res = await app.request(
      matchRequest([
        { title: 'Yellow Loveless', artist: 'My Dead Girlfriend' },
        { title: 'Broken', artist: 'Nine Inch Nails' },
      ]),
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as MatchBody
    expect(body.matches).toHaveLength(2)
    expect(body.matches[0]?.best?.mbid).toBe('mbid-1')
    expect(body.matches[0]?.error).toBeUndefined()
    expect(body.matches[1]?.best).toBeNull()
    expect(body.matches[1]?.error).toBe('musicbrainz_unavailable')
  })

  it('returns 200 with per-row errors when every row fails', async () => {
    mockMusicBrainz(() => new HttpResponse(null, { status: 503 }))

    const res = await app.request(
      matchRequest([
        { title: 'Yellow Loveless', artist: 'My Dead Girlfriend' },
        { title: 'Loveless', artist: 'My Bloody Valentine' },
      ]),
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as MatchBody
    expect(body.matches).toHaveLength(2)
    for (const match of body.matches) {
      expect(match.best).toBeNull()
      expect(match.error).toBe('musicbrainz_unavailable')
    }
  })

  it('returns 400 when the body is not a valid match request', async () => {
    for (const albums of [undefined, 'nope', [{ title: 1, artist: 'x' }], [{ artist: 'no title' }]]) {
      const body = albums === undefined ? {} : { albums }
      const res = await app.request(
        new Request('http://localhost/api/import/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      )
      expect(res.status).toBe(400)
    }
  })
})
