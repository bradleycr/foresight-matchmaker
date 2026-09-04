import { describe, expect, it } from "vitest"
import { extractPartialJsonString } from "./json"

describe("extractPartialJsonString", () => {
  it("reads a complete reply value", () => {
    expect(extractPartialJsonString('{"reply":"Hello there","ask":null}', "reply")).toBe("Hello there")
  })

  it("reads a partial reply while the stream is still open", () => {
    expect(extractPartialJsonString('{"reply":"What do you', "reply")).toBe("What do you")
  })

  it("unescapes a newline inside the value", () => {
    expect(extractPartialJsonString('{"reply":"One\\nTwo"}', "reply")).toBe("One\nTwo")
  })
})
