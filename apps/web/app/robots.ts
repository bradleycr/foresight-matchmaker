import type { MetadataRoute } from "next"

const ORIGIN = process.env.APP_URL ?? "https://matchmaker-sprind.vercel.app"

/** Keep sign-in, inbox, and admin out of crawlers; the public directory is open. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/me", "/me/", "/claim/", "/api/"],
    },
    host: ORIGIN,
  }
}
