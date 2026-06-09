import React from "react"
import { render } from "@testing-library/react"
import { RecordPlaceholder } from "../components/RecordPlaceholder"

describe("RecordPlaceholder", () => {
  it("renders an SVG element", () => {
    const { container } = render(<RecordPlaceholder />)
    expect(container.querySelector("svg")).toBeInTheDocument()
  })
})
