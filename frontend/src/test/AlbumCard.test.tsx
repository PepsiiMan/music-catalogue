import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AlbumCard } from "../components/AlbumCard"
import type { Album } from "../types"

const mockGetCoverArt = vi.fn()

vi.mock("../api/search", () => ({
  getCoverArt: (...args: unknown[]) => mockGetCoverArt(...args),
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const baseAlbum: Album = {
  id: 1,
  title: "Test Album",
  artist: "Test Artist",
  release: "2024",
  mbid: null,
}

describe("AlbumCard", () => {
  beforeEach(() => {
    mockGetCoverArt.mockReset()
  })

  it("opens confirm dialog with album name when Remove is clicked", () => {
    const onDelete = vi.fn()
    render(<AlbumCard album={baseAlbum} onDelete={onDelete} />, { wrapper: Wrapper })

    fireEvent.click(screen.getByRole("button", { name: /remove/i }))

    expect(screen.getByRole("heading", { name: /remove album/i })).toBeInTheDocument()
    expect(screen.getByText(/Are you sure you want to remove "Test Album"/)).toBeInTheDocument()
  })

  it("calls onDelete with album id when dialog is confirmed", () => {
    const onDelete = vi.fn()
    render(<AlbumCard album={baseAlbum} onDelete={onDelete} />, { wrapper: Wrapper })

    fireEvent.click(screen.getByRole("button", { name: /remove/i }))

    const confirmBtn = screen.getAllByRole("button", { name: /remove/i })[1]
    fireEvent.click(confirmBtn)

    expect(onDelete).toHaveBeenCalledWith(1)
  })

  it("does not call onDelete when dialog is cancelled", () => {
    const onDelete = vi.fn()
    render(<AlbumCard album={baseAlbum} onDelete={onDelete} />, { wrapper: Wrapper })

    fireEvent.click(screen.getByRole("button", { name: /remove/i }))

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))

    expect(onDelete).not.toHaveBeenCalled()
  })

  it("renders with border-gray-700 and hover lift classes", () => {
    const onDelete = vi.fn()
    const { container } = render(<AlbumCard album={baseAlbum} onDelete={onDelete} />, { wrapper: Wrapper })

    const card = container.firstChild as HTMLElement
    expect(card.className).toContain("border-gray-700")
    expect(card.className).toContain("hover:-translate-y-0.5")
    expect(card.className).toContain("hover:shadow-lg")
    expect(card.className).toContain("transition-all")
  })
})
