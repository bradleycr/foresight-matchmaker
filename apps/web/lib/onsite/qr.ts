import { encode } from "uqr"

type QrOpts = {
  border?: number
  ecc?: "L" | "M" | "Q" | "H"
}

/** QR as an inline SVG. Modules use currentColor; the quiet zone is whatever sits behind — no paper square. */
export function qrSvgMarkup(value: string, opts: QrOpts = {}): string {
  const { data, size } = encode(value, { ecc: opts.ecc ?? "M", border: opts.border ?? 4 })
  const cells: string[] = []
  for (let y = 0; y < size; y += 1) {
    const row = data[y]
    if (!row) continue
    for (let x = 0; x < size; x += 1) {
      if (row[x]) cells.push(`M${x} ${y}h1v1h-1z`)
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%" shape-rendering="crispEdges" role="img" fill="none" style="background:transparent"><path fill="currentColor" d="${cells.join("")}"/></svg>`
}
