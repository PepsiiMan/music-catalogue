import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "motion/react"
import type { Album } from "../types"
import { getCoverArt } from "../api/search"
import { RecordPlaceholder } from "./RecordPlaceholder"
import { ConfirmDialog } from "./ConfirmDialog"

interface Props {
    album: Album
    onDelete: (id: number) => void
}

export function AlbumCard({album, onDelete}: Props) {
    const [showConfirm, setShowConfirm] = useState(false)
    const { data: coverUrl } = useQuery({
        queryKey: ["coverart", album.mbid],
        queryFn: () => album.mbid ? getCoverArt(album.mbid) : null,
        enabled: !!album.mbid,
        staleTime: 1000 * 60 * 60,
    })

    return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-gray-600 rounded-xl p-6 border border-gray-700 hover:-translate-y-0.5 hover:shadow-lg transition-all flex gap-4"
        >
            <div className="flex-1">
                <h2 className="text-xl text-white font-semibold text-gray-900">{album.title}</h2>
                <p className="text-white  mt-1">{album.artist}</p>
                {album.release && (
                    <p className="text-sm text-gray-100">{album.release}</p>
                )}
                <button
                    onClick={() => setShowConfirm(true)}
                    className="mt-4 rounded-sm px-1 py-0.5 bg-red-500 hover:bg-red-700 text-sm"
                >
                    Remove
                </button>
            </div>
            {coverUrl ? (
                <img src={coverUrl} alt={album.title} crossOrigin="anonymous" className="w-32 h-32 object-cover rounded-lg flex-shrink-0" />
            ) : (
                <RecordPlaceholder />
            )}
            <ConfirmDialog
              open={showConfirm}
              title="Remove album"
              message={`Are you sure you want to remove "${album.title}" from your collection?`}
              confirmLabel="Remove"
              onConfirm={() => {
                onDelete(album.id)
                setShowConfirm(false)
              }}
              onCancel={() => setShowConfirm(false)}
            />
        </motion.div>
    )
}