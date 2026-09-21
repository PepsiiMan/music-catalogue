import type { AlbumQuery, MatchResponse } from '../types'
import { api } from './client'
import { AxiosError } from 'axios'

export class MatchNetworkError extends Error {
  constructor(message = "Network error. Please check your connection.") {
    super(message)
    this.name = "MatchNetworkError"
  }
}

export class MatchServerError extends Error {
  constructor(message = "Server error. Please try again later.") {
    super(message)
    this.name = "MatchServerError"
  }
}

export class MatchInvalidResponseError extends Error {
  constructor(message = "Invalid response from server.") {
    super(message)
    this.name = "MatchInvalidResponseError"
  }
}

function isValidMatchResponse(data: unknown): data is MatchResponse {
  if (typeof data !== "object" || data === null) return false
  const candidate = data as Record<string, unknown>
  if (!Array.isArray(candidate.matches)) return false
  return candidate.matches.every((match) => {
    const m = match as Record<string, unknown>
    return (
      typeof m === "object" &&
      m !== null &&
      typeof m.input === "object" &&
      typeof (m.input as Record<string, unknown>).title === "string" &&
      typeof (m.input as Record<string, unknown>).artist === "string" &&
      Array.isArray(m.alternatives)
    )
  })
}

export const matchAlbums = async (albums: AlbumQuery[]): Promise<MatchResponse> => {
  try {
    const response = await api.post<unknown>('/import/match', { albums })
    if (!isValidMatchResponse(response.data)) {
      throw new MatchInvalidResponseError()
    }
    return response.data
  } catch (error) {
    if (error instanceof MatchInvalidResponseError) throw error
    if (error instanceof AxiosError) {
      if (!error.response) throw new MatchNetworkError()
      if (error.response.status >= 500) throw new MatchServerError()
    }
    throw new MatchServerError("Matching failed. Please try again.")
  }
}
