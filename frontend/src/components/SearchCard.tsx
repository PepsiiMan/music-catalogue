import { useQuery } from '@tanstack/react-query'
import type { SearchResult } from '../types'
import { getCoverArt } from '../api/search'
import type { Album } from '../types'

interface Props {
  result: SearchResult
  onAdd: (album: Omit<Album, 'id'>) => void
  isAdding: boolean
}

export function SearchCard({ result, onAdd, isAdding }: Props) {
  const { data: coverUrl } = useQuery({
    queryKey: ['coverart', result.mbid],
    queryFn: () => (result.mbid ? getCoverArt(result.mbid) : null),
    enabled: !!result.mbid,
    staleTime: 1000 * 60 * 60,
  })

  const handleAdd = () => {
    onAdd({
      title: result.title,
      artist: result.artist,
      release: result.date || null,
      mbid: result.mbid,
    })
  }

  return (
    <div className="bg-gray-600 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex gap-4">
      <div className="flex-1">
        <h2 className="text-xl font-semibold text-gray-900">
          {result.title}
        </h2>
        <p className="mt-1">
          {result.artist}
        </p>
        {result.date && (
          <p className="text-sm text-gray-100">{result.date}</p>
        )}
        <button
          onClick={handleAdd}
          disabled={isAdding}
          className="mt-4 rounded-sm px-1 py-0.5 bg-green-500 hover:bg-green-700 text-sm disabled:opacity-50"
        >
          {isAdding ? 'Adding...' : 'Add'}
        </button>
      </div>
      {coverUrl && (
        <img src={coverUrl} alt={result.title} crossOrigin="anonymous" className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />
      )}
    </div>
  )
}
