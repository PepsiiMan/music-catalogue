import { z } from 'zod'
import type { ReleaseDTO, ScoredRelease } from '../musicbrainz/models.js'

export interface AlbumQuery {
  title: string
  artist: string
}

export const MatchRequestSchema = z.object({
  albums: z.array(
    z.object({
      title: z.string(),
      artist: z.string(),
    }),
  ),
})

export type MatchRequest = z.infer<typeof MatchRequestSchema>

export interface MatchResult {
  input: AlbumQuery
  best: ReleaseDTO | null
  alternatives: ReleaseDTO[]
  error?: 'musicbrainz_unavailable'
}

export interface MatchResponse {
  matches: MatchResult[]
}

/** The seam the orchestrator matches against: satisfied structurally by MusicBrainzClient. */
export interface AlbumSearcher {
  searchScoredAlbums(title: string, artist: string, limit: number): Promise<ScoredRelease[]>
}

/** MusicBrainz returns at most these many alternatives per row (releases[1..5]). */
export const MAX_ALTERNATIVES = 4
