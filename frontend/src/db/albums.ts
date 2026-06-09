import { getDb } from './init'
import type { Album, AlbumFilters } from '../types'

function rowToAlbum(row: unknown[], columns: string[]): Album {
  const map = Object.fromEntries(columns.map((c, i) => [c, row[i]]))
  return {
    id: map.id as number,
    title: map.title as string,
    artist: map.artist as string,
    release: (map.release as string | null) ?? null,
    mbid: (map.mbid as string | null) ?? null,
  }
}

export async function getAlbums(filters: AlbumFilters = {}): Promise<Album[]> {
  const db = await getDb()

  const conditions: string[] = []
  const params: (string | number | null)[] = []

  if (filters.search) {
    const like = `%${filters.search}%`
    if (filters.searchIn === 'title') {
      conditions.push('title LIKE ?')
      params.push(like)
    } else if (filters.searchIn === 'artist') {
      conditions.push('artist LIKE ?')
      params.push(like)
    } else {
      conditions.push('(title LIKE ? OR artist LIKE ?)')
      params.push(like, like)
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const ALLOWED_SORT = new Set(['id', 'title', 'artist', 'release'])
  const sortBy = filters.sortBy && ALLOWED_SORT.has(filters.sortBy) ? filters.sortBy : 'id'
  const order = filters.order === 'asc' ? 'ASC' : 'DESC'
  const orderClause = `ORDER BY ${sortBy} ${order}`

  const limitClause = filters.limit ? 'LIMIT ?' : ''
  if (filters.limit) params.push(filters.limit)

  const sql = `SELECT id, title, artist, release, mbid FROM albums ${where} ${orderClause} ${limitClause}`.trim()
  const result = await db.execWithParams(sql, params)
  return result.rows.map((row) => rowToAlbum(row, result.columns))
}

export async function getAlbumCount(): Promise<number> {
  const db = await getDb()
  const result = await db.execWithParams('SELECT COUNT(*) FROM albums')
  return Number(result.rows[0][0])
}

export async function getRandomAlbum(): Promise<Album | undefined> {
  const db = await getDb()
  const result = await db.execWithParams(
    'SELECT id, title, artist, release, mbid FROM albums ORDER BY RANDOM() LIMIT 1',
  )
  if (!result.rows.length) return undefined
  return rowToAlbum(result.rows[0], result.columns)
}

export async function getAlbum(id: number): Promise<Album | undefined> {
  const db = await getDb()
  const result = await db.execWithParams('SELECT id, title, artist, release, mbid FROM albums WHERE id = ?', [id])
  if (!result.rows.length) return undefined
  return rowToAlbum(result.rows[0], result.columns)
}

export async function createAlbum(album: Omit<Album, 'id'>): Promise<Album> {
  const db = await getDb()
  await db.execWithParams(
    'INSERT INTO albums (title, artist, release, mbid) VALUES (?, ?, ?, ?)',
    [album.title, album.artist, album.release, album.mbid ?? null],
  )
  const result = await db.execWithParams('SELECT last_insert_rowid()')
  const id = Number(result.rows[0][0])
  return { ...album, id }
}

export async function deleteAlbum(id: number): Promise<void> {
  const db = await getDb()
  await db.execWithParams('DELETE FROM albums WHERE id = ?', [id])
}
