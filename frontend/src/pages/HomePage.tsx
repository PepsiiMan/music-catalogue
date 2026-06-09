import { Link } from "react-router-dom"
import { motion } from "motion/react"

export function HomePage() {
    return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
        <div className="min-h-screen flex items-center justify-center">
            <div className="max-w-4xl w-full p-8">
            <div className="text-center">
                <h1 className="text-4xl text-white font-bold">Music Catalogue</h1>
                <p className="text-gray-500 mt-2"> Your personal collection</p>
            </div>

            <div className="grid grid-cols1 md:grid-cols-2 gap-4 mt-12">
                <Link to="/albums" className="p-6 bg-gray-600 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                    <h2 className="text-xl text-white font-semibold">Albums</h2>
                    <p className="text-white mt-1">View/edit your albums</p>
                </Link>
            </div>

            </div>
        </div>
        </motion.div>
    )
}
