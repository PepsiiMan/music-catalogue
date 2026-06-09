import { Link, useLocation } from "react-router-dom"

const navLinks = [
  {
    to: "/",
    label: "Home",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    to: "/albums",
    label: "Albums",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
      </svg>
    ),
  },
  {
    to: "/search",
    label: "Search",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
    ),
  },
]

export function Layout({children}: {children: React.ReactNode}) {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-20 md:pb-0">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-gray-950/80 border-b border-gray-800 px-8 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Logo" className="h-8 w-auto" />
          <span className="text-xl font-bold">Batates' Catalogue</span>
        </Link>
        <nav className="hidden md:flex gap-6">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={pathname === link.to ? "text-white" : "text-gray-400 hover:text-white transition-colors"}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main>
        {children}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-gray-950/90 backdrop-blur-md border-t border-gray-800 flex justify-around py-3 z-50">
        {navLinks.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className={`flex flex-col items-center gap-1 ${pathname === link.to ? "text-white" : "text-gray-400"}`}
          >
            {link.icon}
            <span className="text-xs">{link.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
