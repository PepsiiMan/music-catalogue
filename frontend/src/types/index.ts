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

export interface DetectedAlbum {
  title: string
  artist: string
  row: number
  col: number
  source_frame: number
}

export interface DetectionResult {
  albums: DetectedAlbum[]
  total_frames_processed: number
  frames_with_detections: number
}
