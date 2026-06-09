import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { AddAlbumForm } from "../components/AlbumForm"

describe("AddAlbumForm", () => {
  it("calls onSubmit with album data", () => {
    const onSubmit = vi.fn()
    render(<AddAlbumForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByPlaceholderText(/album name/i), { target: { value: "My Album" } })
    fireEvent.change(screen.getByPlaceholderText(/artist/i), { target: { value: "My Artist" } })
    fireEvent.change(screen.getByPlaceholderText(/release/i), { target: { value: "2024" } })
    fireEvent.click(screen.getByRole("button", { name: /add/i }))

    expect(onSubmit).toHaveBeenCalledWith({ title: "My Album", artist: "My Artist", release: "2024" })
  })

  it("does not submit when name is empty", () => {
    const onSubmit = vi.fn()
    render(<AddAlbumForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByPlaceholderText(/artist/i), { target: { value: "My Artist" } })
    fireEvent.click(screen.getByRole("button", { name: /add/i }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("does not submit when artist is empty", () => {
    const onSubmit = vi.fn()
    render(<AddAlbumForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByPlaceholderText(/album name/i), { target: { value: "My Album" } })
    fireEvent.click(screen.getByRole("button", { name: /add/i }))

    expect(onSubmit).not.toHaveBeenCalled()
  })
})
