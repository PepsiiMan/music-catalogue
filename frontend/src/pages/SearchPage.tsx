import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { getReleasesByTitle, getReleasesByArtist, getReleasesByTitleAndArtist } from '../api/search'
import { createAlbum } from '../db/albums'
import { SearchCard } from '../components/SearchCard'
import { SearchForm } from '../components/SearchForm'
import type { SearchResult } from '../types'

export function SearchPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const title = searchParams.get('title') || ''
  const artist = searchParams.get('artist') || ''

  const { data: results, isLoading, error } = useQuery({
    queryKey: ['search', title, artist],
    queryFn: () => {
      if (title && artist) {
        return getReleasesByTitleAndArtist(title, artist)
      } else if (artist) {
        return getReleasesByArtist(artist)
      } else {
        return getReleasesByTitle(title)
      }
    },
    enabled: !!title || !!artist,
    staleTime: 1000 * 60 * 60,
  })

  const addMutation = useMutation({
    mutationFn: createAlbum,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['albums'] }),
  })

  const handleSubmit = ({ title, artist }: { title: string; artist: string }) => {
    const params = new URLSearchParams()
    if (title) params.set('title', title)
    if (artist) params.set('artist', artist)
    setSearchParams(params)
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Search</h1>

      <SearchForm onSubmit={handleSubmit} initialTitle={title} initialArtist={artist} />

      {isLoading && <p className="text-gray-400 mt-8">Searching...</p>}

      {error && (
        <p className="text-red-400 mt-8">Search failed. Is the backend running?</p>
      )}

      {Array.isArray(results) && results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          {results.map((result: SearchResult) => (
            <SearchCard
              key={result.mbid}
              result={result}
              onAdd={(album) => addMutation.mutate(album)}
              isAdding={addMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}
