import type { MetadataRoute } from "next"

const ORIGIN = process.env.APP_URL ?? "https://foresight-matchmaker.vercel.app"

/** Keep sign-in, inbox, members directory, and admin out of crawlers. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/me", "/me/", "/claim/", "/api/", "/directory", "/profile/"],
    },
    host: ORIGIN,
  }
}
