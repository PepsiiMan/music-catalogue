import { toRelease } from '../musicbrainz/models.js'
import type { ScoredRelease } from '../musicbrainz/models.js'
import {
  MAX_ALTERNATIVES,
  type AlbumQuery,
  type AlbumSearcher,
  type MatchRequest,
  type MatchResponse,
  type MatchResult,
} from './types.js'

const MAX_RETRIES = 1
const RETRY_DELAY_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toMatchResult(input: AlbumQuery, releases: ScoredRelease[]): MatchResult {
  const best = releases[0]
  const alternatives = releases.slice(1, 1 + MAX_ALTERNATIVES).sort((a, b) => b.score - a.score)
  return {
    input,
    best: best ? toRelease(best) : null,
    alternatives: alternatives.map(toRelease),
  }
}

export function createMatchOrchestrator(searcher: AlbumSearcher) {
  return async function matchAlbums(albums: MatchRequest['albums']): Promise<MatchResponse> {
    const matches: MatchResult[] = []

    for (const input of albums) {
      let releases: ScoredRelease[] | undefined
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          releases = await searcher.searchScoredAlbums(input.title, input.artist, 1 + MAX_ALTERNATIVES)
          break
        } catch {
          if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS)
        }
      }

      if (releases) {
        matches.push(toMatchResult(input, releases))
      } else {
        matches.push({ input, best: null, alternatives: [], error: 'musicbrainz_unavailable' })
      }
    }

    return { matches }
  }
}
