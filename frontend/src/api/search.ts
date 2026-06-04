import type { SearchResult } from '../types'
import { api } from './client'

interface CoverArtResponse {
  url: string | null
}

function parseSearchResults(data: unknown): SearchResult[] {
  return Array.isArray(data) ? data : []
}

export const getReleasesByTitle = (title: string) =>
  api.get<SearchResult[]>('/search/albums', { params: { title } }).then(r => parseSearchResults(r.data)).catch(() => [])

export const getReleasesByArtist = (artist: string) =>
  api.get<SearchResult[]>('/search/albums', { params: { artist } }).then(r => parseSearchResults(r.data)).catch(() => [])

export const getReleasesByTitleAndArtist = (title: string, artist: string) =>
  api.get<SearchResult[]>('/search/albums', { params: { title, artist } }).then(r => parseSearchResults(r.data)).catch(() => [])

export const getCoverArt = (mbid: string) =>
  api.get<CoverArtResponse>(`/search/coverart/${mbid}/front`).then(r => r.data.url).catch(() => null)
