import { describe, expect, it } from "vitest"
import { roomShape } from "./room-shape"

describe("roomShape", () => {
  it("fits a full Berlin room on one 5-column wall", () => {
    expect(roomShape(20)).toEqual({ cols: 5, rows: 4 })
    expect(roomShape(22)).toEqual({ cols: 5, rows: 5 })
    expect(roomShape(25)).toEqual({ cols: 5, rows: 5 })
  })

  it("keeps a small room readable", () => {
    expect(roomShape(1)).toEqual({ cols: 2, rows: 1 })
    expect(roomShape(6)).toEqual({ cols: 3, rows: 2 })
    expect(roomShape(12)).toEqual({ cols: 4, rows: 3 })
  })
})
