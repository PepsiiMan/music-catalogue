import React from "react"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, vi } from "vitest"
import { HomePage } from "../pages/HomePage"
import { getAlbumCount, getAlbums, getRandomAlbum } from "../api/albums"

vi.mock("../api/albums", () => ({
  getAlbumCount: vi.fn(),
  getAlbums: vi.fn(),
  getRandomAlbum: vi.fn(),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </MemoryRouter>
    )
  }
}

describe("HomePage", () => {
  it("renders hero heading and subtitle", () => {
    render(<HomePage />, { wrapper: createWrapper() })
    expect(screen.getByText("Music Catalogue")).toBeInTheDocument()
    expect(screen.getByText("Your personal collection")).toBeInTheDocument()
  })

  it("displays total album count from query", async () => {
    vi.mocked(getAlbumCount).mockResolvedValue(12)
    render(<HomePage />, { wrapper: createWrapper() })
    expect(await screen.findByText(/12/)).toBeInTheDocument()
  })

  it("renders recently added albums row", async () => {
    const albums = [
      { id: 4, title: "Album Four", artist: "Artist D", release: "2024", mbid: null },
      { id: 3, title: "Album Three", artist: "Artist C", release: "2023", mbid: null },
    ]
    vi.mocked(getAlbums).mockResolvedValue(albums)
    render(<HomePage />, { wrapper: createWrapper() })
    expect(await screen.findByText("Album Four")).toBeInTheDocument()
    expect(screen.getByText("Album Three")).toBeInTheDocument()
  })

  it("displays random album as featured card", async () => {
    vi.mocked(getRandomAlbum).mockResolvedValue({
      id: 7, title: "Featured Album", artist: "Top Artist", release: "2025", mbid: null,
    })
    render(<HomePage />, { wrapper: createWrapper() })
    expect(await screen.findByText("Featured Album")).toBeInTheDocument()
    expect(screen.getByText("Top Artist")).toBeInTheDocument()
  })

  it("shows empty state when no albums exist", async () => {
    vi.mocked(getAlbumCount).mockResolvedValue(0)
    vi.mocked(getAlbums).mockResolvedValue([])
    vi.mocked(getRandomAlbum).mockResolvedValue(undefined)
    render(<HomePage />, { wrapper: createWrapper() })
    expect(await screen.findByText(/0/)).toBeInTheDocument()
    expect(screen.getByText(/no albums/i)).toBeInTheDocument()
  })

  it("renders all sections in correct order with staggered animation wrappers", async () => {
    vi.mocked(getAlbumCount).mockResolvedValue(42)
    vi.mocked(getAlbums).mockResolvedValue([
      { id: 1, title: "New Album", artist: "Artist", release: "2026", mbid: null },
    ])
    vi.mocked(getRandomAlbum).mockResolvedValue({
      id: 2, title: "Rand", artist: "Art", release: "2025", mbid: null,
    })
    render(<HomePage />, { wrapper: createWrapper() })

    expect(await screen.findByText("Music Catalogue")).toBeInTheDocument()
    expect(await screen.findByText("42")).toBeInTheDocument()
    expect(screen.getByText("Recently Added")).toBeInTheDocument()
    expect(screen.getByText("Random Album")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /albums/i })).toBeInTheDocument()
  })
})
