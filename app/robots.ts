import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/features", "/articles", "/discover", "/terms", "/privacy", "/contact"],
        disallow: ["/api/", "/manage/", "/dashboard/", "/library/", "/item/", "/add-content/", "/login", "/signup", "/forgot-password", "/update-password", "/share/"],
      },
    ],
    sitemap: "https://clarusapp.io/sitemap.xml",
  }
}
