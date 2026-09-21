/** A Release as returned to clients: the fields of a MusicBrainz release worth searching by. */
export interface ReleaseDTO {
  mbid: string
  title: string
  artist: string
  date: string
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
}

export interface MusicBrainzResponse {
  created: string
  count: number
  offset: number
  releases: MusicBrainzRelease[]
}
