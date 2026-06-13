import React from "react"
import { render, screen } from "@testing-library/react"
import App from "../App"

describe("App routing", () => {
  it("renders the import page at /import", () => {
    window.history.pushState({}, "", "/import")
    render(<App />)

    expect(screen.getByRole("heading", { name: /import/i })).toBeInTheDocument()
  })
})
