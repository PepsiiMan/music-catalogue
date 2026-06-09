import { useQuery, useMutation, useQueryClient} from "@tanstack/react-query"
import { getAlbums, createAlbum, deleteAlbum, type AlbumFilters } from "../api/albums"
import { AlbumCard } from "../components/AlbumCard"
import { AddAlbumForm } from "../components/AlbumForm"
import { FilterWidget } from "../components/FilterWidget"
import { useState } from "react"
import { motion } from "motion/react"

export function AlbumsPage() {
    const queryClient = useQueryClient()
    const [filters, setFilters] = useState<AlbumFilters>({})

    const { data: albums, isLoading } = useQuery({
        queryKey: ["albums", filters],
        queryFn: () => getAlbums(filters)
    })

    const addMutation = useMutation({
        mutationFn: createAlbum,
        onSuccess: () => queryClient.invalidateQueries({queryKey: ["albums"]})
    })

    const deleteMutation = useMutation({
        mutationFn: deleteAlbum,
        onSuccess: () => queryClient.invalidateQueries({queryKey: ["albums"]})
    })

    if (isLoading) return <p className="text-gray-500">Loading albums...</p>

    return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
        <div className="max-w-4xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-8">My Collection</h1>
            <FilterWidget filters={filters} onChange={setFilters} />
            <AddAlbumForm onSubmit={data => addMutation.mutate(data)} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                {Array.isArray(albums) && albums.map(album => (
                    <AlbumCard 
                        key={album.id}
                        album={album}
                        onDelete={id => deleteMutation.mutate(id)}
                    />
                ))}
            </div>

        </div>
        </motion.div>
    )
}
