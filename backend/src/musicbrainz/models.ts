/** A Release as returned to clients: the fields of a MusicBrainz release worth searching by. */
export interface ReleaseDTO {
  mbid: string
  title: string
  artist: string
  date: string
}

/** A ReleaseDTO plus MusicBrainz's relevance score, used to rank match alternatives. */
export interface ScoredRelease extends ReleaseDTO {
  score: number
}

export function toRelease(scored: ScoredRelease): ReleaseDTO {
  return { mbid: scored.mbid, title: scored.title, artist: scored.artist, date: scored.date }
}

/** Raw MusicBrainz API shapes (subset, as used by the Go backend). */
export interface MusicBrainzArtist {
  id: string
  name: string
  'sort-name': string
  disambiguation: string
}

export interface MusicBrainzArtistCredit {
  name: string
  joinphrase: string
  artist: MusicBrainzArtist
}

export interface MusicBrainzRelease {
  id: string
  title: string
  disambiguation: string
  'artist-credit': MusicBrainzArtistCredit[]
  date: string
  /** Relevance score (0-100); called "ext:score" in the XML API. */
  score: number
}

export interface MusicBrainzResponse {
  created: string
  count: number
  offset: number
  releases: MusicBrainzRelease[]
}
