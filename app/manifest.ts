import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clarus",
    short_name: "Clarus",
    description: "AI-powered content analysis for clarity and understanding. Get key insights, takeaways, and actionable recommendations from any video or article.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0a0a0a",
    theme_color: "#10b981",
    categories: ["news", "productivity", "utilities", "education"],
    icons: [
      {
        src: "/favicon.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/home.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
      },
      {
        src: "/screenshots/analysis.png",
        sizes: "750x1334",
        type: "image/png",
        form_factor: "narrow",
      },
    ],
    shortcuts: [
      {
        name: "Analyze URL",
        short_name: "Analyze",
        description: "Quickly analyze a new URL",
        url: "/",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "My Library",
        short_name: "Library",
        description: "View your analyzed content",
        url: "/library",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
    ],
  }
}
