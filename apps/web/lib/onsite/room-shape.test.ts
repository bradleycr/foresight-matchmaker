import { describe, expect, it } from "vitest"
import { isSparseRoom, roomShape } from "./room-shape"

describe("roomShape", () => {
  it("fits a full Berlin room on one 5-column wall", () => {
    expect(roomShape(20)).toEqual({ cols: 5, rows: 4 })
    expect(roomShape(22)).toEqual({ cols: 5, rows: 5 })
    expect(roomShape(25)).toEqual({ cols: 5, rows: 5 })
  })

  it("keeps the first arrivals as a compact cluster, not a stretched wall", () => {
    expect(roomShape(1)).toEqual({ cols: 1, rows: 1 })
    expect(roomShape(2)).toEqual({ cols: 2, rows: 1 })
    expect(roomShape(3)).toEqual({ cols: 2, rows: 2 })
    expect(roomShape(4)).toEqual({ cols: 2, rows: 2 })
    expect(isSparseRoom(1)).toBe(true)
    expect(isSparseRoom(4)).toBe(true)
    expect(isSparseRoom(5)).toBe(false)
  })

  it("packs a healthy turnout into the frame", () => {
    expect(roomShape(6)).toEqual({ cols: 3, rows: 2 })
    expect(roomShape(12)).toEqual({ cols: 4, rows: 3 })
  })
})
