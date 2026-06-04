import { Link } from "react-router-dom"

export function Layout({children}: {children: React.ReactNode}) {
    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <header className="border-b border-gray-800 px-8 py-4 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-3">
                    <img src="/logo.jpg" alt="Logo" className="h-8 w-auto" />
                    <span className="text-xl font-bold">Batates' Catalogue</span>
                </Link>
                <nav className="flex gap-6">
                <Link to="/" className="text-gray-400 hover:text-white transition colors">Home</Link>
                <Link to="/albums" className="text-gray-400 hover:text-white transition colors">Albums</Link>
                <Link to="/search" className="text-gray-400 hover:text-white transition colors">Search</Link>
                </nav>
            </header>
        <main>
            {children}
        </main>
        </div>
    )
}