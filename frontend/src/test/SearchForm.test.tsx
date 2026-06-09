import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { SearchForm } from "../components/SearchForm"

describe("SearchForm", () => {
  it("calls onSubmit with title and artist", () => {
    const onSubmit = vi.fn()
    render(<SearchForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByPlaceholderText(/album title/i), { target: { value: "Test Song" } })
    fireEvent.change(screen.getByPlaceholderText(/artist/i), { target: { value: "Test Artist" } })
    fireEvent.click(screen.getByRole("button", { name: /search/i }))

    expect(onSubmit).toHaveBeenCalledWith({ title: "Test Song", artist: "Test Artist" })
  })

  it("does not submit when both fields are empty", () => {
    const onSubmit = vi.fn()
    render(<SearchForm onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole("button", { name: /search/i }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("pre-fills initial values", () => {
    const onSubmit = vi.fn()
    render(<SearchForm onSubmit={onSubmit} initialTitle="Pre" initialArtist="Filled" />)

    expect((screen.getByPlaceholderText(/album title/i) as HTMLInputElement).value).toBe("Pre")
    expect((screen.getByPlaceholderText(/artist/i) as HTMLInputElement).value).toBe("Filled")
  })
})
