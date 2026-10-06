import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private app routes and bearer-token share links should never be indexed.
        disallow: ["/dashboard", "/passport/", "/service", "/settings", "/transfers", "/admin", "/share/", "/create", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
