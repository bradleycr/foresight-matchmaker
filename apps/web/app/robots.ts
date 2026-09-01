import type { MetadataRoute } from "next"
import { publicOrigin } from "@/lib/public-origin"

/** Keep sign-in, inbox, members directory, and admin out of crawlers. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/me", "/me/", "/claim/", "/api/", "/directory", "/profile/", "/here/", "/live-feed"],
    },
    host: publicOrigin(),
  }
}
