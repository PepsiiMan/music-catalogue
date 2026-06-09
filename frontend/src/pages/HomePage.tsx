import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { motion } from "motion/react"
import { getAlbumCount, getAlbums, getRandomAlbum } from "../api/albums"

const sectionProps = (delay: number) => ({
  initial: { opacity: 0, y: 20 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay, duration: 0.3 } as const,
})

export function HomePage() {
  const { data: albumCount } = useQuery({
    queryKey: ["album-count"],
    queryFn: getAlbumCount,
  })

  const { data: recentAlbums } = useQuery({
    queryKey: ["recent-albums"],
    queryFn: () => getAlbums({ limit: 4 }),
  })

  const { data: randomAlbum } = useQuery({
    queryKey: ["random-album"],
    queryFn: getRandomAlbum,
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="max-w-4xl mx-auto p-8">
        <motion.div {...sectionProps(0)}>
          <div className="text-center">
            <h1 className="text-4xl text-white font-bold">Music Catalogue</h1>
            <p className="text-gray-500 mt-2">Your personal collection</p>
          </div>
        </motion.div>

        <motion.div {...sectionProps(0.1)}>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 bg-gray-600 rounded-xl border border-gray-700">
              <p className="text-3xl text-white font-bold">{albumCount ?? "—"}</p>
              <p className="text-gray-400 mt-1">Albums</p>
            </div>
          </div>
        </motion.div>

        {recentAlbums && recentAlbums.length > 0 && (
          <motion.div {...sectionProps(0.2)}>
            <div className="mt-8">
              <h2 className="text-xl text-white font-semibold mb-4">Recently Added</h2>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {recentAlbums.map((album) => (
                  <div key={album.id} className="flex-shrink-0 w-48 bg-gray-600 rounded-xl p-4 border border-gray-700">
                    <p className="text-white font-semibold truncate">{album.title}</p>
                    <p className="text-gray-400 text-sm truncate">{album.artist}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {albumCount === 0 && (
          <motion.div {...sectionProps(0.2)}>
            <div className="mt-8 text-center p-8 bg-gray-600 rounded-xl border border-gray-700">
              <p className="text-white text-lg">No albums in your collection yet</p>
              <p className="text-gray-400 mt-2">Start by searching and adding your first album!</p>
            </div>
          </motion.div>
        )}

        {randomAlbum && albumCount !== 0 && (
          <motion.div {...sectionProps(0.3)}>
            <div className="mt-8">
              <h2 className="text-xl text-white font-semibold mb-4">Random Album</h2>
              <div className="bg-gray-600 rounded-xl p-6 border border-gray-700">
                <p className="text-2xl text-white font-bold">{randomAlbum.title}</p>
                <p className="text-gray-400 mt-1">{randomAlbum.artist}</p>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div {...sectionProps(0.4)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <Link to="/albums" className="p-6 bg-gray-600 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-xl text-white font-semibold">Albums</h2>
              <p className="text-white mt-1">View/edit your albums</p>
            </Link>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
