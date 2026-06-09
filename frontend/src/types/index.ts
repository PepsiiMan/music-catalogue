export interface Album {
  id: number
  title: string
  artist: string
  release: string | null
  mbid?: string | null
}

export interface AlbumFilters {
  search?: string
  searchIn?: 'title' | 'artist' | 'both'
  sortBy?: 'release' | 'id' | 'title' | 'artist'
  order?: 'asc' | 'desc'
  limit?: number
}

export interface SearchResult {
  mbid: string
  title: string
  artist: string
  date: string
}
