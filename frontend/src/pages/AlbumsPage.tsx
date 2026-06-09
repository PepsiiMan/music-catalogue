import { useState } from "react"
import { useQuery, useMutation, useQueryClient} from "@tanstack/react-query"
import { getAlbums, createAlbum, deleteAlbum, type AlbumFilters } from "../api/albums"
import { AlbumCard } from "../components/AlbumCard"
import { AddAlbumForm } from "../components/AlbumForm"
import { FilterWidget } from "../components/FilterWidget"
import { SkeletonCard } from "../components/SkeletonCard"
import { motion } from "motion/react"
import { useToast } from "../components/Toast"

export function AlbumsPage() {
    const queryClient = useQueryClient()
    const [filters, setFilters] = useState<AlbumFilters>({})
    const { toast } = useToast()

    const { data: albums, isLoading } = useQuery({
        queryKey: ["albums", filters],
        queryFn: () => getAlbums(filters)
    })

    const addMutation = useMutation({
        mutationFn: createAlbum,
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ["albums"]})
            toast("Album added", "success")
        },
        onError: () => {
            toast("Failed to add album", "error")
        },
    })

    const deleteMutation = useMutation({
        mutationFn: deleteAlbum,
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ["albums"]})
            toast("Album removed", "success")
        },
        onError: () => {
            toast("Failed to remove album", "error")
        },
    })

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
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonCard key={i} />
                    ))
                ) : Array.isArray(albums) && albums.length > 0 ? (
                    albums.map(album => (
                        <AlbumCard
                            key={album.id}
                            album={album}
                            onDelete={id => deleteMutation.mutate(id)}
                        />
                    ))
                ) : (
                    <div className="col-span-full text-center py-16">
                        <p className="text-xl text-gray-300">Your collection is empty</p>
                        <p className="text-gray-500 mt-2">
                            <a href="/search" className="text-violet-400 hover:text-violet-300 underline">Search for music</a> to add your first album
                        </p>
                    </div>
                )}
            </div>
        </div>
        </motion.div>
    )
}
