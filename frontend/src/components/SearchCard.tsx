import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SearchResult } from '../types'
import { getCoverArt } from '../api/search'
import type { Album } from '../types'
import { RecordPlaceholder } from './RecordPlaceholder'
import { motion } from 'motion/react'
import { useToast } from './Toast'

interface Props {
  result: SearchResult
  onAdd: (album: Omit<Album, 'id'>) => Promise<unknown>
}

export function SearchCard({ result, onAdd }: Props) {
  const { toast } = useToast()
  const [isAdding, setIsAdding] = useState(false)

  const { data: coverUrl } = useQuery({
    queryKey: ['coverart', result.mbid],
    queryFn: () => (result.mbid ? getCoverArt(result.mbid) : null),
    enabled: !!result.mbid,
    staleTime: 1000 * 60 * 60,
  })

  const handleAdd = async () => {
    setIsAdding(true)
    try {
      await onAdd({
        title: result.title,
        artist: result.artist,
        release: result.date || null,
        mbid: result.mbid,
      })
      toast('Album added', 'success')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-gray-600 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex gap-4 border border-gray-700"
    >
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
          className="mt-4 rounded-sm px-1 py-0.5 bg-green-500 hover:bg-green-700 text-sm disabled:opacity-50 flex items-center gap-1"
        >
          {isAdding ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : 'Add'}
        </button>
      </div>
      {coverUrl ? (
        <img src={coverUrl} alt={result.title} crossOrigin="anonymous" className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />
      ) : (
        <RecordPlaceholder />
      )}
    </motion.div>
  )
}
