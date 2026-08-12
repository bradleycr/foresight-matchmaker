import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const alt = "Recoding Medicine Matchmaker — SPRIND challenge directory"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const ORIGIN = process.env.APP_URL ?? "https://matchmaker-sprind.vercel.app"

/** Ink-on-paper card for Slack, email, and social link previews. */
export default async function OpenGraphImage() {
  const assetDir = join(process.cwd(), "public/partners")
  const [sprindSvg, foresightSvg] = await Promise.all([
    readFile(join(assetDir, "sprind.svg")),
    readFile(join(assetDir, "foresight.svg")),
  ])

  const sprindSrc = `data:image/svg+xml;base64,${Buffer.from(sprindSvg).toString("base64")}`
  const foresightSrc = `data:image/svg+xml;base64,${Buffer.from(foresightSvg).toString("base64")}`

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          background: "#faf8f2",
          color: "#17150f",
          padding: "56px 64px",
          border: "4px solid #17150f",
          fontFamily: "Helvetica Neue, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#575243",
            }}
          >
            SPRIND challenge — Recoding Medicine
          </p>
          <h1
            style={{
              margin: 0,
              maxWidth: 920,
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
            }}
          >
            Recoding Medicine Matchmaker
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: 880,
              fontSize: 28,
              lineHeight: 1.35,
              color: "#575243",
            }}
          >
            A directory pairing European health-data holders with AI teams for joint SPRIND applications.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "#ffd200",
              color: "#171200",
              padding: "14px 18px",
              border: "2px solid #17150f",
              fontSize: 22,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Application deadline · 16 October 2026
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "2px solid #17150f",
              paddingTop: 20,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              With
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sprindSrc} alt="SPRIND" height={28} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foresightSrc} alt="Foresight Institute" height={36} />
            </div>
          </div>

          <p style={{ margin: 0, fontSize: 16, color: "#8c8674" }}>{ORIGIN.replace(/^https?:\/\//, "")}</p>
        </div>
      </div>
    ),
    size,
  )
}
